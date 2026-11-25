-- Places and real earnings. Additive only: existing rows and code keep working.
--
-- profiles.places: where each estate building is in real life (the gym, the office, the library),
--   as { "<area>": { lat, lng, radiusM, label } }. Tasks created in a building default to its spot.
-- earnings: real money the owner reports earning from a task (or on its own), in integer cents.
--   Not game currency: it never buys anything in the game and nothing in the game creates it.

alter table meros.profiles add column places jsonb not null default '{}'::jsonb;

create table meros.earnings (
  id uuid primary key,
  owner_id uuid not null references meros.profiles (id) on delete cascade,
  occurrence_id uuid references meros.quest_occurrences (id) on delete set null,
  quest_id uuid,
  org text not null default '' check (char_length(org) <= 40),
  amount_cents integer not null check (amount_cents between 0 and 100000000),
  note text not null default '' check (char_length(note) <= 140),
  local_date date not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);
create index earnings_owner_date on meros.earnings (owner_id, local_date);
create unique index earnings_one_per_occurrence on meros.earnings (owner_id, occurrence_id) where occurrence_id is not null;

alter table meros.earnings enable row level security;
alter table meros.earnings force row level security;
revoke all on meros.earnings from public, anon, authenticated;
grant all on meros.earnings to service_role;
grant select on meros.earnings to authenticated;
create policy earnings_owner_read on meros.earnings for select to authenticated
  using (owner_id = (select auth.uid()) and (select meros.is_allowed_owner()));
create policy earnings_server_all on meros.earnings for all to postgres, service_role using (true) with check (true);
