ALTER TABLE courts ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE courts ADD COLUMN IF NOT EXISTS image_source_url TEXT;
ALTER TABLE courts ADD COLUMN IF NOT EXISTS image_source_label TEXT;
ALTER TABLE courts ADD COLUMN IF NOT EXISTS image_updated_at TIMESTAMP;

UPDATE courts
SET
  image_url = COALESCE(NULLIF(image_url, ''), seed.image_url),
  image_source_url = COALESCE(NULLIF(image_source_url, ''), seed.image_source_url),
  image_source_label = COALESCE(NULLIF(image_source_label, ''), seed.image_source_label),
  image_updated_at = COALESCE(image_updated_at, NOW())
FROM (VALUES
  (
    '39bbaf2e-7393-d1d4-e7b8-f90d1e53fadc',
    'https://www.bayclubs.com/bc-cdn/w_800/https%3A//cdn.prod.website-files.com/6881e0680b14937cf2a11855/68877a507f22eea742600ad5_BC_Hero_SanFrancisco-300x188.jpg',
    'https://www.bayclubs.com/amenity/basketball',
    'Bay Club official image'
  ),
  (
    'b638a8a8-1df2-ec14-a864-6d4d3986e84b',
    'https://www.usfca.edu/sites/default/files/styles/3_4_960x1280/public/2025-12/Koret%20Basketball.jpg.jpeg?h=af525af9&itok=YuqiphiX',
    'https://www.usfca.edu/koret',
    'USF Koret official image'
  ),
  (
    'e72bb902-08f6-4dc0-acc3-fa85a6aa1b10',
    'https://www.olyclub.com/wp-content/uploads/2025/12/CC-4-scaled-e1764871526289-1024x685.jpg',
    'https://www.olyclub.com/public-homepage/guest-info/',
    'Olympic Club official image'
  ),
  (
    'fc74ef72-1ad1-0c4d-b7cc-019c010f1e68',
    'https://images.ctfassets.net/drib7o8rcbyf/6wnKeePmucptvirOG8mvb/8923cb89403b898d5bb45374d46b6e7e/Equinox_ClubPage_Spaces_DT_ESCSanFran_3200x2133_____7.jpg',
    'https://www.equinox.com/clubs/northern-california/sportsclubsanfrancisco',
    'Equinox official image'
  )
) AS seed(id, image_url, image_source_url, image_source_label)
WHERE courts.id::text = seed.id;
