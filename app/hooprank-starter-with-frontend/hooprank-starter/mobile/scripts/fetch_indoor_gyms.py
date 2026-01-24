#!/usr/bin/env python3
"""
Fetch indoor basketball venues from OpenStreetMap Overpass API.

This script queries OSM for:
- College/university gyms and recreation centers
- High school and middle school gyms
- Athletic clubs with indoor basketball
- Recreation centers and community centers with basketball

Usage:
    python3 fetch_indoor_gyms.py [--region REGION] [--output OUTPUT]

Options:
    --region    Geographic region (default: "usa" for continental US)
    --output    Output file path (default: indoor_gyms_data.dart)
"""

import argparse
import json
import requests
import time
from typing import List, Dict, Optional

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# Bounding boxes for different regions
REGIONS = {
    "bay_area": (36.9, -123.0, 38.5, -121.5),  # SF Bay Area
    "california": (32.5, -124.5, 42.0, -114.0),  # California
    "usa": (24.0, -125.0, 49.5, -66.5),  # Continental US
    "world": None,  # No bounds - worldwide
}

# Categories to search
VENUE_TYPES = [
    # Schools with potential gyms
    ("amenity", "school"),
    ("amenity", "college"),
    ("amenity", "university"),
    
    # Sports facilities
    ("leisure", "sports_centre"),
    ("leisure", "sports_hall"),
    ("leisure", "fitness_centre"),
    
    # Community/recreation centers
    ("amenity", "community_centre"),
    ("leisure", "recreation_ground"),
    
    # Specific buildings
    ("building", "sports_hall"),
    ("building", "gymnasium"),
]


def build_overpass_query(bbox: tuple = None, venue_type: tuple = None, limit: int = 5000) -> str:
    """Build Overpass QL query for a specific venue type."""
    if bbox:
        south, west, north, east = bbox
        bbox_str = f"({south},{west},{north},{east})"
    else:
        bbox_str = ""
    
    key, value = venue_type
    
    query = f"""
[out:json][timeout:300];
(
  node["{key}"="{value}"]{bbox_str};
  way["{key}"="{value}"]{bbox_str};
  relation["{key}"="{value}"]{bbox_str};
);
out center {limit};
"""
    return query


def fetch_venues_batch(region: str, venue_type: tuple) -> List[Dict]:
    """Fetch venues of a specific type from OSM Overpass API."""
    bbox = REGIONS.get(region)
    query = build_overpass_query(bbox, venue_type, limit=10000)
    
    key, value = venue_type
    print(f"  Fetching {key}={value}...")
    
    try:
        response = requests.post(
            OVERPASS_URL,
            data={"data": query},
            timeout=600
        )
        response.raise_for_status()
        data = response.json()
    except requests.exceptions.RequestException as e:
        print(f"    Error: {e}")
        return []
    
    venues = []
    elements = data.get("elements", [])
    print(f"    Found {len(elements)} raw elements")
    
    for element in elements:
        venue = process_element(element, key, value)
        if venue:
            venues.append(venue)
    
    return venues


def process_element(element: Dict, key: str, value: str) -> Optional[Dict]:
    """Process a single OSM element into a venue dict."""
    # Get coordinates
    if element.get("type") == "node":
        lat = element.get("lat")
        lng = element.get("lon")
    else:
        center = element.get("center", {})
        lat = center.get("lat")
        lng = center.get("lon")
    
    if lat is None or lng is None:
        return None
    
    tags = element.get("tags", {})
    name = tags.get("name")
    
    if not name:
        # Skip unnamed venues for schools (they're too generic)
        if value in ["school", "college", "university"]:
            return None
        name = f"Unknown {value.replace('_', ' ').title()}"
    
    # Determine venue category
    if value in ["school"]:
        # Try to identify if it's a high school or middle school
        name_lower = name.lower()
        if "high" in name_lower or "secondary" in name_lower:
            category = "high_school"
        elif "middle" in name_lower or "junior" in name_lower:
            category = "middle_school"
        elif "elementary" in name_lower or "primary" in name_lower:
            # Skip elementary schools - unlikely to have public courts
            return None
        else:
            category = "school"
    elif value in ["college", "university"]:
        category = "college"
    elif value in ["sports_centre", "sports_hall", "fitness_centre"]:
        category = "athletic_club"
    elif value in ["community_centre", "recreation_ground"]:
        category = "recreation_center"
    elif value in ["gymnasium"]:
        category = "gym"
    else:
        category = "other"
    
    # Build address
    address_parts = []
    if tags.get("addr:housenumber"):
        address_parts.append(tags.get("addr:housenumber"))
    if tags.get("addr:street"):
        address_parts.append(tags.get("addr:street"))
    if tags.get("addr:city"):
        address_parts.append(tags.get("addr:city"))
    if tags.get("addr:state"):
        address_parts.append(tags.get("addr:state"))
    
    return {
        "id": f"gym_{element.get('id')}",
        "name": name,
        "lat": round(lat, 6),
        "lng": round(lng, 6),
        "category": category,
        "osm_type": f"{key}={value}",
        "address": ", ".join(address_parts) if address_parts else None,
        "city": tags.get("addr:city"),
        "state": tags.get("addr:state"),
        "website": tags.get("website"),
        "phone": tags.get("phone"),
        "opening_hours": tags.get("opening_hours"),
        "operator": tags.get("operator"),
        "indoor": True,  # These are all indoor venues
    }


