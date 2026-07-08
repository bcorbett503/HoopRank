import '../models.dart';

class CourtImageInfo {
  final String imageUrl;
  final String? sourceUrl;
  final String? sourceLabel;

  const CourtImageInfo({
    required this.imageUrl,
    this.sourceUrl,
    this.sourceLabel,
  });
}

const Map<String, CourtImageInfo> _curatedCourtImagesById = {
  '0b519ff6-1729-1be7-7cc2-f5d1bacec2b3': CourtImageInfo(
    imageUrl:
        'https://www.24hourfitness.com/content/dam/24-hour-fitness/images/clubs/CA/san-francisco/00435/preview/image1.jpg',
    sourceUrl:
        'https://www.24hourfitness.com/gyms/san-francisco-ca/sutter-montgomery-sport',
    sourceLabel: '24 Hour Fitness official club image',
  ),
  '39bbaf2e-7393-d1d4-e7b8-f90d1e53fadc': CourtImageInfo(
    imageUrl:
        'https://www.bayclubs.com/bc-cdn/w_800/https%3A//cdn.prod.website-files.com/6881e0680b14937cf2a11855/68877a507f22eea742600ad5_BC_Hero_SanFrancisco-300x188.jpg',
    sourceUrl: 'https://www.bayclubs.com/amenity/basketball',
    sourceLabel: 'Bay Club official image',
  ),
  '6b1b9162-842e-cb1d-23cc-577999cc3c15': CourtImageInfo(
    imageUrl:
        'https://catholiccharitiessf.org/wp-content/uploads/elementor/thumbs/st-vincents-1-1-q3066x730ugy9jeti3zviomlx7a8rq336guafdvoug.jpg',
    sourceUrl: 'https://catholiccharitiessf.org/st-vincents-school-for-boys/',
    sourceLabel: 'Catholic Charities official image',
  ),
  '88f85c04-8e09-3217-1818-6adc818c784b': CourtImageInfo(
    imageUrl:
        'https://www.ci.gladstone.or.us/sites/g/files/vyhlif13701/files/media/publicworks/image/17061/08_25_17_senior_center.jpg',
    sourceUrl:
        'https://www.ci.gladstone.or.us/publicworks/page/city-facilities',
    sourceLabel: 'City of Gladstone official venue image',
  ),
  '9d378226-6c64-e15c-9c32-847e9c7f93c3': CourtImageInfo(
    imageUrl:
        'https://www.bayclubs.com/bc-cdn/w_800/https://cdn.prod.website-files.com/6881e0680b14937cf2a11855/6889fcd28a8e6eacd355d5e7_financial_8.jpg',
    sourceUrl: 'https://www.bayclubs.com/clubs/financialdistrict',
    sourceLabel: 'Bay Club Financial District official image',
  ),
  '9c3e1ca0-6200-281b-5f44-45b774f7b6f1': CourtImageInfo(
    imageUrl:
        'https://bbk12e1-cdn.myschoolcdn.com/612/photo/2015/11/orig_photo319598_3280620.png?w=1920',
    sourceUrl: 'https://www.marincatholic.org/about/our-facilities',
    sourceLabel: 'Marin Catholic official gym image',
  ),
  '9d0e8a13-fd3c-39b5-e765-82e765c7a3fd': CourtImageInfo(
    imageUrl:
        'https://www.bayclubs.com/bc-cdn/w_800/https://cdn.prod.website-files.com/6881e0680b14937cf2a11855/6889f2e1a67beafa5961dca2_Marin_Basketball_3.jpg',
    sourceUrl: 'https://www.bayclubs.com/clubs/marin',
    sourceLabel: 'Bay Club Marin official basketball image',
  ),
  'a1e9cb90-8460-ca85-08dd-eacd56b6718a': CourtImageInfo(
    imageUrl: 'https://sfrecpark.org/ImageRepository/Document?documentID=4422',
    sourceUrl:
        'https://sfrecpark.org/942/Hamilton-Recreation-Center---Gymnasium',
    sourceLabel: 'SF Rec & Park official gym image',
  ),
  'a5fdfe61-3ac8-6088-721a-459dd1a30272': CourtImageInfo(
    imageUrl: 'https://sfrecpark.org/ImageRepository/Document?documentID=1232',
    sourceUrl:
        'https://sfrecpark.org/Facilities/Facility/Details/Ella-Hill-Hutch-Community-Center-83',
    sourceLabel: 'SF Rec & Park official gym image',
  ),
  'b638a8a8-1df2-ec14-a864-6d4d3986e84b': CourtImageInfo(
    imageUrl:
        'https://www.usfca.edu/sites/default/files/styles/3_4_960x1280/public/2025-12/Koret%20Basketball.jpg.jpeg?h=af525af9&itok=YuqiphiX',
    sourceUrl: 'https://www.usfca.edu/koret',
    sourceLabel: 'USF Koret official image',
  ),
  'cb4b8982-4f42-8c11-01f6-f46401069022': CourtImageInfo(
    imageUrl:
        'https://www.bellevueclub.com/wp-content/uploads/2019/12/Recreation_basketball.jpg',
    sourceUrl: 'https://www.bellevueclub.com/move/recreation/',
    sourceLabel: 'Bellevue Club official basketball image',
  ),
  'd351b10a-4fc9-bb7b-ed2d-82480bee2084': CourtImageInfo(
    imageUrl:
        'https://campuslifeserviceshome.ucsf.edu/sites/campuslifeservices.ucsf.edu/files/styles/large/public/2022-03/bakar%20location.png?itok=x0yAFBIF',
    sourceUrl:
        'https://campuslifeserviceshome.ucsf.edu/fitness-and-recreation/bakar-fitness-center-ucsf-mission-bay',
    sourceLabel: 'UCSF Campus Life Services official image',
  ),
  'd6f0a3f1-8bed-13fa-5d3f-a12dc704cff0': CourtImageInfo(
    imageUrl:
        'https://d2rzw8waxoxhv2.cloudfront.net/facilities/medium/2eda1609585525a9632a/1512329870699-690-66.jpg',
    sourceUrl: 'https://facilities.facilitron.com/5970cb8207238f0020f56f2b',
    sourceLabel: 'Hamilton gym facility image',
  ),
  'e72bb902-08f6-4dc0-acc3-fa85a6aa1b10': CourtImageInfo(
    imageUrl:
        'https://www.olyclub.com/wp-content/uploads/2025/12/CC-4-scaled-e1764871526289-1024x685.jpg',
    sourceUrl: 'https://www.olyclub.com/public-homepage/guest-info/',
    sourceLabel: 'Olympic Club official image',
  ),
  'ed6afa5f-f077-4868-9e50-8c71b3d703cf': CourtImageInfo(
    imageUrl: 'https://www.instagram.com/p/DYbA2F9GSud/media/?size=l',
    sourceUrl: 'https://www.instagram.com/p/DYbA2F9GSud/',
    sourceLabel: 'Novato Parks open-gym image',
  ),
  '274ec68b-4c85-dc90-559d-2b7ffa47938a': CourtImageInfo(
    imageUrl: 'https://sfrecpark.org/ImageRepository/Document?documentID=6575',
    sourceUrl:
        'https://sfrecpark.org/Facilities/Facility/Details/Mission-Rec-Center-100',
    sourceLabel: 'SF Rec & Park official gym image',
  ),
  '33677a80-28f7-f0c8-6f1b-9024f0955ada': CourtImageInfo(
    imageUrl: 'https://sfrecpark.org/ImageRepository/Document?documentID=4628',
    sourceUrl:
        'https://sfrecpark.org/967/Potrero-Hill-Recreation-Center---Gymnasi',
    sourceLabel: 'SF Rec & Park official gym image',
  ),
  'f65ce342-6b75-7faa-7205-47ea5cc0ba43': CourtImageInfo(
    imageUrl:
        'https://d2rzw8waxoxhv2.cloudfront.net/imagine/medium/mcms94903/1706148769819-834-33.jpg',
    sourceUrl: 'https://facilities.facilitron.com/65a97676438e4ad58f9926ea',
    sourceLabel: 'Miller Creek facility image',
  ),
  'fc74ef72-1ad1-0c4d-b7cc-019c010f1e68': CourtImageInfo(
    imageUrl:
        'https://images.ctfassets.net/drib7o8rcbyf/6wnKeePmucptvirOG8mvb/8923cb89403b898d5bb45374d46b6e7e/Equinox_ClubPage_Spaces_DT_ESCSanFran_3200x2133_____7.jpg',
    sourceUrl:
        'https://www.equinox.com/clubs/northern-california/sportsclubsanfrancisco',
    sourceLabel: 'Equinox official image',
  ),
};

