#!/usr/bin/env python3
"""
Fetch basketball courts from OpenStreetMap Overpass API.

This script queries OSM for basketball courts worldwide and generates
a Dart file with court data for the HoopRank app.

Usage:
    python3 fetch_osm_courts.py [--region REGION] [--output OUTPUT]

Options:
    --region    Geographic region (default: "usa" for continental US)
                Options: "usa", "bay_area", "california", "world"
    --output    Output file path (default: mock_courts_data.dart)
"""

import argparse
import json
import requests
import time
from typing import List, Dict

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# Bounding boxes for different regions
REGIONS = {
    "bay_area": (36.9, -123.0, 38.5, -121.5),  # SF Bay Area
    "california": (32.5, -124.5, 42.0, -114.0),  # California
    "usa": (24.0, -125.0, 49.5, -66.5),  # Continental US
    "world": None,  # No bounds - worldwide (warning: huge dataset)
}


def build_overpass_query(bbox: tuple = None, limit: int = 10000) -> str:
    """Build Overpass QL query for basketball courts."""
    if bbox:
        south, west, north, east = bbox
        bbox_str = f"({south},{west},{north},{east})"
    else:
        bbox_str = ""
    
    # Query for basketball courts (leisure=pitch + sport=basketball)
    query = f"""
[out:json][timeout:300];
(
  node["leisure"="pitch"]["sport"="basketball"]{bbox_str};
  way["leisure"="pitch"]["sport"="basketball"]{bbox_str};
  relation["leisure"="pitch"]["sport"="basketball"]{bbox_str};
);
out center {limit};
"""
    return query


def fetch_courts(region: str = "bay_area") -> List[Dict]:
    """Fetch basketball courts from OSM Overpass API."""
    bbox = REGIONS.get(region)
    query = build_overpass_query(bbox, limit=50000 if region == "usa" else 10000)
    
    print(f"Fetching courts for region: {region}")
    print(f"Bounding box: {bbox}")
    print(f"Query:\n{query}\n")
    
    try:
        response = requests.post(
            OVERPASS_URL,
            data={"data": query},
            timeout=600  # 10 minute timeout for large queries
        )
        response.raise_for_status()
        data = response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error fetching data: {e}")
        return []
    
    courts = []
    elements = data.get("elements", [])
    print(f"Found {len(elements)} elements")
    
    for element in elements:
        # Get coordinates (nodes have lat/lon directly, ways/relations have center)
        if element.get("type") == "node":
            lat = element.get("lat")
            lng = element.get("lon")
        else:
            center = element.get("center", {})
            lat = center.get("lat")
            lng = center.get("lon")
        
        if lat is None or lng is None:
            continue
        
        tags = element.get("tags", {})
        
        # Build court name from tags
        name = tags.get("name")
        if not name:
            # Try to build a name from related tags
            leisure_name = tags.get("leisure:name")
            sport_name = tags.get("sport:name")
            operator = tags.get("operator")
            
            if leisure_name:
                name = leisure_name
            elif sport_name:
                name = sport_name
            elif operator:
                name = f"{operator} Court"
            else:
                name = "Basketball Court"
        
        # Get address info if available
        address_parts = []
        if tags.get("addr:housenumber"):
            address_parts.append(tags.get("addr:housenumber"))
        if tags.get("addr:street"):
            address_parts.append(tags.get("addr:street"))
        if tags.get("addr:city"):
            address_parts.append(tags.get("addr:city"))
        
        address = ", ".join(address_parts) if address_parts else None
        
        # Use city from tags or leave as None
        city = tags.get("addr:city")
        
        court = {
            "id": f"osm_{element.get('id')}",
            "name": name,
            "lat": lat,
            "lng": lng,
            "address": address,
            "city": city,
            "surface": tags.get("surface"),
            "access": tags.get("access"),
            "lit": tags.get("lit") == "yes",
            "indoor": tags.get("indoor") == "yes",
        }
        courts.append(court)
    
    print(f"Processed {len(courts)} courts with valid coordinates")
    return courts


def generate_dart_file(courts: List[Dict], output_path: str):
    """Generate Dart file with court data."""
    dart_content = '''// AUTO-GENERATED FILE - DO NOT EDIT MANUALLY
// Generated from OpenStreetMap data
// Attribution: © OpenStreetMap contributors (ODbL)

/// Basketball court data from OpenStreetMap
/// Tag: leisure=pitch + sport=basketball
final List<Map<String, dynamic>> mockCourtsData = [
'''
    
    for court in courts:
        dart_content += f'''  {{
    'id': '{court["id"]}',
    'name': {repr(court["name"])},
    'lat': {court["lat"]},
    'lng': {court["lng"]},
'''
        if court.get("address"):
            dart_content += f"    'address': {repr(court['address'])},\n"
        if court.get("city"):
            dart_content += f"    'city': {repr(court['city'])},\n"
        dart_content += "  },\n"
    
    dart_content += "];\n"
    
    with open(output_path, "w") as f:
        f.write(dart_content)
    
    print(f"Generated {output_path} with {len(courts)} courts")


def main():
    parser = argparse.ArgumentParser(description="Fetch basketball courts from OSM")
    parser.add_argument(
        "--region",
        default="bay_area",
        choices=list(REGIONS.keys()),
        help="Geographic region to fetch"
    )
    parser.add_argument(
        "--output",
        default="lib/services/mock_courts_data.dart",
        help="Output Dart file path"
    )
    args = parser.parse_args()
    
    courts = fetch_courts(args.region)
    
    if courts:
        generate_dart_file(courts, args.output)
        print(f"\nSuccess! Fetched {len(courts)} courts for {args.region}")
    else:
        print("No courts found or error occurred")


if __name__ == "__main__":
    main()
