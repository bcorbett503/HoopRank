#!/usr/bin/env python3
"""
Cross-source deduplication: Remove indoor gyms that are duplicates of outdoor courts.
Uses fuzzy name matching and proximity to identify duplicates.
"""

import json
import re
import math
from collections import defaultdict

def haversine_distance(lat1, lng1, lat2, lng2):
    """Calculate distance between two points in meters."""
    R = 6371000
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lng = math.radians(lng2 - lng1)
    a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lng/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c

def normalize_name(name):
    """Normalize name for comparison - remove common suffixes and clean up."""
    if not name:
        return ""
    name = name.lower().strip()
    # Remove common suffixes
    suffixes = [' courts', ' court', ' gym', ' gymnasium', ' field', ' fields', 
                ' playground', ' park', ' recreation center', ' rec center']
    for suffix in suffixes:
        if name.endswith(suffix):
            name = name[:-len(suffix)]
    return ' '.join(name.split())

def get_name_tokens(name):
    """Get significant tokens from a name for fuzzy matching."""
    if not name:
        return set()
    name = normalize_name(name)
    # Remove very common words
    stopwords = {'the', 'a', 'an', 'of', 'at', 'in', 'and', '&'}
    tokens = set(name.split()) - stopwords
    return tokens

def names_are_similar(name1, name2, threshold=0.6):
    """Check if two names are similar enough using token overlap."""
    tokens1 = get_name_tokens(name1)
    tokens2 = get_name_tokens(name2)
    
    if not tokens1 or not tokens2:
        return False
    
    # Calculate Jaccard similarity
    intersection = tokens1 & tokens2
    union = tokens1 | tokens2
    
    if not union:
        return False
    
    similarity = len(intersection) / len(union)
    return similarity >= threshold

def load_outdoor_courts(filepath):
    """Load outdoor courts from JSON file."""
    with open(filepath, 'r') as f:
        data = json.load(f)
    courts = []
    for court in data:
        if court.get('name') and court.get('lat') and court.get('lng'):
            courts.append({
                'id': court.get('id', ''),
                'name': court['name'],
                'lat': float(court['lat']),
                'lng': float(court['lng']),
            })
    return courts

def parse_indoor_gyms(filepath):
    """Parse the Dart file to extract gym entries."""
    with open(filepath, 'r') as f:
        content = f.read()
    
    gyms = []
    entry_pattern = re.compile(
        r"\{\s*\n"
        r"\s*'id':\s*'([^']+)',\s*\n"
        r"\s*'name':\s*'([^']*)',\s*\n"
        r"\s*'lat':\s*([\d.-]+),\s*\n"
        r"\s*'lng':\s*([\d.-]+),\s*\n"
        r"\s*'category':\s*'([^']+)',\s*\n"
        r"\s*'indoor':\s*true,\s*\n"
        r"\s*\}",
        re.MULTILINE
    )
    
    for match in entry_pattern.finditer(content):
        gyms.append({
            'id': match.group(1),
            'name': match.group(2),
            'lat': float(match.group(3)),
            'lng': float(match.group(4)),
            'category': match.group(5),
        })
    return gyms

def generate_dart_file(gyms, output_path):
    """Generate the Dart file with deduplicated data."""
    lines = [
        "// AUTO-GENERATED FILE - DO NOT EDIT MANUALLY",
        "// Generated from OpenStreetMap data",
        "// Attribution: © OpenStreetMap contributors (ODbL)",
        "// Contains: Indoor basketball venues (schools, athletic clubs, rec centers)",
        "// DEDUPLICATED: Removed duplicates within 100m of same name + cross-source duplicates",
        "",
        "/// Indoor basketball venue data from OpenStreetMap",
        "final List<Map<String, dynamic>> indoorGymsData = [",
    ]
    
    for gym in gyms:
        name = gym['name'].replace("'", "\\'")
        entry = f"  {{\n    'id': '{gym['id']}',\n    'name': '{name}',\n    'lat': {gym['lat']},\n    'lng': {gym['lng']},\n    'category': '{gym['category']}',\n    'indoor': true,\n  }},"
        lines.append(entry)
    
    lines.append("];")
    
    with open(output_path, 'w') as f:
        f.write('\n'.join(lines))

def main():
    outdoor_file = '/Users/brettcorbett/.gemini/antigravity/playground/electric-planetary/HoopRank/app/hooprank-starter-with-frontend/hooprank-starter/mobile/assets/data/courts_named.json'
    indoor_file = '/Users/brettcorbett/.gemini/antigravity/playground/electric-planetary/HoopRank/app/hooprank-starter-with-frontend/hooprank-starter/mobile/lib/services/indoor_gyms_data.dart'
    
    print("Loading outdoor courts...")
    outdoor_courts = load_outdoor_courts(outdoor_file)
    print(f"  Loaded {len(outdoor_courts)} outdoor courts")
    
    print("\nLoading indoor gyms...")
    indoor_gyms = parse_indoor_gyms(indoor_file)
    print(f"  Loaded {len(indoor_gyms)} indoor gyms")
    
    # Build spatial index for outdoor courts (bucket by approximate lat/lng)
    # Use 0.01 degree buckets (~1km)
    outdoor_buckets = defaultdict(list)
    for court in outdoor_courts:
        bucket_lat = int(court['lat'] * 100)
        bucket_lng = int(court['lng'] * 100)
        for dlat in [-1, 0, 1]:
            for dlng in [-1, 0, 1]:
                outdoor_buckets[(bucket_lat + dlat, bucket_lng + dlng)].append(court)
    
    print("\nFinding cross-source duplicates (indoor gyms matching outdoor courts)...")
    duplicates_found = []
    indices_to_remove = set()
    
    for idx, gym in enumerate(indoor_gyms):
        if idx in indices_to_remove:
            continue
        
        bucket_lat = int(gym['lat'] * 100)
        bucket_lng = int(gym['lng'] * 100)
        
        nearby_outdoor = outdoor_buckets.get((bucket_lat, bucket_lng), [])
        
        for court in nearby_outdoor:
            # Check distance first (fast rejection)
            dist = haversine_distance(gym['lat'], gym['lng'], court['lat'], court['lng'])
            if dist < 200:  # Within 200 meters
                # Check name similarity
                if names_are_similar(gym['name'], court['name'], threshold=0.5):
                    indices_to_remove.add(idx)
                    duplicates_found.append({
                        'indoor': gym['name'],
                        'outdoor': court['name'],
                        'distance': dist
                    })
                    break
    
    print(f"\nDuplicates found: {len(duplicates_found)}")
    
    if duplicates_found:
        print("\nSample duplicates (first 20):")
        for dup in duplicates_found[:20]:
            print(f"  Indoor: '{dup['indoor']}' <-> Outdoor: '{dup['outdoor']}' ({dup['distance']:.0f}m)")
    
    # Create deduplicated list
    deduped_gyms = [gym for i, gym in enumerate(indoor_gyms) if i not in indices_to_remove]
    print(f"\nIndoor gyms after cross-source deduplication: {len(deduped_gyms)}")
    
    # Write back
    print(f"\nWriting deduplicated data back to {indoor_file}...")
    generate_dart_file(deduped_gyms, indoor_file)
    print("Done!")
    
    return len(indoor_gyms), len(deduped_gyms), len(indices_to_remove)

if __name__ == "__main__":
    main()
