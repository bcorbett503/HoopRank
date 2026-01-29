#!/usr/bin/env python3
"""
Script to identify and remove duplicate indoor gyms from the Dart data file.
"""

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
    if not name:
        return ""
    return ' '.join(name.lower().strip().split())

def parse_dart_file(filepath):
    """Parse the Dart file to extract gym entries."""
    with open(filepath, 'r') as f:
        content = f.read()
    
    gyms = []
    
    # Find the list content between [ and ];
    list_start = content.find("indoorGymsData = [")
    if list_start == -1:
        print("ERROR: Could not find indoorGymsData list in file")
        return gyms
    
    list_content = content[list_start:]
    
    # Use a more robust regex to find each entry block
    # Match { followed by content until }, on its own line
    entry_pattern = re.compile(
        r"\{\s*\n"                           # Opening brace
        r"\s*'id':\s*'([^']+)',\s*\n"        # id
        r"\s*'name':\s*'([^']*)',\s*\n"      # name (can be empty)
        r"\s*'lat':\s*([\d.-]+),\s*\n"       # lat
        r"\s*'lng':\s*([\d.-]+),\s*\n"       # lng
        r"\s*'category':\s*'([^']+)',\s*\n"  # category
        r"\s*'indoor':\s*true,\s*\n"         # indoor
        r"\s*\}",                             # Closing brace
        re.MULTILINE
    )
    
    for match in entry_pattern.finditer(list_content):
        try:
            gym = {
                'id': match.group(1),
                'name': match.group(2),
                'lat': float(match.group(3)),
                'lng': float(match.group(4)),
                'category': match.group(5),
            }
            gyms.append(gym)
        except Exception as e:
            print(f"Error parsing entry: {e}")
    
    return gyms

def find_duplicates(gyms, distance_threshold=100):
    """Find duplicate gyms based on name similarity and geographic proximity."""
    name_groups = defaultdict(list)
    for i, gym in enumerate(gyms):
        name = normalize_name(gym.get('name', ''))
        if name:
            name_groups[name].append((i, gym))
    
    indices_to_remove = set()
    duplicate_pairs = 0
    
    for name, gyms_with_indices in name_groups.items():
        if len(gyms_with_indices) > 1:
            # Keep first, check others
            for i, (idx1, gym1) in enumerate(gyms_with_indices):
                if idx1 in indices_to_remove:
                    continue
                for idx2, gym2 in gyms_with_indices[i+1:]:
                    if idx2 in indices_to_remove:
                        continue
                    lat1, lng1 = gym1.get('lat'), gym1.get('lng')
                    lat2, lng2 = gym2.get('lat'), gym2.get('lng')
                    if lat1 and lng1 and lat2 and lng2:
                        dist = haversine_distance(lat1, lng1, lat2, lng2)
                        if dist < distance_threshold:
                            indices_to_remove.add(idx2)
                            duplicate_pairs += 1
    
    return indices_to_remove, duplicate_pairs

def generate_dart_file(gyms, output_path):
    """Generate the Dart file with deduplicated data."""
    lines = [
        "// AUTO-GENERATED FILE - DO NOT EDIT MANUALLY",
        "// Generated from OpenStreetMap data",
        "// Attribution: © OpenStreetMap contributors (ODbL)",
        "// Contains: Indoor basketball venues (schools, athletic clubs, rec centers)",
        "// DEDUPLICATED: Removed duplicates within 100m of same name",
        "",
        "/// Indoor basketball venue data from OpenStreetMap",
        "final List<Map<String, dynamic>> indoorGymsData = [",
    ]
    
    for gym in gyms:
        # Escape single quotes in name
        name = gym['name'].replace("'", "\\'")
        entry = f"  {{\n    'id': '{gym['id']}',\n    'name': '{name}',\n    'lat': {gym['lat']},\n    'lng': {gym['lng']},\n    'category': '{gym['category']}',\n    'indoor': true,\n  }},"
        lines.append(entry)
    
    lines.append("];")
    
    with open(output_path, 'w') as f:
        f.write('\n'.join(lines))

def main():
    input_file = '/Users/brettcorbett/.gemini/antigravity/playground/electric-planetary/HoopRank/app/hooprank-starter-with-frontend/hooprank-starter/mobile/lib/services/indoor_gyms_data.dart'
    
    print(f"Parsing indoor gyms data from {input_file}...")
    gyms = parse_dart_file(input_file)
    print(f"Total indoor gyms: {len(gyms)}")
    
    if len(gyms) == 0:
        print("ERROR: Failed to parse any gyms! Aborting...")
        return 0, 0, 0
    
    print("\nFinding duplicates (same name within 100m)...")
    indices_to_remove, duplicate_pairs = find_duplicates(gyms)
    print(f"Duplicate pairs found: {duplicate_pairs}")
    print(f"Gyms to remove: {len(indices_to_remove)}")
    
    # Create deduplicated list
    deduped_gyms = [gym for i, gym in enumerate(gyms) if i not in indices_to_remove]
    print(f"Gyms after deduplication: {len(deduped_gyms)}")
    
    # Overwrite the original file
    print(f"\nWriting deduplicated data back to {input_file}...")
    generate_dart_file(deduped_gyms, input_file)
    print("Done!")
    
    return len(gyms), len(deduped_gyms), len(indices_to_remove)

if __name__ == "__main__":
    main()
