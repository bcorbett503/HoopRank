create index if not exists fr_to_status_idx   on friend_requests(to_id, status);
create index if not exists fr_from_status_idx on friend_requests(from_id, status);
