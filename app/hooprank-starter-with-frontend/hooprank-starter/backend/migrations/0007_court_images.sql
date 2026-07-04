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
    '6b1b9162-842e-cb1d-23cc-577999cc3c15',
    'https://catholiccharitiessf.org/wp-content/uploads/elementor/thumbs/st-vincents-1-1-q3066x730ugy9jeti3zviomlx7a8rq336guafdvoug.jpg',
    'https://catholiccharitiessf.org/st-vincents-school-for-boys/',
    'Catholic Charities official image'
  ),
  (
    '88f85c04-8e09-3217-1818-6adc818c784b',
    'https://www.ci.gladstone.or.us/sites/g/files/vyhlif13701/files/media/publicworks/image/17061/08_25_17_senior_center.jpg',
    'https://www.ci.gladstone.or.us/publicworks/page/city-facilities',
    'City of Gladstone official venue image'
  ),
  (
    '9c3e1ca0-6200-281b-5f44-45b774f7b6f1',
    'https://bbk12e1-cdn.myschoolcdn.com/612/photo/2015/11/orig_photo319598_3280620.png?w=1920',
    'https://www.marincatholic.org/about/our-facilities',
    'Marin Catholic official gym image'
  ),
  (
    '9d0e8a13-fd3c-39b5-e765-82e765c7a3fd',
    'https://www.bayclubs.com/bc-cdn/w_800/https://cdn.prod.website-files.com/6881e0680b14937cf2a11855/6889f2e1a67beafa5961dca2_Marin_Basketball_3.jpg',
    'https://www.bayclubs.com/clubs/marin',
    'Bay Club Marin official basketball image'
  ),
  (
    'b638a8a8-1df2-ec14-a864-6d4d3986e84b',
    'https://www.usfca.edu/sites/default/files/styles/3_4_960x1280/public/2025-12/Koret%20Basketball.jpg.jpeg?h=af525af9&itok=YuqiphiX',
    'https://www.usfca.edu/koret',
    'USF Koret official image'
  ),
  (
    'cb4b8982-4f42-8c11-01f6-f46401069022',
    'https://www.bellevueclub.com/wp-content/uploads/2019/12/Recreation_basketball.jpg',
    'https://www.bellevueclub.com/move/recreation/',
    'Bellevue Club official basketball image'
  ),
  (
    'd6f0a3f1-8bed-13fa-5d3f-a12dc704cff0',
    'https://d2rzw8waxoxhv2.cloudfront.net/facilities/medium/2eda1609585525a9632a/1512329870699-690-66.jpg',
    'https://facilities.facilitron.com/5970cb8207238f0020f56f2b',
    'Hamilton gym facility image'
  ),
  (
    'e72bb902-08f6-4dc0-acc3-fa85a6aa1b10',
    'https://www.olyclub.com/wp-content/uploads/2025/12/CC-4-scaled-e1764871526289-1024x685.jpg',
    'https://www.olyclub.com/public-homepage/guest-info/',
    'Olympic Club official image'
  ),
  (
    'ed6afa5f-f077-4868-9e50-8c71b3d703cf',
    'https://www.instagram.com/p/DYbA2F9GSud/media/?size=l',
    'https://www.instagram.com/p/DYbA2F9GSud/',
    'Novato Parks open-gym image'
  ),
  (
    'f65ce342-6b75-7faa-7205-47ea5cc0ba43',
    'https://d2rzw8waxoxhv2.cloudfront.net/imagine/medium/mcms94903/1706148769819-834-33.jpg',
    'https://facilities.facilitron.com/65a97676438e4ad58f9926ea',
    'Miller Creek facility image'
  ),
  (
    'fc74ef72-1ad1-0c4d-b7cc-019c010f1e68',
    'https://images.ctfassets.net/drib7o8rcbyf/6wnKeePmucptvirOG8mvb/8923cb89403b898d5bb45374d46b6e7e/Equinox_ClubPage_Spaces_DT_ESCSanFran_3200x2133_____7.jpg',
    'https://www.equinox.com/clubs/northern-california/sportsclubsanfrancisco',
    'Equinox official image'
  )
) AS seed(id, image_url, image_source_url, image_source_label)
WHERE courts.id::text = seed.id;
