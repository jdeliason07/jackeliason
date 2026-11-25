-- Earned: schema, constraints, ledgers, row-level security.
--
-- Trust model
--   * The browser never writes authoritative data. Clients (anon/authenticated roles) get SELECT on
--     their own rows only, through RLS; every INSERT/UPDATE/DELETE privilege is revoked.
--   * All mutations go through the Next.js server, which authenticates the Supabase session, checks
--     the owner allowlist, and runs each command in one transaction under a per-owner advisory lock.
--   * Ledger tables (XP, wallet, tickets, consequences, openings, purchases, claims, turns, receipts,
--     quest versions) are append-only: triggers reject UPDATE and DELETE for every role.
--   * Composite foreign keys (owner_id, id) make cross-account references impossible.
--   * The `earned` schema is not exposed through the Data API by default; RLS is a second wall.

create schema if not exists earned;

revoke all on schema earned from public, anon, authenticated;
grant usage on schema earned to authenticated, service_role;

-- ───────────────────────────── helpers ─────────────────────────────

create or replace function earned.forbid_mutation() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'earned.%: rows are append-only (% rejected)', tg_table_name, tg_op
    using errcode = 'P0001';
end;
$$;

-- Owner allowlist. Only emails listed here can use Earned, even with a valid Supabase session.
create table earned.owner_allowlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email) and position('@' in email) > 1),
  created_at timestamptz not null default now()
);

create or replace function earned.is_allowed_owner() returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from earned.owner_allowlist a
    join auth.users u on lower(u.email) = a.email
    where u.id = auth.uid()
  );
$$;

revoke all on function earned.is_allowed_owner() from public, anon;
grant execute on function earned.is_allowed_owner() to authenticated, service_role;

-- ───────────────────────────── reference data ─────────────────────────────

create table earned.level_config_versions (
  id text primary key,
  version integer not null unique check (version > 0),
  config jsonb not null,
  created_at timestamptz not null default now()
);

create table earned.quest_templates (
  id text primary key,
  version integer not null check (version > 0),
  category text not null check (category in ('fitness','learning','business','faith','relationships','household')),
  title text not null,
  content jsonb not null
);

create table earned.item_definitions (
  id text primary key,
  kind text not null check (kind in ('cosmetic','decoration','component')),
  slot text check (slot in ('outfit','headwear','handheld','accessory')),
  rarity text not null check (rarity in ('common','uncommon','rare','legendary')),
  name text not null,
  description text not null,
  stats jsonb not null default '{}'::jsonb,
  is_unique boolean not null,
  art text not null,
  color text not null,
  check ((kind = 'cosmetic') = (slot is not null))
);

create table earned.battle_definitions (
  id text primary key,
  version integer not null check (version > 0),
  category text not null check (category in ('negotiation','market_entry','product_launch','operations','competitive_bid')),
  title text not null,
  content jsonb not null
);

-- ───────────────────────────── profile ─────────────────────────────

create table earned.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  timezone text not null check (char_length(timezone) between 1 and 64),
  focus text not null check (focus in ('insight','execution','influence')),
  appearance jsonb not null,
  -- Cached summaries. Each reconciles with its ledger (see earned.ledger_drift).
  xp_total integer not null default 0 check (xp_total >= 0),
  level integer not null default 1 check (level >= 1),
  credits integer not null default 0 check (credits >= 0),
  vitality integer not null default 100 check (vitality between 40 and 100),
  tickets integer not null default 0 check (tickets between 0 and 6),
  minimums_total integer not null default 0 check (minimums_total >= 0),
  chests_earned integer not null default 0 check (chests_earned >= 0),
  level_config_version integer not null references earned.level_config_versions (version),
  policy jsonb not null,
  onboarded_at timestamptz,
  last_catchup_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ───────────────────────────── quests ─────────────────────────────

