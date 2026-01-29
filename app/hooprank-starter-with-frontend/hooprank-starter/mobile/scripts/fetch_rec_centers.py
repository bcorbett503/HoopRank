#!/usr/bin/env python3
"""
Fetch recreation centers with basketball courts from OpenStreetMap Overpass API.
This queries for:
- leisure=sports_centre with basketball tags
- amenity=community_centre 
- leisure=recreation_ground
- Buildings tagged as recreation centers
"""

import requests
import json
import time

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# Query for recreation centers in the US that might have basketball
# We query in chunks by region to avoid timeout
REGIONS = {
    'california_north': (36.0, -125.0, 42.0, -119.0),
    'california_south': (32.0, -121.0, 36.0, -114.0),
    'pacific_nw': (42.0, -125.0, 49.0, -116.0),
    'mountain': (31.0, -117.0, 49.0, -102.0),
    'texas': (25.0, -107.0, 37.0, -93.0),
    'midwest_north': (40.0, -97.0, 49.0, -82.0),
    'midwest_south': (33.0, -97.0, 40.0, -82.0),
    'southeast': (24.0, -92.0, 37.0, -75.0),
    'northeast': (37.0, -82.0, 45.0, -66.0),
    'new_england': (40.0, -74.0, 47.5, -66.0),
}

def query_rec_centers(bbox, region_name):
    """Query Overpass API for recreation centers with potential basketball facilities."""
    south, west, north, east = bbox
    
    # This query finds:
    # 1. Sports centres with basketball
    # 2. Community centres
    # 3. Recreation grounds with buildings
    # 4. Any place tagged with recreation_center
    query = f"""
    [out:json][timeout:120];
    (
      // Sports centres
      way["leisure"="sports_centre"]["sport"~"basketball|multi"](
        {south},{west},{north},{east}
      );
      node["leisure"="sports_centre"]["sport"~"basketball|multi"](
        {south},{west},{north},{east}
      );
      
      // Community centres (often have gyms)
      way["amenity"="community_centre"](
        {south},{west},{north},{east}
      );
      node["amenity"="community_centre"](
        {south},{west},{north},{east}
      );
      
      // Recreation centers specifically
      way["leisure"="recreation_ground"]["building"](
        {south},{west},{north},{east}
      );
      node["amenity"="recreation_center"](
        {south},{west},{north},{east}
      );
      way["amenity"="recreation_center"](
        {south},{west},{north},{east}
      );
      
      // Buildings tagged as recreation
      way["building"="civic"]["leisure"="sports_centre"](
        {south},{west},{north},{east}
      );
      
      // Parks department facilities
      way["leisure"="sports_centre"]["operator"~"[Pp]arks|[Rr]ecreation"](
        {south},{west},{north},{east}
      );
    );
    out center;
    """
    
    print(f"  Querying {region_name}...")
    try:
        response = requests.post(OVERPASS_URL, data={'data': query}, timeout=180)
        if response.status_code == 200:
            data = response.json()
            elements = data.get('elements', [])
            print(f"    Found {len(elements)} potential rec centers")
            return elements
        else:
            print(f"    Error: HTTP {response.status_code}")
            return []
    except Exception as e:
        print(f"    Error: {e}")
        return []

def extract_rec_centers(elements):
    """Extract recreation center info from Overpass API results."""
    centers = []
    
    for elem in elements:
        tags = elem.get('tags', {})
        name = tags.get('name', '')
        
        # Skip if no name
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
        
        # Create unique ID
        elem_id = f"osm_{elem['type']}_{elem['id']}"
        
        centers.append({
            'id': elem_id,
            'name': name,
            'lat': round(lat, 6),
            'lng': round(lng, 6),
            'category': 'recreation_center',
            'tags': tags  # Keep for filtering later
        })
    
    return centers

def main():
    print("=== Fetching Recreation Centers with Basketball Courts ===\n")
    
    all_centers = []
    
    for region_name, bbox in REGIONS.items():
        elements = query_rec_centers(bbox, region_name)
        centers = extract_rec_centers(elements)
        all_centers.extend(centers)
        time.sleep(2)  # Be nice to the API
    
    # Deduplicate by name + approximate location
    seen = set()
    unique_centers = []
    for c in all_centers:
        key = (c['name'].lower(), round(c['lat'], 2), round(c['lng'], 2))
        if key not in seen:
            seen.add(key)
            unique_centers.append(c)
    
    print(f"\n=== Found {len(unique_centers)} unique recreation centers ===\n")
    
    # Filter to those most likely to have basketball courts
    basketball_indicators = [
        'recreation', 'rec center', 'community center', 'sports center',
        'athletic', 'gym', 'ymca', 'ywca', 'jcc', 'field house',
        'boys & girls', 'parks and rec', 'parks & rec'
    ]
    
    filtered = []
    for c in unique_centers:
        name_lower = c['name'].lower()
        tags = c.get('tags', {})
        sport = tags.get('sport', '')
        
        # Include if name suggests rec center or has basketball tag
        if any(ind in name_lower for ind in basketball_indicators):
            filtered.append(c)
        elif 'basketball' in sport or 'multi' in sport:
            filtered.append(c)
        elif 'recreation' in name_lower or 'community' in name_lower:
            filtered.append(c)
    
    print(f"Filtered to {len(filtered)} likely basketball venues\n")
    
    # Save to JSON for review
    output = [{'id': c['id'], 'name': c['name'], 'lat': c['lat'], 'lng': c['lng'], 'category': c['category']} 
              for c in filtered]
    
    with open('rec_centers_found.json', 'w') as f:
        json.dump(output, f, indent=2)
    
    print(f"Saved to rec_centers_found.json")
    
    # Print sample
    print("\nSample of found recreation centers:")
    for c in filtered[:20]:
        print(f"  - {c['name']} ({c['lat']}, {c['lng']})")
    
    return filtered

if __name__ == '__main__':
    main()
