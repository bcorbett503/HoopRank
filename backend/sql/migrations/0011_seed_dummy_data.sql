-- Seed comprehensive dummy data for testing
-- Users with varying HoopRanks and locations around SF

-- User 3: Jordan (3.8 rank)
insert into users (id, email, username, name, hoop_rank, reputation, position, height, weight, loc_enabled, last_loc, last_loc_at)
values ('00000000-0000-0000-0000-000000000003', 'jordan@hooprank.dev', 'jordan_23', 'Jordan Chen', 3.8, 4.8, 'SG', '6''2"', 185, true,
        ST_SetSRID(ST_MakePoint(-122.4100, 37.7850), 4326)::geography, now())
on conflict (id) do update set last_loc = excluded.last_loc, last_loc_at = excluded.last_loc_at;

insert into user_privacy (user_id) values ('00000000-0000-0000-0000-000000000003') on conflict do nothing;

-- User 4: Maya (4.2 rank)
insert into users (id, email, username, name, hoop_rank, reputation, position, height, weight, loc_enabled, last_loc, last_loc_at)
values ('00000000-0000-0000-0000-000000000004', 'maya@hooprank.dev', 'maya_hoops', 'Maya Rodriguez', 4.2, 5.0, 'PG', '5''8"', 145, true,
        ST_SetSRID(ST_MakePoint(-122.4300, 37.7650), 4326)::geography, now())
on conflict (id) do update set last_loc = excluded.last_loc, last_loc_at = excluded.last_loc_at;

insert into user_privacy (user_id) values ('00000000-0000-0000-0000-000000000004') on conflict do nothing;

-- User 5: Marcus (3.0 rank)
insert into users (id, email, username, name, hoop_rank, reputation, position, height, weight, loc_enabled, last_loc, last_loc_at)
values ('00000000-0000-0000-0000-000000000005', 'marcus@hooprank.dev', 'big_marc', 'Marcus Johnson', 3.0, 4.5, 'C', '6''8"', 220, true,
        ST_SetSRID(ST_MakePoint(-122.4250, 37.7700), 4326)::geography, now())
on conflict (id) do update set last_loc = excluded.last_loc, last_loc_at = excluded.last_loc_at;

insert into user_privacy (user_id) values ('00000000-0000-0000-0000-000000000005') on conflict do nothing;

-- User 6: Sarah (4.5 rank)
insert into users (id, email, username, name, hoop_rank, reputation, position, height, weight, loc_enabled, last_loc, last_loc_at)
values ('00000000-0000-0000-0000-000000000006', 'sarah@hooprank.dev', 'buckets_sarah', 'Sarah Williams', 4.5, 5.0, 'SF', '6''0"', 165, true,
        ST_SetSRID(ST_MakePoint(-122.4150, 37.7800), 4326)::geography, now())
on conflict (id) do update set last_loc = excluded.last_loc, last_loc_at = excluded.last_loc_at;

insert into user_privacy (user_id) values ('00000000-0000-0000-0000-000000000006') on conflict do nothing;

-- User 7: Alex (2.5 rank)
insert into users (id, email, username, name, hoop_rank, reputation, position, height, weight, loc_enabled, last_loc, last_loc_at)
values ('00000000-0000-0000-0000-000000000007', 'alex@hooprank.dev', 'alex_rookie', 'Alex Kim', 2.5, 4.2, 'PF', '6''4"', 200, true,
        ST_SetSRID(ST_MakePoint(-122.4350, 37.7720), 4326)::geography, now())
on conflict (id) do update set last_loc = excluded.last_loc, last_loc_at = excluded.last_loc_at;

insert into user_privacy (user_id) values ('00000000-0000-0000-0000-000000000007') on conflict do nothing;

-- User 8: Tyrone (3.9 rank)
insert into users (id, email, username, name, hoop_rank, reputation, position, height, weight, loc_enabled, last_loc, last_loc_at)
values ('00000000-0000-0000-0000-000000000008', 'tyrone@hooprank.dev', 'ty_hoops', 'Tyrone Davis', 3.9, 4.9, 'SG', '6''3"', 190, true,
        ST_SetSRID(ST_MakePoint(-122.4080, 37.7780), 4326)::geography, now())
on conflict (id) do update set last_loc = excluded.last_loc, last_loc_at = excluded.last_loc_at;

insert into user_privacy (user_id) values ('00000000-0000-0000-0000-000000000008') on conflict do nothing;