create table earned.quests (
  id uuid primary key,
  owner_id uuid not null references earned.profiles (id) on delete cascade,
  habit_key text not null check (char_length(habit_key) between 1 and 80),
  template_id text references earned.quest_templates (id),
  status text not null check (status in ('active','paused','archived')),
  current_version_id uuid,
  momentum jsonb not null,
  materialized_through date,
  created_at timestamptz not null,
  activated_at timestamptz not null,
  paused_at timestamptz,
  archived_at timestamptz,
  updated_at timestamptz not null,
  unique (owner_id, id)
);
create index quests_owner_status on earned.quests (owner_id, status);

-- Immutable snapshots of the goal, schedule, verification rubric, and XP rules.
create table earned.quest_versions (
  id uuid primary key,
  owner_id uuid not null,
  quest_id uuid not null,
  version_no integer not null check (version_no > 0),
  effective_from timestamptz not null,
  timezone text not null,
  definition jsonb not null check (
    (definition->>'maxXp')::int between 2 and 40 and ((definition->>'maxXp')::int % 2) = 0
  ),
  created_at timestamptz not null,
  unique (quest_id, version_no),
  unique (owner_id, id),
  foreign key (owner_id, quest_id) references earned.quests (owner_id, id) on delete cascade
);

alter table earned.quests
  add constraint quests_current_version_fk foreign key (owner_id, current_version_id)
  references earned.quest_versions (owner_id, id) deferrable initially deferred;

create table earned.quest_pauses (
  id uuid primary key,
  owner_id uuid not null,
  quest_id uuid not null,
  paused_at timestamptz not null,
  resumed_at timestamptz check (resumed_at is null or resumed_at >= paused_at),
  foreign key (owner_id, quest_id) references earned.quests (owner_id, id) on delete cascade
);

create table earned.quest_weeks (
  id uuid primary key,
  owner_id uuid not null,
  quest_id uuid not null,
  quest_version_id uuid not null,
  week_start date not null check (extract(isodow from week_start) = 1),
  target integer not null check (target between 0 and 7),
  completed integer not null default 0 check (completed between 0 and 7),
  opens_at timestamptz not null,
  closes_at timestamptz not null check (closes_at > opens_at),
  timezone text not null,
  status text not null check (status in ('open','met','missed','excused')),
  evaluated_at timestamptz,
  created_at timestamptz not null,
  unique (quest_id, week_start),
  unique (owner_id, id),
  check (completed <= target),
  foreign key (owner_id, quest_id) references earned.quests (owner_id, id) on delete cascade,
  foreign key (owner_id, quest_version_id) references earned.quest_versions (owner_id, id)
);

create table earned.quest_occurrences (
  id uuid primary key,
  owner_id uuid not null,
  quest_id uuid not null,
  quest_version_id uuid not null,
  habit_key text not null,
  kind text not null check (kind in ('scheduled','weekly_slot')),
  local_date date not null,
  week_id uuid,
  opens_at timestamptz not null,
  closes_at timestamptz not null check (closes_at > opens_at and closes_at <= opens_at + interval '25 hours'),
  timezone text not null,
  snapshot jsonb not null,
  status text not null check (status in ('open','completed','missed','excused','lapsed')),
  optional_status text not null default 'none' check (optional_status in ('none','active','finished','declined','expired','abandoned')),
  completed_at timestamptz,
  verification_attempt_id uuid,
  evaluated_at timestamptz,
  resolution_note text,
  created_at timestamptz not null,
  unique (quest_id, local_date),
  unique (owner_id, id),
  check ((status = 'completed') = (completed_at is not null)),
  check (optional_status = 'none' or status = 'completed'),
  check ((kind = 'weekly_slot') = (week_id is not null)),
  foreign key (owner_id, quest_id) references earned.quests (owner_id, id) on delete cascade,
  foreign key (owner_id, quest_version_id) references earned.quest_versions (owner_id, id),
  foreign key (owner_id, week_id) references earned.quest_weeks (owner_id, id)
);
-- The same habit (e.g. two clones of one template) can score at most once per local day.
create unique index quest_occurrences_one_completion_per_habit_day
  on earned.quest_occurrences (owner_id, habit_key, local_date) where status = 'completed';
create index quest_occurrences_owner_window on earned.quest_occurrences (owner_id, closes_at);

