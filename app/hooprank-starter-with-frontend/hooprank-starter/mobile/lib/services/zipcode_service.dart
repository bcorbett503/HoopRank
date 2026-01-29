/// Provides zipcode to coordinates lookup for map centering fallback.
/// Uses approximate centroid coordinates for major US zipcode prefixes.

class ZipcodeService {
  /// Returns approximate coordinates for a given US zipcode.
  /// Falls back to San Francisco if zipcode not found.
  static MapCoordinates getCoordinatesForZipcode(String zipcode) {
    if (zipcode.isEmpty) {
      return _defaultCoordinates;
    }
    
    // Get first 3 digits for region lookup
    final prefix = zipcode.length >= 3 ? zipcode.substring(0, 3) : zipcode;
    
    // Check specific zipcodes first
    if (_specificZipcodes.containsKey(zipcode)) {
      return _specificZipcodes[zipcode]!;
    }
    
    // Fall back to prefix-based lookup
    if (_zipcodePrefixCoordinates.containsKey(prefix)) {
      return _zipcodePrefixCoordinates[prefix]!;
    }
    
    return _defaultCoordinates;
  }
  
  static const _defaultCoordinates = MapCoordinates(37.7749, -122.4194); // San Francisco
  
  /// Specific zipcode coordinates for common areas
  static const Map<String, MapCoordinates> _specificZipcodes = {
    // San Francisco Bay Area
    '94901': MapCoordinates(37.9735, -122.5311), // San Rafael
    '94903': MapCoordinates(38.0194, -122.5376), // San Rafael (Terra Linda)
    '94904': MapCoordinates(37.9527, -122.5397), // Greenbrae
    '94949': MapCoordinates(38.0686, -122.5294), // Novato
    '94102': MapCoordinates(37.7821, -122.4171), // SF Downtown
    '94110': MapCoordinates(37.7506, -122.4156), // Mission
    '94114': MapCoordinates(37.7585, -122.4350), // Castro
    '94117': MapCoordinates(37.7706, -122.4463), // Haight
    '94121': MapCoordinates(37.7775, -122.4964), // Richmond
    '94122': MapCoordinates(37.7589, -122.4847), // Sunset
    '94131': MapCoordinates(37.7432, -122.4386), // Twin Peaks
    '94520': MapCoordinates(37.9577, -122.0574), // Concord
    '94596': MapCoordinates(37.9017, -122.0597), // Walnut Creek
    '94501': MapCoordinates(37.7652, -122.2416), // Alameda
    '94601': MapCoordinates(37.7754, -122.2244), // Oakland
    '94612': MapCoordinates(37.8044, -122.2711), // Oakland Downtown
    '94705': MapCoordinates(37.8631, -122.2538), // Berkeley
    '94301': MapCoordinates(37.4419, -122.1430), // Palo Alto
    '94040': MapCoordinates(37.3861, -122.0839), // Mountain View
    '95014': MapCoordinates(37.3230, -122.0322), // Cupertino
    '95112': MapCoordinates(37.3382, -121.8863), // San Jose
    
    // Los Angeles Area
    '90001': MapCoordinates(33.9425, -118.2551), // LA
    '90210': MapCoordinates(34.0901, -118.4065), // Beverly Hills
    '90401': MapCoordinates(34.0195, -118.4912), // Santa Monica
    '91001': MapCoordinates(34.1478, -118.1445), // Altadena
    '91101': MapCoordinates(34.1478, -118.1445), // Pasadena
    
    // New York Area
    '10001': MapCoordinates(40.7506, -73.9971), // Manhattan
    '10003': MapCoordinates(40.7317, -73.9893), // East Village
    '10010': MapCoordinates(40.7390, -73.9826), // Gramercy
    '10019': MapCoordinates(40.7651, -73.9870), // Midtown West
    '10036': MapCoordinates(40.7590, -73.9845), // Times Square
    '10128': MapCoordinates(40.7817, -73.9510), // Upper East Side
    '11201': MapCoordinates(40.6930, -73.9897), // Brooklyn Heights
    '11211': MapCoordinates(40.7128, -73.9534), // Williamsburg
    
    // Chicago Area
    '60601': MapCoordinates(41.8819, -87.6278), // The Loop
    '60611': MapCoordinates(41.8936, -87.6176), // Near North
    '60614': MapCoordinates(41.9214, -87.6513), // Lincoln Park
    '60657': MapCoordinates(41.9400, -87.6528), // Lakeview
    
    // Miami Area
    '33101': MapCoordinates(25.7617, -80.1918), // Miami
    '33139': MapCoordinates(25.7906, -80.1300), // Miami Beach
    '33301': MapCoordinates(26.1224, -80.1373), // Fort Lauderdale
    
    // Other Major Cities
    '02101': MapCoordinates(42.3601, -71.0589), // Boston
    '19101': MapCoordinates(39.9526, -75.1652), // Philadelphia
    '20001': MapCoordinates(38.9072, -77.0369), // Washington DC
    '30301': MapCoordinates(33.7490, -84.3880), // Atlanta
    '75201': MapCoordinates(32.7767, -96.7970), // Dallas
    '77001': MapCoordinates(29.7604, -95.3698), // Houston
    '85001': MapCoordinates(33.4484, -112.0740), // Phoenix
    '89101': MapCoordinates(36.1699, -115.1398), // Las Vegas
    '98101': MapCoordinates(47.6062, -122.3321), // Seattle
    '80201': MapCoordinates(39.7392, -104.9903), // Denver
  };
  