-- Additional Courts
insert into courts (id, name, city, indoor, rims, source, geog)
values ('22222222-2222-2222-2222-222222222222', 'Mission Bay Courts', 'San Francisco, CA', false, 4, 'curated',
        ST_SetSRID(ST_MakePoint(-122.3900, 37.7700), 4326)::geography)
on conflict do nothing;

insert into courts (id, name, city, indoor, rims, source, geog)
values ('33333333-3333-3333-3333-333333333333', 'Golden Gate Park Courts', 'San Francisco, CA', false, 2, 'curated',
        ST_SetSRID(ST_MakePoint(-122.4700, 37.7700), 4326)::geography)
on conflict do nothing;

insert into courts (id, name, city, indoor, rims, source, geog)
values ('44444444-4444-4444-4444-444444444444', 'Sunset District Gym', 'San Francisco, CA', true, 2, 'curated',
        ST_SetSRID(ST_MakePoint(-122.4950, 37.7550), 4326)::geography)
on conflict do nothing;

-- Matches (ended) to create stats
-- Dev user wins against Alex
insert into matches (id, status, creator_id, opponent_id, court_id, participants, started_by, timer_start, score, result, created_at)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'ended', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000007',
        '11111111-1111-1111-1111-111111111111',
        '["00000000-0000-0000-0000-000000000001", "00000000-0000-0000-0000-000000000007"]'::jsonb,
        '{"00000000-0000-0000-0000-000000000001": true, "00000000-0000-0000-0000-000000000007": true}'::jsonb,
        now() - interval '2 days',
        '{"00000000-0000-0000-0000-000000000001": 21, "00000000-0000-0000-0000-000000000007": 15}'::jsonb,
        '{"submittedBy": "00000000-0000-0000-0000-000000000001", "confirmedBy": "00000000-0000-0000-0000-000000000007", "finalized": true, "submittedAt": "2025-11-23T10:00:00Z", "deadlineAt": "2025-11-25T10:00:00Z"}'::jsonb,
        now() - interval '2 days')
on conflict do nothing;

-- Dev user loses to Maya
insert into matches (id, status, creator_id, opponent_id, court_id, participants, started_by, timer_start, score, result, created_at)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'ended', '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001',
        '22222222-2222-2222-2222-222222222222',
        '["00000000-0000-0000-0000-000000000004", "00000000-0000-0000-0000-000000000001"]'::jsonb,
        '{"00000000-0000-0000-0000-000000000004": true, "00000000-0000-0000-0000-000000000001": true}'::jsonb,
        now() - interval '3 days',
        '{"00000000-0000-0000-0000-000000000004": 21, "00000000-0000-0000-0000-000000000001": 18}'::jsonb,
        '{"submittedBy": "00000000-0000-0000-0000-000000000004", "confirmedBy": "00000000-0000-0000-0000-000000000001", "finalized": true, "submittedAt": "2025-11-22T14:00:00Z", "deadlineAt": "2025-11-24T14:00:00Z"}'::jsonb,
        now() - interval '3 days')
on conflict do nothing;

-- Dev user wins against Marcus
insert into matches (id, status, creator_id, opponent_id, court_id, participants, started_by, timer_start, score, result, created_at)
values ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'ended', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000005',
        '11111111-1111-1111-1111-111111111111',
        '["00000000-0000-0000-0000-000000000001", "00000000-0000-0000-0000-000000000005"]'::jsonb,
        '{"00000000-0000-0000-0000-000000000001": true, "00000000-0000-0000-0000-000000000005": true}'::jsonb,
        now() - interval '5 days',
        '{"00000000-0000-0000-0000-000000000001": 21, "00000000-0000-0000-0000-000000000005": 17}'::jsonb,
        '{"submittedBy": "00000000-0000-0000-0000-000000000001", "confirmedBy": "00000000-0000-0000-0000-000000000005", "finalized": true, "submittedAt": "2025-11-20T11:00:00Z", "deadlineAt": "2025-11-22T11:00:00Z"}'::jsonb,
        now() - interval '5 days')
on conflict do nothing;