create table earned.optional_sessions (
  id uuid primary key,
  owner_id uuid not null,
  occurrence_id uuid not null unique,
  status text not null check (status in ('active','finished','abandoned','expired')),
  started_at timestamptz not null,
  ends_at timestamptz not null,
  finished_at timestamptz,
  rating integer check (rating between 1 and 10),
  bonus_xp integer not null default 0 check (bonus_xp >= 0),
  created_at timestamptz not null,
  check (rating is null or status = 'finished'),
  foreign key (owner_id, occurrence_id) references earned.quest_occurrences (owner_id, id) on delete cascade
);

-- ───────────────────────────── verification ─────────────────────────────

create table earned.capture_challenges (
  id uuid primary key,
  owner_id uuid not null,
  occurrence_id uuid not null,
  token_hash text not null check (char_length(token_hash) = 64),
  issued_at timestamptz not null,
  expires_at timestamptz not null check (expires_at > issued_at),
  used_at timestamptz,
  unique (owner_id, id),
  foreign key (owner_id, occurrence_id) references earned.quest_occurrences (owner_id, id) on delete cascade
);

create table earned.verification_attempts (
  id uuid primary key,
  owner_id uuid not null,
  occurrence_id uuid not null,
  challenge_id uuid,
  idempotency_key text,
  mode text not null check (mode in ('photo','gps')),
  status text not null check (status in ('pending','accepted','rejected','inconclusive','unavailable','excused')),
  reason text not null default '' check (char_length(reason) <= 500),
  guidance text check (char_length(guidance) <= 500),
  provider text,
  model text,
  rubric jsonb not null,
  image_path text,
  image_sha256 text check (image_sha256 is null or char_length(image_sha256) = 64),
  image_dhash text,
  reuse_of uuid,
  similar_to uuid,
  image_deleted_at timestamptz,
  distance_m double precision check (distance_m is null or distance_m >= 0),
  accuracy_m double precision check (accuracy_m is null or accuracy_m >= 0),
  reading_at timestamptz,
  evaluations integer not null default 0 check (evaluations >= 0),
  demo boolean not null default false check (demo = false),
  submitted_at timestamptz not null,
  decided_at timestamptz,
  unique (owner_id, id),
  foreign key (owner_id, occurrence_id) references earned.quest_occurrences (owner_id, id) on delete cascade,
  foreign key (owner_id, challenge_id) references earned.capture_challenges (owner_id, id)
);
-- Demo verification can never reach this table: the check above rejects demo = true.
create unique index verification_attempts_challenge_id_key on earned.verification_attempts (challenge_id) where challenge_id is not null;
create unique index verification_attempts_idempotency_key on earned.verification_attempts (owner_id, idempotency_key) where idempotency_key is not null;
-- Identical image bytes can back only one decision per account.
create unique index verification_attempts_unique_image on earned.verification_attempts (owner_id, image_sha256)
  where image_sha256 is not null and reuse_of is null;
create index verification_attempts_owner_time on earned.verification_attempts (owner_id, submitted_at);

alter table earned.quest_occurrences
  add constraint quest_occurrences_attempt_fk foreign key (owner_id, verification_attempt_id)
  references earned.verification_attempts (owner_id, id) deferrable initially deferred;

-- ───────────────────────────── ledgers ─────────────────────────────

create table earned.xp_events (
  id uuid primary key,
  owner_id uuid not null references earned.profiles (id) on delete cascade,
  kind text not null check (kind in ('attendance','effort_bonus')),
  amount integer not null check (amount > 0 and amount <= 40),
  source_id text not null,
  occurrence_id uuid,
  quest_id uuid,
  level_before integer not null,
  level_after integer not null check (level_after >= level_before),
  created_at timestamptz not null,
  unique (owner_id, kind, source_id),
  foreign key (owner_id, occurrence_id) references earned.quest_occurrences (owner_id, id)
);
-- Only real-world quests grant XP: every XP event must reference a completed occurrence.
create or replace function earned.xp_requires_completed_occurrence() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.occurrence_id is null or not exists (
    select 1 from earned.quest_occurrences o
    where o.id = new.occurrence_id and o.owner_id = new.owner_id and o.status = 'completed'
  ) then
    raise exception 'xp_events: XP requires a verified, completed occurrence' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger xp_events_require_occurrence before insert on earned.xp_events
  for each row execute function earned.xp_requires_completed_occurrence();

