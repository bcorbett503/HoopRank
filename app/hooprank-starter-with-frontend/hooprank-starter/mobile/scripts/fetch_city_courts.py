#!/usr/bin/env python3
"""
Fetch verified recreation centers for top basketball cities from OpenStreetMap.
This does targeted queries city by city to avoid API timeouts.
"""

import requests
import json
import time

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# Top basketball cities with their bounding boxes (south, west, north, east)
BASKETBALL_CITIES = {
    'NYC': (40.4774, -74.2591, 40.9176, -73.7004),
    'Los_Angeles': (33.7037, -118.6682, 34.3373, -118.1553),
    'Chicago': (41.6445, -87.9401, 42.0230, -87.5240),
    'Philadelphia': (39.8670, -75.2803, 40.1379, -74.9558),
    'Detroit': (42.2551, -83.2877, 42.4504, -82.9104),
    'Washington_DC': (38.7916, -77.1198, 38.9959, -76.9094),
    'Atlanta': (33.6479, -84.5514, 33.8868, -84.2895),
    'Houston': (29.5224, -95.6980, 30.1107, -95.0146),
    'Indianapolis': (39.6320, -86.3280, 39.9270, -85.9370),
    'Oakland_SF': (37.6879, -122.5300, 37.9298, -122.1142),
}

def query_city_rec_centers(city_name, bbox):
    """Query a single city for recreation centers and basketball facilities."""
    south, west, north, east = bbox
    
    query = f"""
    [out:json][timeout:60];
    (
      // Recreation centers
      node["leisure"="sports_centre"](
        {south},{west},{north},{east}
      );
      way["leisure"="sports_centre"](
        {south},{west},{north},{east}
      );
      
      // Community centres
      node["amenity"="community_centre"](
        {south},{west},{north},{east}
      );
      way["amenity"="community_centre"](
        {south},{west},{north},{east}
      );
      
      // Recreation grounds with buildings
      way["leisure"="recreation_ground"](
        {south},{west},{north},{east}
      );
      
      // YMCA/YWCA
      node["name"~"YMCA|YWCA|JCC",i](
        {south},{west},{north},{east}
      );
      way["name"~"YMCA|YWCA|JCC",i](
        {south},{west},{north},{east}
      );
      
      // Basketball courts
      node["sport"="basketball"](
        {south},{west},{north},{east}
      );
      way["sport"="basketball"](
        {south},{west},{north},{east}
      );
    );
    out center;
    """
    
    print(f"Querying {city_name}...")
    try:
        response = requests.post(OVERPASS_URL, data={'data': query}, timeout=90)
        if response.status_code == 200:
            data = response.json()
            elements = data.get('elements', [])
            print(f"  Found {len(elements)} facilities")
            return elements
        else:
            print(f"  Error: HTTP {response.status_code}")
            return []
    except Exception as e:
        print(f"  Error: {e}")
        return []

def extract_facilities(elements, city_name):
    """Extract facility info from API results."""
    facilities = []
    
    for elem in elements:
        tags = elem.get('tags', {})
        name = tags.get('name', '')
        
        if not name:
            continue
        
        # Get coordinates
        if elem['type'] == 'node':
            lat = elem['lat']
            lng = elem['lon']
        elif 'center' in elem:
            lat = elem['center']['lat']
            lng = elem['center']['lon']
        else:
            continue
        
        # Determine if indoor
        sport = tags.get('sport', '')
        leisure = tags.get('leisure', '')
        amenity = tags.get('amenity', '')
        building = tags.get('building', '')
        
        is_indoor = (
            building != '' or
            'gym' in name.lower() or
            'center' in name.lower() or
            'centre' in name.lower() or
            amenity == 'community_centre' or
            leisure == 'sports_centre'
        )
        
        # Determine category
        if 'ymca' in name.lower() or 'ywca' in name.lower():
            category = 'athletic_club'
        elif 'jcc' in name.lower():
            category = 'recreation_center'
        elif amenity == 'community_centre':
            category = 'recreation_center'
        elif leisure == 'sports_centre':
            category = 'athletic_club'
        elif sport == 'basketball':
            category = 'recreation_center'
        else:
            category = 'recreation_center'
        
        facilities.append({
            'id': f"osm_{city_name.lower()}_{elem['id']}",
            'name': name,
            'lat': round(lat, 6),
            'lng': round(lng, 6),
            'city': city_name,
            'category': category,
            'indoor': is_indoor,
            'address': tags.get('addr:street', ''),
            'sport': sport,
        })
    
    return facilities

def main():
    print("=== Fetching Basketball Facilities for Top Cities ===\n")
    
    all_facilities = {}
    
    for city_name, bbox in BASKETBALL_CITIES.items():
        elements = query_city_rec_centers(city_name, bbox)
        facilities = extract_facilities(elements, city_name)
        all_facilities[city_name] = facilities
        time.sleep(3)  # Be nice to the API
    
    # Save results
    with open('city_facilities.json', 'w') as f:
        json.dump(all_facilities, f, indent=2)
    
    print("\n=== Summary ===")
    total = 0
    for city, facilities in all_facilities.items():
        indoor_count = len([f for f in facilities if f['indoor']])
        total += len(facilities)
        print(f"{city}: {len(facilities)} facilities ({indoor_count} indoor)")
    
    print(f"\nTotal: {total} facilities")
    print("Saved to city_facilities.json")
    
    # Print sample for each city
    print("\n=== Sample Facilities ===")
    for city, facilities in all_facilities.items():
        print(f"\n{city}:")
        for f in facilities[:5]:
            indoor_str = "INDOOR" if f['indoor'] else "outdoor"
            print(f"  - {f['name']} ({indoor_str})")

if __name__ == '__main__':
    main()
