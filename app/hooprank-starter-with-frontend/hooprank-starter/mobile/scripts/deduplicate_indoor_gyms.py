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
    
    # Find all gym entries - each starts with { and ends with },
    # Match the opening brace, any content up to 'id': 'value', 'name': 'value', 'lat': num, 'lng': num
    gyms = []
    
    # Split by entries - each entry starts with { and ends with },
    entries = re.split(r'\n  \{\n', content)
    
    for entry in entries[1:]:  # Skip first (header)
        try:
            # Extract id
            id_match = re.search(r"'id':\s*'([^']+)'", entry)
            name_match = re.search(r"'name':\s*'([^']*)'", entry)
            lat_match = re.search(r"'lat':\s*([\d.-]+)", entry)
            lng_match = re.search(r"'lng':\s*([\d.-]+)", entry)
            category_match = re.search(r"'category':\s*'([^']+)'", entry)
            
            if id_match and name_match and lat_match and lng_match:
                gyms.append({
                    'id': id_match.group(1),
                    'name': name_match.group(1),
                    'lat': float(lat_match.group(1)),
                    'lng': float(lng_match.group(1)),
                    'category': category_match.group(1) if category_match else 'other',
                    'raw_entry': entry  # Keep original for reconstruction
                })
        except Exception as e:
            pass  # Skip malformed entries
    
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