create table earned.wallet_events (
  id uuid primary key,
  owner_id uuid not null references earned.profiles (id) on delete cascade,
  kind text not null check (kind in ('chest','duplicate','momentum','battle','purchase')),
  delta integer not null check (delta <> 0 and (kind = 'purchase') = (delta < 0)),
  source_id text not null,
  note text not null default '',
  created_at timestamptz not null,
  unique (owner_id, kind, source_id)
);

create table earned.ticket_events (
  id uuid primary key,
  owner_id uuid not null references earned.profiles (id) on delete cascade,
  kind text not null check (kind in ('earned','spent')),
  delta integer not null check ((kind = 'earned' and delta = 1) or (kind = 'spent' and delta = -1)),
  source_id text not null,
  local_date date not null,
  created_at timestamptz not null,
  unique (owner_id, kind, source_id)
);

create table earned.consequence_events (
  id uuid primary key,
  owner_id uuid not null references earned.profiles (id) on delete cascade,
  quest_id uuid,
  kind text not null check (kind in ('miss','week_missed','week_met','momentum_activated','momentum_suspended','momentum_restored','vitality_loss','vitality_restored','technical_excuse')),
  source_id text not null,
  miss_count integer,
  vitality_requested integer not null default 0,
  vitality_delta integer not null default 0 check (vitality_delta between -4 and 10),
  day date not null,
  policy_version integer not null,
  explanation text not null,
  created_at timestamptz not null,
  unique (owner_id, kind, source_id)
);
create index consequence_events_owner_day on earned.consequence_events (owner_id, day);

-- ───────────────────────────── chests and inventory ─────────────────────────────

create table earned.chest_entitlements (
  id uuid primary key,
  owner_id uuid not null,
  seq integer not null check (seq > 0),
  source_occurrence_id uuid not null,
  earned_at timestamptz not null,
  opened_at timestamptz,
  unique (owner_id, seq),
  unique (owner_id, id),
  foreign key (owner_id) references earned.profiles (id) on delete cascade,
  foreign key (owner_id, source_occurrence_id) references earned.quest_occurrences (owner_id, id)
);

create table earned.chest_openings (
  id uuid primary key,
  owner_id uuid not null,
  entitlement_id uuid not null unique,
  loot_table_version integer not null,
  rarity text not null check (rarity in ('common','uncommon','rare','legendary')),
  credits integer not null check (credits > 0),
  item_id text not null references earned.item_definitions (id),
  duplicate_credits integer not null default 0 check (duplicate_credits >= 0),
  opened_at timestamptz not null,
  foreign key (owner_id, entitlement_id) references earned.chest_entitlements (owner_id, id) on delete cascade
);

create table earned.inventory (
  id uuid primary key,
  owner_id uuid not null references earned.profiles (id) on delete cascade,
  item_id text not null references earned.item_definitions (id),
  kind text not null check (kind in ('cosmetic','decoration','component')),
  slot text,
  quantity integer not null check (quantity >= 1),
  equipped boolean not null default false,
  first_acquired_at timestamptz not null,
  updated_at timestamptz not null,
  unique (owner_id, item_id),
  check (kind = 'component' or quantity = 1),
  check (not equipped or kind <> 'component')
);
create unique index inventory_one_equipped_per_slot on earned.inventory (owner_id, slot) where equipped and kind = 'cosmetic';

-- ───────────────────────────── estate and ventures ─────────────────────────────

create table earned.estate_buildings (
  id uuid primary key,
  owner_id uuid not null references earned.profiles (id) on delete cascade,
  area text not null check (area in ('residence','office','library','gym','workshop','gardens')),
  tier integer not null check (tier between 1 and 3),
  cost integer not null check (cost > 0),
  purchased_at timestamptz not null,
  unique (owner_id, area, tier)
);

