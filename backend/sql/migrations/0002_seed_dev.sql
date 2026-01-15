-- Dev user
insert into users (id, email, username, name, hoop_rank, reputation, loc_enabled, last_loc, last_loc_at)
values (
  '00000000-0000-0000-0000-000000000001',
  'you@hooprank.dev', 'brett', 'Brett (Dev)',
  3.5, 5.0, true,
  ST_SetSRID(ST_MakePoint(-122.4194, 37.7749), 4326)::geography,
  now()
)
on conflict (id) do nothing;

insert into user_privacy (user_id) values ('00000000-0000-0000-0000-000000000001')
on conflict (user_id) do nothing;

-- A sample court in SF
insert into courts (id, name, city, indoor, rims, source, geog)
values (
  '11111111-1111-1111-1111-111111111111',
  'HoopRank Dev Court', 'San Francisco, CA', false, 2, 'curated',
  ST_SetSRID(ST_MakePoint(-122.4194, 37.7749), 4326)::geography
)
on conflict (id) do nothing;