def fetch_all_venues(region: str = "usa") -> List[Dict]:
    """Fetch all venue types and deduplicate."""
    print(f"\nFetching indoor basketball venues for region: {region}")
    print(f"Bounding box: {REGIONS.get(region)}\n")
    
    all_venues = []
    seen_ids = set()
    
    for venue_type in VENUE_TYPES:
        venues = fetch_venues_batch(region, venue_type)
        
        # Deduplicate by ID
        for venue in venues:
            if venue["id"] not in seen_ids:
                seen_ids.add(venue["id"])
                all_venues.append(venue)
        
        # Rate limiting - be nice to the API
        time.sleep(2)
    
    print(f"\nTotal unique venues: {len(all_venues)}")
    
    # Categorize counts
    categories = {}
    for venue in all_venues:
        cat = venue.get("category", "other")
        categories[cat] = categories.get(cat, 0) + 1
    
    print("\nBy category:")
    for cat, count in sorted(categories.items()):
        print(f"  {cat}: {count}")
    
    return all_venues


def generate_dart_file(venues: List[Dict], output_path: str):
    """Generate Dart file with venue data."""
    dart_content = '''// AUTO-GENERATED FILE - DO NOT EDIT MANUALLY
// Generated from OpenStreetMap data
// Attribution: © OpenStreetMap contributors (ODbL)
// Contains: Indoor basketball venues (schools, athletic clubs, rec centers)

/// Indoor basketball venue data from OpenStreetMap
final List<Map<String, dynamic>> indoorGymsData = [
'''
    
    for venue in venues:
        dart_content += f'''  {{
    'id': '{venue["id"]}',
    'name': {repr(venue["name"])},
    'lat': {venue["lat"]},
    'lng': {venue["lng"]},
    'category': '{venue["category"]}',
    'indoor': true,
'''
        if venue.get("address"):
            dart_content += f"    'address': {repr(venue['address'])},\n"
        if venue.get("city"):
            dart_content += f"    'city': {repr(venue['city'])},\n"
        if venue.get("state"):
            dart_content += f"    'state': {repr(venue['state'])},\n"
        if venue.get("website"):
            dart_content += f"    'website': {repr(venue['website'])},\n"
        if venue.get("phone"):
            dart_content += f"    'phone': {repr(venue['phone'])},\n"
        dart_content += "  },\n"
    
    dart_content += "];\n"
    
    with open(output_path, "w") as f:
        f.write(dart_content)
    
    print(f"\nGenerated {output_path} with {len(venues)} venues")


def generate_json_file(venues: List[Dict], output_path: str):
    """Generate JSON file for inspection/backup."""
    json_path = output_path.replace('.dart', '.json')
    with open(json_path, "w") as f:
        json.dump(venues, f, indent=2)
    print(f"Generated {json_path} for backup")


def main():
    parser = argparse.ArgumentParser(description="Fetch indoor basketball venues from OSM")
    parser.add_argument(
        "--region",
        default="usa",
        choices=list(REGIONS.keys()),
        help="Geographic region to fetch"
    )
    parser.add_argument(
        "--output",
        default="../lib/services/indoor_gyms_data.dart",
        help="Output Dart file path"
    )
    args = parser.parse_args()
    
    venues = fetch_all_venues(args.region)
    
    if venues:
        generate_dart_file(venues, args.output)
        generate_json_file(venues, args.output)
        print(f"\n✅ Success! Fetched {len(venues)} indoor venues for {args.region}")
    else:
        print("❌ No venues found or error occurred")


if __name__ == "__main__":
    main()