-- Dev user wins against Jordan
insert into matches (id, status, creator_id, opponent_id, court_id, participants, started_by, timer_start, score, result, created_at)
values ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'ended', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003',
        '33333333-3333-3333-3333-333333333333',
        '["00000000-0000-0000-0000-000000000001", "00000000-0000-0000-0000-000000000003"]'::jsonb,
        '{"00000000-0000-0000-0000-000000000001": true, "00000000-0000-0000-0000-000000000003": true}'::jsonb,
        now() - interval '7 days',
        '{"00000000-0000-0000-0000-000000000001": 21, "00000000-0000-0000-0000-000000000003": 19}'::jsonb,
        '{"submittedBy": "00000000-0000-0000-0000-000000000001", "confirmedBy": "00000000-0000-0000-0000-000000000003", "finalized": true, "submittedAt": "2025-11-18T16:00:00Z", "deadlineAt": "2025-11-20T16:00:00Z"}'::jsonb,
        now() - interval '7 days')
on conflict do nothing;

-- Ratings History for Dev User (to populate graph)
insert into ratings_history (user_id, match_id, at, rating_before, rating_after, delta)
values ('00000000-0000-0000-0000-000000000001', 'dddddddd-dddd-dddd-dddd-dddddddddddd', now() - interval '7 days', 3.2, 3.3, 0.1)
on conflict do nothing;

insert into ratings_history (user_id, match_id, at, rating_before, rating_after, delta)
values ('00000000-0000-0000-0000-000000000001', 'cccccccc-cccc-cccc-cccc-cccccccccccc', now() - interval '5 days', 3.3, 3.4, 0.1)
on conflict do nothing;

insert into ratings_history (user_id, match_id, at, rating_before, rating_after, delta)
values ('00000000-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', now() - interval '3 days', 3.4, 3.3, -0.1)
on conflict do nothing;

insert into ratings_history (user_id, match_id, at, rating_before, rating_after, delta)
values ('00000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', now() - interval '2 days', 3.3, 3.5, 0.2)
on conflict do nothing;

-- Friendships
insert into friendships (user_a, user_b)
values ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002')
on conflict do nothing;

insert into friendships (user_a, user_b)
values ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003')
on conflict do nothing;

insert into friendships (user_a, user_b)
values ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004')
on conflict do nothing;

-- Friend Requests (pending)
insert into friend_requests (from_id, to_id, status)
values ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'pending')
on conflict do nothing;

insert into friend_requests (from_id, to_id, status)
values ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000006', 'pending')
on conflict do nothing;

-- Challenges (pending)
insert into challenges (from_id, to_id, message, status, expires_at)
values ('00000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', 
        'Let''s run it! I''ve been practicing my three-pointer 🏀', 'pending', now() + interval '2 days')
on conflict do nothing;

insert into challenges (from_id, to_id, message, status, expires_at)
values ('00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 
        'Up for a game this weekend?', 'pending', now() + interval '3 days')
on conflict do nothing;

-- Message Threads and Messages
-- Thread with Jordan
insert into threads (user_a, user_b, last_message_at)
values ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', now() - interval '1 hour')
on conflict do nothing;

insert into messages (thread_id, from_id, to_id, body, created_at, read)
select t.id, '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 
       'Good game yesterday! You really improved your defense.', now() - interval '2 hours', true
from threads t where user_a = '00000000-0000-0000-0000-000000000001' and user_b = '00000000-0000-0000-0000-000000000003'
on conflict do nothing;

insert into messages (thread_id, from_id, to_id, body, created_at, read)
select t.id, '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 
       'Thanks! Want to run it back next week?', now() - interval '1 hour', false
from threads t where user_a = '00000000-0000-0000-0000-000000000001' and user_b = '00000000-0000-0000-0000-000000000003'
on conflict do nothing;

-- Thread with Maya
insert into threads (user_a, user_b, last_message_at)
values ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', now() - interval '3 hours')
on conflict do nothing;

insert into messages (thread_id, from_id, to_id, body, created_at, read)
select t.id, '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 
       'That was a great match! Your shooting is getting better.', now() - interval '3 hours', true
from threads t where user_a = '00000000-0000-0000-0000-000000000001' and user_b = '00000000-0000-0000-0000-000000000004'
on conflict do nothing;

-- Court Kings
insert into court_kings_current (court_id, bracket, user_id, hoop_rank, last_win_at)
values ('11111111-1111-1111-1111-111111111111', 'Open', '00000000-0000-0000-0000-000000000006', 4.5, now() - interval '1 day')
on conflict (court_id, bracket) do nothing;

insert into court_kings_current (court_id, bracket, user_id, hoop_rank, last_win_at)
values ('22222222-2222-2222-2222-222222222222', 'Open', '00000000-0000-0000-0000-000000000004', 4.2, now() - interval '2 days')
on conflict (court_id, bracket) do nothing;