create table earned.battle_sessions (
  id uuid primary key,
  owner_id uuid not null references earned.profiles (id) on delete cascade,
  scenario_id text not null references earned.battle_definitions (id),
  scenario_version integer not null,
  mode text not null check (mode in ('practice','rewarded')),
  status text not null check (status in ('active','finished','abandoned')),
  seed bigint not null check (seed between 0 and 4294967295),
  state jsonb not null,
  loadout jsonb not null,
  ticket_source_id text,
  reward_credits integer not null default 0 check (reward_credits >= 0 and (mode = 'rewarded' or reward_credits = 0)),
  outcome text check (outcome in ('victory','partial','defeat')),
  started_at timestamptz not null,
  finished_at timestamptz,
  unique (owner_id, id),
  check ((mode = 'rewarded') = (ticket_source_id is not null))
);
create unique index battle_sessions_one_active on earned.battle_sessions (owner_id) where status = 'active';

create table earned.battle_turns (
  id uuid primary key,
  owner_id uuid not null,
  battle_id uuid not null,
  round integer not null check (round between 1 and 3),
  intent_id text not null,
  choice_id text not null,
  result jsonb not null,
  created_at timestamptz not null,
  unique (battle_id, round),
  foreign key (owner_id, battle_id) references earned.battle_sessions (owner_id, id) on delete cascade
);

-- ───────────────────────────── real-world rewards ─────────────────────────────
-- The app tracks self-funded entitlements and claims. It never moves money or buys anything.

create table earned.rewards (
  id uuid primary key,
  owner_id uuid not null references earned.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  kind text not null check (kind in ('money','gift_card','experience','other')),
  description text not null default '' check (char_length(description) <= 500),
  amount_cents integer check (amount_cents is null or amount_cents between 1 and 10000000),
  target_level integer check (target_level is null or target_level between 2 and 30),
  target_minimums integer check (target_minimums is null or target_minimums between 1 and 100000),
  unlocked_at timestamptz,
  archived_at timestamptz,
  notes text not null default '' check (char_length(notes) <= 1000),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique (owner_id, id),
  check (target_level is not null or target_minimums is not null)
);

create table earned.reward_claims (
  id uuid primary key,
  owner_id uuid not null,
  reward_id uuid not null unique,
  amount_cents integer not null default 0 check (amount_cents >= 0),
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  budgeted boolean not null,
  claimed_at timestamptz not null,
  note text not null default '',
  foreign key (owner_id, reward_id) references earned.rewards (owner_id, id) on delete cascade
);

create table earned.reward_budgets (
  id uuid primary key,
  owner_id uuid not null references earned.profiles (id) on delete cascade,
  cents integer check (cents is null or cents between 0 and 10000000),
  effective_at timestamptz not null
);

-- ───────────────────────────── idempotency ─────────────────────────────

create table earned.command_receipts (
  id uuid primary key,
  owner_id uuid not null references earned.profiles (id) on delete cascade,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 100),
  command text not null,
  response jsonb not null,
  created_at timestamptz not null,
  unique (owner_id, idempotency_key)
);

-- ───────────────────────────── append-only ledgers ─────────────────────────────

do $$
declare t text;
begin
  foreach t in array array[
    'level_config_versions','quest_versions','xp_events','wallet_events','ticket_events','consequence_events',
    'chest_openings','estate_buildings','battle_turns','reward_claims','reward_budgets','command_receipts'
  ] loop
    execute format(
      'create trigger %I before update or delete on earned.%I for each row execute function earned.forbid_mutation()',
      t || '_append_only', t
    );
    -- TRUNCATE skips row triggers, so guard it at statement level too.
    execute format(
      'create trigger %I before truncate on earned.%I for each statement execute function earned.forbid_mutation()',
      t || '_no_truncate', t
    );
  end loop;
end;
$$;

-- ───────────────────────────── reconciliation ─────────────────────────────
-- Compares each cached summary on the profile with the sum of its ledger. Empty result = consistent.