  /// Zipcode prefix (first 3 digits) to approximate region coordinates
  static const Map<String, MapCoordinates> _zipcodePrefixCoordinates = {
    // California
    '900': MapCoordinates(34.0522, -118.2437), // Los Angeles
    '901': MapCoordinates(33.9425, -118.2551), // LA
    '902': MapCoordinates(33.8886, -118.0950), // Inglewood
    '903': MapCoordinates(33.8886, -118.0950), // LA area
    '904': MapCoordinates(34.0195, -118.4912), // Santa Monica
    '905': MapCoordinates(33.8153, -118.3528), // Torrance
    '906': MapCoordinates(33.9425, -118.2551), // LA
    '907': MapCoordinates(33.9308, -118.0206), // Whittier
    '908': MapCoordinates(33.7879, -117.8531), // Anaheim
    '910': MapCoordinates(34.1478, -118.1445), // Pasadena
    '911': MapCoordinates(34.1478, -118.1445), // Pasadena
    '912': MapCoordinates(34.1905, -118.3716), // Glendale
    '913': MapCoordinates(34.2011, -118.4965), // Van Nuys
    '914': MapCoordinates(34.1844, -118.6312), // Sherman Oaks
    '915': MapCoordinates(34.1761, -118.8482), // Burbank
    '917': MapCoordinates(34.0623, -117.5884), // Pomona
    '918': MapCoordinates(34.0622, -117.5883), // Pomona
    '920': MapCoordinates(32.7157, -117.1611), // San Diego
    '921': MapCoordinates(32.7157, -117.1611), // San Diego
    '922': MapCoordinates(32.7157, -117.1611), // San Diego
    '923': MapCoordinates(33.4936, -117.1484), // Riverside
    '924': MapCoordinates(33.7879, -117.8531), // Orange County
    '925': MapCoordinates(33.7879, -117.8531), // Irvine
    '926': MapCoordinates(33.7879, -117.8531), // Santa Ana
    '927': MapCoordinates(33.7879, -117.8531), // Fullerton
    '928': MapCoordinates(33.9533, -117.3962), // Riverside
    '930': MapCoordinates(34.4208, -119.6982), // Santa Barbara
    '931': MapCoordinates(34.4208, -119.6982), // Santa Barbara
    '932': MapCoordinates(35.3733, -119.0187), // Bakersfield
    '933': MapCoordinates(35.3733, -119.0187), // Bakersfield
    '934': MapCoordinates(36.7378, -119.7871), // Fresno
    '935': MapCoordinates(36.7378, -119.7871), // Fresno
    '936': MapCoordinates(36.7378, -119.7871), // Fresno
    '937': MapCoordinates(36.7378, -119.7871), // Fresno
    '939': MapCoordinates(36.7478, -119.7724), // Fresno
    '940': MapCoordinates(37.7749, -122.4194), // San Francisco
    '941': MapCoordinates(37.7749, -122.4194), // San Francisco
    '942': MapCoordinates(36.9741, -122.0308), // Sacramento (mail)
    '943': MapCoordinates(37.4419, -122.1430), // Palo Alto
    '944': MapCoordinates(37.5485, -122.0593), // Fremont
    '945': MapCoordinates(37.8044, -122.2711), // Oakland
    '946': MapCoordinates(37.8044, -122.2711), // Oakland
    '947': MapCoordinates(37.8716, -122.2727), // Berkeley
    '948': MapCoordinates(37.9577, -122.0574), // Richmond/Contra Costa
    '949': MapCoordinates(37.9735, -122.5311), // San Rafael / Marin
    '950': MapCoordinates(37.3382, -121.8863), // San Jose
    '951': MapCoordinates(37.3382, -121.8863), // San Jose
    '952': MapCoordinates(37.3688, -122.0363), // Sunnyvale
    '953': MapCoordinates(36.9741, -122.0308), // Santa Cruz
    '954': MapCoordinates(36.6002, -121.8947), // Salinas
    '955': MapCoordinates(40.5865, -122.3917), // Redding
    '956': MapCoordinates(38.5816, -121.4944), // Sacramento
    '957': MapCoordinates(38.5816, -121.4944), // Sacramento
    '958': MapCoordinates(38.5816, -121.4944), // Sacramento
    '959': MapCoordinates(38.5816, -121.4944), // Sacramento
    
    // New York
    '100': MapCoordinates(40.7128, -74.0060), // Manhattan
    '101': MapCoordinates(40.7128, -74.0060), // Manhattan
    '102': MapCoordinates(40.7128, -74.0060), // Manhattan
    '103': MapCoordinates(40.5795, -74.1502), // Staten Island
    '104': MapCoordinates(40.8448, -73.8648), // Bronx
    '105': MapCoordinates(40.9176, -73.8555), // Yonkers
    '106': MapCoordinates(41.0341, -73.7629), // White Plains
    '107': MapCoordinates(41.0541, -73.8606), // Yonkers
    '108': MapCoordinates(40.9481, -73.7992), // New Rochelle
    '109': MapCoordinates(41.1220, -73.7949), // Suffern
    '110': MapCoordinates(40.7282, -73.7949), // Queens
    '111': MapCoordinates(40.7282, -73.7949), // Long Island City
    '112': MapCoordinates(40.6782, -73.9442), // Brooklyn
    '113': MapCoordinates(40.6782, -73.9442), // Brooklyn
    '114': MapCoordinates(40.7282, -73.7949), // Flushing
    '115': MapCoordinates(40.7282, -73.7949), // Jamaica
    '116': MapCoordinates(40.7812, -73.8283), // Bayside
    '117': MapCoordinates(40.7812, -73.8283), // Long Island
    '118': MapCoordinates(40.6788, -73.4032), // Hicksville
    '119': MapCoordinates(40.7612, -73.1501), // Riverhead
    
    // Texas
    '750': MapCoordinates(32.7767, -96.7970), // Dallas
    '751': MapCoordinates(32.7767, -96.7970), // Dallas
    '752': MapCoordinates(32.7767, -96.7970), // Dallas
    '753': MapCoordinates(32.7767, -96.7970), // Dallas
    '754': MapCoordinates(32.7355, -97.1081), // Arlington
    '760': MapCoordinates(32.7555, -97.3308), // Fort Worth
    '761': MapCoordinates(32.7555, -97.3308), // Fort Worth
    '762': MapCoordinates(32.7555, -97.3308), // Fort Worth
    '770': MapCoordinates(29.7604, -95.3698), // Houston
    '771': MapCoordinates(29.7604, -95.3698), // Houston
    '772': MapCoordinates(29.7604, -95.3698), // Houston
    '773': MapCoordinates(29.7604, -95.3698), // Houston
    '774': MapCoordinates(29.7604, -95.3698), // Houston
    '775': MapCoordinates(29.7604, -95.3698), // Houston
    '776': MapCoordinates(30.2241, -93.2174), // Beaumont
    '777': MapCoordinates(30.0799, -94.1266), // Beaumont
    '778': MapCoordinates(27.8006, -97.3964), // Corpus Christi
    '779': MapCoordinates(27.5064, -99.5075), // Laredo
    '780': MapCoordinates(29.4241, -98.4936), // San Antonio
    '781': MapCoordinates(29.4241, -98.4936), // San Antonio
    '782': MapCoordinates(29.4241, -98.4936), // San Antonio
    '783': MapCoordinates(27.5064, -99.5075), // Laredo
    '784': MapCoordinates(26.2034, -98.2300), // McAllen
    '785': MapCoordinates(26.2034, -98.2300), // McAllen
    '786': MapCoordinates(30.2672, -97.7431), // Austin
    '787': MapCoordinates(30.2672, -97.7431), // Austin
    
    // Florida
    '320': MapCoordinates(30.3322, -81.6557), // Jacksonville
    '321': MapCoordinates(28.5383, -81.3792), // Orlando
    '322': MapCoordinates(30.3322, -81.6557), // Jacksonville
    '323': MapCoordinates(29.6516, -82.3248), // Gainesville
    '324': MapCoordinates(30.4383, -84.2807), // Tallahassee
    '325': MapCoordinates(30.4213, -87.2169), // Pensacola
    '326': MapCoordinates(29.6516, -82.3248), // Gainesville
    '327': MapCoordinates(28.5383, -81.3792), // Orlando
    '328': MapCoordinates(28.5383, -81.3792), // Orlando
    '329': MapCoordinates(28.0395, -81.9498), // Lakeland
    '330': MapCoordinates(25.7617, -80.1918), // Miami
    '331': MapCoordinates(25.7617, -80.1918), // Miami
    '332': MapCoordinates(25.7617, -80.1918), // Miami
    '333': MapCoordinates(26.1224, -80.1373), // Fort Lauderdale
    '334': MapCoordinates(26.7056, -80.0364), // West Palm Beach
    '335': MapCoordinates(27.9506, -82.4572), // Tampa
    '336': MapCoordinates(27.9506, -82.4572), // Tampa
    '337': MapCoordinates(27.3364, -82.5307), // Sarasota
    '338': MapCoordinates(28.0395, -81.9498), // Lakeland
    '339': MapCoordinates(26.1420, -81.7948), // Fort Myers
    '340': MapCoordinates(18.3358, -64.8963), // Virgin Islands
    '341': MapCoordinates(28.0395, -81.9498), // Kissimmee
    '342': MapCoordinates(28.0395, -81.9498), // Orlando
    '344': MapCoordinates(28.5383, -81.3792), // Melbourne
    '346': MapCoordinates(27.9506, -82.4572), // Tampa
    '347': MapCoordinates(28.8028, -82.5627), // Spring Hill
    
    // Illinois
    '600': MapCoordinates(41.8781, -87.6298), // Chicago
    '601': MapCoordinates(41.8781, -87.6298), // Chicago
    '602': MapCoordinates(41.8525, -87.6514), // Evanston
    '603': MapCoordinates(41.8525, -87.6514), // Oak Park
    '604': MapCoordinates(41.7508, -87.6889), // Cicero
    '605': MapCoordinates(41.8052, -87.8693), // Downers Grove
    '606': MapCoordinates(41.8781, -87.6298), // Chicago
    '607': MapCoordinates(41.8781, -87.6298), // Chicago
    '608': MapCoordinates(42.0451, -87.6877), // Waukegan
    '609': MapCoordinates(42.1083, -88.0340), // Kankakee
    '610': MapCoordinates(41.5250, -88.0817), // Joliet
    '611': MapCoordinates(41.4545, -90.5151), // Rock Island
    '612': MapCoordinates(41.4545, -90.5151), // Rock Island
    '613': MapCoordinates(40.1164, -88.2434), // Champaign
    '614': MapCoordinates(40.1164, -88.2434), // Champaign
    '615': MapCoordinates(40.6936, -89.5890), // Peoria
    '616': MapCoordinates(40.6936, -89.5890), // Peoria
    '617': MapCoordinates(40.1164, -88.2434), // Bloomington
    '618': MapCoordinates(40.1164, -88.2434), // Champaign
    '619': MapCoordinates(40.6936, -89.5890), // Peoria
    '620': MapCoordinates(39.7817, -89.6501), // Springfield
    '622': MapCoordinates(38.6270, -90.1994), // East St. Louis
    '623': MapCoordinates(38.5200, -89.0580), // Quincy
    '624': MapCoordinates(38.5200, -89.0580), // Effingham
    '625': MapCoordinates(39.7817, -89.6501), // Springfield
    '626': MapCoordinates(39.7817, -89.6501), // Springfield
    '627': MapCoordinates(39.7817, -89.6501), // Springfield
    '628': MapCoordinates(37.9870, -88.9448), // Carbondale
    '629': MapCoordinates(37.9870, -88.9448), // Carbondale
    
    // More states abbreviated...
    '021': MapCoordinates(42.3601, -71.0589), // Boston
    '022': MapCoordinates(42.3601, -71.0589), // Boston
    '023': MapCoordinates(42.2626, -71.8023), // Worcester
    '024': MapCoordinates(42.3601, -71.0589), // Boston
    '025': MapCoordinates(42.0834, -71.0183), // Brockton
    '026': MapCoordinates(41.9032, -71.0890), // Fall River
    '027': MapCoordinates(42.0834, -71.0183), // Brockton
    
    '191': MapCoordinates(39.9526, -75.1652), // Philadelphia
    '192': MapCoordinates(39.9526, -75.1652), // Philadelphia
    '193': MapCoordinates(39.9526, -75.1652), // Philadelphia
    '194': MapCoordinates(39.9526, -75.1652), // Philadelphia
    
    '200': MapCoordinates(38.9072, -77.0369), // Washington DC
    '201': MapCoordinates(38.9072, -77.0369), // Washington DC
    '202': MapCoordinates(38.9072, -77.0369), // Washington DC
    '203': MapCoordinates(38.9072, -77.0369), // Washington DC
    '204': MapCoordinates(38.9072, -77.0369), // Washington DC
    '205': MapCoordinates(38.9072, -77.0369), // Washington DC
    
    '303': MapCoordinates(33.7490, -84.3880), // Atlanta
    '304': MapCoordinates(33.7490, -84.3880), // Atlanta
    '305': MapCoordinates(33.7490, -84.3880), // Atlanta
    '306': MapCoordinates(33.7490, -84.3880), // Augusta
    
    '850': MapCoordinates(33.4484, -112.0740), // Phoenix
    '851': MapCoordinates(33.4484, -112.0740), // Phoenix
    '852': MapCoordinates(33.4484, -112.0740), // Phoenix
    '853': MapCoordinates(33.4484, -112.0740), // Phoenix
    '855': MapCoordinates(31.5493, -110.2277), // Globe
    '856': MapCoordinates(32.2226, -110.9747), // Tucson
    '857': MapCoordinates(32.2226, -110.9747), // Tucson
    
    '891': MapCoordinates(36.1699, -115.1398), // Las Vegas
    '889': MapCoordinates(36.1699, -115.1398), // Las Vegas
    '890': MapCoordinates(36.1699, -115.1398), // Las Vegas
    '894': MapCoordinates(39.5296, -119.8138), // Reno
    '895': MapCoordinates(39.5296, -119.8138), // Reno
    
    '980': MapCoordinates(47.6062, -122.3321), // Seattle
    '981': MapCoordinates(47.6062, -122.3321), // Seattle
    '982': MapCoordinates(47.6588, -117.4260), // Spokane
    '983': MapCoordinates(47.2529, -122.4443), // Tacoma
    '984': MapCoordinates(47.2529, -122.4443), // Tacoma
    '985': MapCoordinates(47.0379, -122.9007), // Olympia
    '986': MapCoordinates(46.0646, -118.3430), // Portland
    
    '802': MapCoordinates(39.7392, -104.9903), // Denver
    '803': MapCoordinates(39.7392, -104.9903), // Denver
    '804': MapCoordinates(39.7392, -104.9903), // Denver
    '805': MapCoordinates(39.7392, -104.9903), // Denver
    '806': MapCoordinates(39.7392, -104.9903), // Denver
    '807': MapCoordinates(40.5853, -105.0844), // Fort Collins
    '808': MapCoordinates(38.8339, -104.8214), // Colorado Springs
    '809': MapCoordinates(38.8339, -104.8214), // Colorado Springs
    
    '970': MapCoordinates(45.5152, -122.6784), // Portland OR
    '971': MapCoordinates(45.5152, -122.6784), // Portland OR
    '972': MapCoordinates(45.5152, -122.6784), // Portland OR
    '973': MapCoordinates(44.9429, -123.0351), // Salem OR
    '974': MapCoordinates(44.0521, -123.0868), // Eugene OR
    '975': MapCoordinates(42.3265, -122.8756), // Medford OR
    '976': MapCoordinates(44.0582, -121.3153), // Bend OR
    '977': MapCoordinates(43.6150, -116.2023), // Boise ID
    
    '461': MapCoordinates(39.7684, -86.1581), // Indianapolis
    '462': MapCoordinates(39.7684, -86.1581), // Indianapolis
    '463': MapCoordinates(39.7684, -86.1581), // Indianapolis
    '464': MapCoordinates(41.0814, -85.1394), // Fort Wayne
    '465': MapCoordinates(41.5868, -87.3471), // Gary
    '466': MapCoordinates(41.5868, -87.3471), // Gary
    '467': MapCoordinates(41.0814, -85.1394), // Fort Wayne
    '468': MapCoordinates(39.1637, -86.5264), // Bloomington IN
    '469': MapCoordinates(39.7684, -86.1581), // Kokomo
    
    '481': MapCoordinates(42.3314, -83.0458), // Detroit
    '482': MapCoordinates(42.3314, -83.0458), // Detroit
    '483': MapCoordinates(42.3314, -83.0458), // Detroit
    '484': MapCoordinates(43.0125, -83.6875), // Flint
    '485': MapCoordinates(43.0125, -83.6875), // Flint
    '486': MapCoordinates(43.4195, -83.9508), // Saginaw
    '487': MapCoordinates(43.4195, -83.9508), // Saginaw
    '488': MapCoordinates(42.9634, -85.6681), // Grand Rapids
    '489': MapCoordinates(42.9634, -85.6681), // Grand Rapids
    '490': MapCoordinates(42.2917, -85.5872), // Kalamazoo
    '491': MapCoordinates(42.2917, -85.5872), // Kalamazoo
    '492': MapCoordinates(42.2917, -85.5872), // Jackson
    '493': MapCoordinates(42.7325, -84.5555), // Lansing
    '494': MapCoordinates(42.7325, -84.5555), // Lansing
    '495': MapCoordinates(42.9634, -85.6681), // Grand Rapids
    '496': MapCoordinates(43.6615, -84.2472), // Traverse City
    '497': MapCoordinates(42.9634, -85.6681), // Grand Rapids
    '498': MapCoordinates(44.7631, -85.6206), // Traverse City
    '499': MapCoordinates(46.5436, -87.3954), // Marquette
  };
}

/// Simple coordinate class for map positioning
class MapCoordinates {
  final double latitude;
  final double longitude;
  
  const MapCoordinates(this.latitude, this.longitude);
}
