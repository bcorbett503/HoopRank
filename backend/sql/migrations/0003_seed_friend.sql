insert into users (id, email, username, name, hoop_rank, reputation, loc_enabled, last_loc, last_loc_at)
values ('00000000-0000-0000-0000-000000000002','pat@hooprank.dev','pat','Pat (Dev)',3.6,5.0,true,
        ST_SetSRID(ST_MakePoint(-122.42, 37.775), 4326)::geography, now())
on conflict (id) do update set last_loc = excluded.last_loc, last_loc_at = excluded.last_loc_at;

insert into user_privacy (user_id, public_profile, public_location, discover_radius_mi, discover_mode, discover_window, discover_min_reputation)
values ('00000000-0000-0000-0000-000000000002', true, true, 5, 'open', 0.5, 0)
on conflict (user_id) do nothing;