create or replace function earned.ledger_drift(p_owner uuid)
returns table (metric text, cached bigint, ledger bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_role text := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '');
begin
  if caller_role in ('anon', 'authenticated') and (auth.uid() is distinct from p_owner or not earned.is_allowed_owner()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
  with p as (select * from earned.profiles where id = p_owner),
  sums as (
    select
      (select coalesce(sum(amount), 0) from earned.xp_events where owner_id = p_owner) as xp,
      (select coalesce(sum(delta), 0) from earned.wallet_events where owner_id = p_owner) as credits,
      (select coalesce(sum(delta), 0) from earned.ticket_events where owner_id = p_owner) as tickets,
      (select 100 + coalesce(sum(vitality_delta), 0) from earned.consequence_events where owner_id = p_owner) as vitality,
      (select count(*) from earned.xp_events where owner_id = p_owner and kind = 'attendance') as minimums,
      (select count(*) from earned.chest_entitlements where owner_id = p_owner) as chests
  )
  select m.metric, m.cached, m.ledger from p, sums,
  lateral (values
    ('xp_total', p.xp_total::bigint, sums.xp::bigint),
    ('credits', p.credits::bigint, sums.credits::bigint),
    ('tickets', p.tickets::bigint, sums.tickets::bigint),
    ('vitality', p.vitality::bigint, sums.vitality::bigint),
    ('minimums_total', p.minimums_total::bigint, sums.minimums::bigint),
    ('chests_earned', p.chests_earned::bigint, sums.chests::bigint)
  ) as m(metric, cached, ledger)
  where m.cached is distinct from m.ledger;
end;
$$;

revoke all on function earned.ledger_drift(uuid) from public, anon;
grant execute on function earned.ledger_drift(uuid) to authenticated, service_role;

-- ───────────────────────────── row-level security ─────────────────────────────

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'earned' loop
    execute format('alter table earned.%I enable row level security', t);
    execute format('alter table earned.%I force row level security', t);
    execute format('revoke all on earned.%I from public, anon, authenticated', t);
    execute format('grant all on earned.%I to service_role', t);
  end loop;
end;
$$;

-- Owner-scoped read access for signed-in, allowlisted owners. No write policies exist for clients.
do $$
declare t text;
begin
  foreach t in array array[
    'quests','quest_versions','quest_pauses','quest_weeks','quest_occurrences','optional_sessions',
    'verification_attempts','xp_events','wallet_events','ticket_events','consequence_events','chest_entitlements',
    'chest_openings','inventory','estate_buildings','battle_sessions','battle_turns','rewards','reward_claims',
    'reward_budgets'
  ] loop
    execute format('grant select on earned.%I to authenticated', t);
    execute format(
      'create policy %I on earned.%I for select to authenticated using (owner_id = (select auth.uid()) and (select earned.is_allowed_owner()))',
      t || '_owner_read', t
    );
  end loop;
end;
$$;

grant select on earned.profiles to authenticated;
create policy profiles_owner_read on earned.profiles for select to authenticated
  using (id = (select auth.uid()) and (select earned.is_allowed_owner()));

-- Reference content is readable by allowlisted owners.
do $$
declare t text;
begin
  foreach t in array array['level_config_versions','quest_templates','item_definitions','battle_definitions'] loop
    execute format('grant select on earned.%I to authenticated', t);
    execute format(
      'create policy %I on earned.%I for select to authenticated using ((select earned.is_allowed_owner()))',
      t || '_owner_read', t
    );
  end loop;
end;
$$;

-- capture_challenges (token hashes) and command_receipts stay server-only: no client policy at all.
-- owner_allowlist stays server-only as well.

-- The server connects as a privileged role that owns these tables. FORCE RLS applies to the table
-- owner too, so grant that role an explicit bypass policy (Supabase's `postgres` role).
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'earned' loop
    execute format('create policy %I on earned.%I for all to postgres, service_role using (true) with check (true)', t || '_server_all', t);
  end loop;
end;
$$;