const Map<String, String> _curatedCourtImageNameAliases = {
  '24 hour fitness': '0b519ff6-1729-1be7-7cc2-f5d1bacec2b3',
  'bay club san francisco': '39bbaf2e-7393-d1d4-e7b8-f90d1e53fadc',
  'bay club financial district': '9d378226-6c64-e15c-9c32-847e9c7f93c3',
  'saint vincent school gym': '6b1b9162-842e-cb1d-23cc-577999cc3c15',
  'gladstone community center basketball court':
      '88f85c04-8e09-3217-1818-6adc818c784b',
  'marin catholic gym': '9c3e1ca0-6200-281b-5f44-45b774f7b6f1',
  'bay club marin': '9d0e8a13-fd3c-39b5-e765-82e765c7a3fd',
  'hamilton recreation center': 'a1e9cb90-8460-ca85-08dd-eacd56b6718a',
  'ella hill hutch community center': 'a5fdfe61-3ac8-6088-721a-459dd1a30272',
  'koret health and recreation center': 'b638a8a8-1df2-ec14-a864-6d4d3986e84b',
  'bellevue club': 'cb4b8982-4f42-8c11-01f6-f46401069022',
  'bakar fitness & recreation center at ucsf mission bay':
      'd351b10a-4fc9-bb7b-ed2d-82480bee2084',
  'hamilton community gymnasium': 'd6f0a3f1-8bed-13fa-5d3f-a12dc704cff0',
  'the olympic club': 'e72bb902-08f6-4dc0-acc3-fa85a6aa1b10',
  'hill gymnasium': 'ed6afa5f-f077-4868-9e50-8c71b3d703cf',
  'mission recreation center': '274ec68b-4c85-dc90-559d-2b7ffa47938a',
  'potrero hill recreation center': '33677a80-28f7-f0c8-6f1b-9024f0955ada',
  'miller creek middle school gym': 'f65ce342-6b75-7faa-7205-47ea5cc0ba43',
  'equinox sports club san francisco': 'fc74ef72-1ad1-0c4d-b7cc-019c010f1e68',
};

