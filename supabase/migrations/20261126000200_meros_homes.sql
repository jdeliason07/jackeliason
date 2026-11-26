-- Homes: the residence becomes a ladder of five places to live (a basement room up to a house),
-- so it gets a fourth purchasable tier; and each home is furnished in three bought steps.
-- Additive: no existing row changes meaning.

alter table meros.estate_buildings drop constraint estate_buildings_tier_check;
alter table meros.estate_buildings add constraint estate_buildings_tier_check
  check (tier between 1 and 3 or (area = 'residence' and tier = 4));

-- One row per furnishing step bought, per home. Append-only, like every other purchase.
create table meros.furnishings (
  id uuid primary key,
  owner_id uuid not null references meros.profiles (id) on delete cascade,
  home_tier integer not null check (home_tier between 0 and 4),
  step integer not null check (step between 1 and 3),
  cost integer not null check (cost > 0),
  purchased_at timestamptz not null,
  unique (owner_id, home_tier, step)
);

create trigger furnishings_append_only before update or delete on meros.furnishings
  for each row execute function meros.forbid_mutation();
create trigger furnishings_no_truncate before truncate on meros.furnishings
  for each statement execute function meros.forbid_mutation();

alter table meros.furnishings enable row level security;
alter table meros.furnishings force row level security;
revoke all on meros.furnishings from public, anon, authenticated;
grant all on meros.furnishings to service_role;
grant select on meros.furnishings to authenticated;
create policy furnishings_owner_read on meros.furnishings for select to authenticated
  using (owner_id = (select auth.uid()) and (select meros.is_allowed_owner()));
create policy furnishings_server_all on meros.furnishings for all to postgres, service_role using (true) with check (true);
