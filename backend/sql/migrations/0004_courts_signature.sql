alter table courts add column if not exists signature boolean not null default false;
create index if not exists courts_signature_idx on courts(signature);

-- Update existing dev court to be signature
update courts set signature = true where id = '11111111-1111-1111-1111-111111111111';

-- Seed a couple more curated courts (SF)
insert into courts (id, name, city, indoor, rims, source, geog, signature)
values
  ('22222222-2222-2222-2222-222222222222','Rossi Playground','San Francisco, CA',false,2,'curated',
    ST_SetSRID(ST_MakePoint(-122.4524,37.7778),4326)::geography,true),
  ('33333333-3333-3333-3333-333333333333','Moscone Park Courts','San Francisco, CA',false,4,'curated',
    ST_SetSRID(ST_MakePoint(-122.4304,37.8012),4326)::geography,true)
on conflict (id) do nothing;