CourtImageInfo? courtImageInfoFor(Court court) {
  final remoteImageUrl = _cleanString(court.imageUrl);
  if (remoteImageUrl != null) {
    return CourtImageInfo(
      imageUrl: remoteImageUrl,
      sourceUrl: _cleanString(court.imageSourceUrl),
      sourceLabel: _cleanString(court.imageSourceLabel),
    );
  }

  final byId = _curatedCourtImagesById[court.id];
  if (byId != null) return byId;

  final aliasId =
      _curatedCourtImageNameAliases[court.name.trim().toLowerCase()];
  if (aliasId == null) return null;
  return _curatedCourtImagesById[aliasId];
}

String? courtImageUrlFor(Court court) => courtImageInfoFor(court)?.imageUrl;

String courtMarkerImageUrlFor(Court court) {
  final sourcedImageUrl = courtImageUrlFor(court);
  if (sourcedImageUrl != null) return sourcedImageUrl;
  return courtMarkerFallbackAssetFor(court);
}

String courtMarkerFallbackAssetFor(Court court) {
  if (court.isSignature) {
    return 'assets/court_marker_signature_crown.jpg';
  }
  if (court.hasKings || court.hasTopFollower || court.hasUpcomingActivity) {
    return 'assets/court_marker_king.png';
  }
  return 'assets/court_marker.png';
}

String? _cleanString(String? value) {
  final text = value?.trim();
  if (text == null || text.isEmpty || text.toLowerCase() == 'null') {
    return null;
  }
  return text;
}
