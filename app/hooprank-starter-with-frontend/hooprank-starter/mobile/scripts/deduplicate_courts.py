#!/usr/bin/env python3
"""
Script to identify and remove duplicate courts from the JSON files.
Duplicates are defined as courts with:
1. Same or very similar name (case-insensitive)
2. Within 100 meters of each other geographically
"""

import json
import math
from collections import defaultdict

def haversine_distance(lat1, lng1, lat2, lng2):
    """Calculate distance between two points in meters."""
    R = 6371000  # Earth's radius in meters
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lng = math.radians(lng2 - lng1)
    
    a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lng/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    return R * c

def normalize_name(name):
    """Normalize court name for comparison."""
    if not name:
        return ""
    # Lowercase, remove extra whitespace
    return ' '.join(name.lower().strip().split())

def find_duplicates(courts, distance_threshold=100):
    """
    Find duplicate courts based on name similarity and geographic proximity.
    Returns: list of (original_index, duplicate_index, distance) tuples
    """
    # Group by normalized name
    name_groups = defaultdict(list)
    for i, court in enumerate(courts):
        name = normalize_name(court.get('name', ''))
        if name:
            name_groups[name].append((i, court))
    
    duplicates = []
    
    # Find duplicates within each name group
    for name, courts_with_indices in name_groups.items():
        if len(courts_with_indices) > 1:
            # Check all pairs
            for i, (idx1, court1) in enumerate(courts_with_indices):
                for idx2, court2 in courts_with_indices[i+1:]:
                    lat1, lng1 = court1.get('lat'), court1.get('lng')
                    lat2, lng2 = court2.get('lat'), court2.get('lng')
                    
                    if lat1 and lng1 and lat2 and lng2:
                        dist = haversine_distance(lat1, lng1, lat2, lng2)
                        if dist < distance_threshold:
                            duplicates.append((idx1, idx2, dist, name))
    
    return duplicates

def main():
    # Load courts
    input_file = '/Users/brettcorbett/.gemini/antigravity/playground/electric-planetary/HoopRank/app/hooprank-starter-with-frontend/hooprank-starter/mobile/assets/data/courts_named.json'
    
    print(f"Loading courts from {input_file}...")
    with open(input_file, 'r') as f:
        courts = json.load(f)
    
    print(f"Total courts: {len(courts)}")
    
    # Find duplicates
    print("\nFinding duplicates (same name within 100m)...")
    duplicates = find_duplicates(courts)
    
    print(f"\nFound {len(duplicates)} duplicate pairs")
    
    # Show sample duplicates
    print("\nSample duplicates (first 20):")
    for idx1, idx2, dist, name in duplicates[:20]:
        court1 = courts[idx1]
        court2 = courts[idx2]
        print(f"  '{name}' - {dist:.1f}m apart")
        print(f"    ({court1.get('lat')}, {court1.get('lng')})")
        print(f"    ({court2.get('lat')}, {court2.get('lng')})")
    
    # Collect all indices to remove (keep the first occurrence, remove subsequent)
    indices_to_remove = set()
    for idx1, idx2, dist, name in duplicates:
        # Keep idx1 (first occurrence), remove idx2
        indices_to_remove.add(idx2)
    
    print(f"\nTotal courts to remove: {len(indices_to_remove)}")
    
    # Create deduplicated list
    deduped_courts = [court for i, court in enumerate(courts) if i not in indices_to_remove]
    
    print(f"Courts after deduplication: {len(deduped_courts)}")
    
    # Save deduplicated courts
    output_file = input_file.replace('.json', '_deduped.json')
    with open(output_file, 'w') as f:
        json.dump(deduped_courts, f)
    
    print(f"\nSaved deduplicated courts to: {output_file}")
    
    # Also update the original files
    print("\nTo apply changes to original files, run:")
    print(f"  cp {output_file} {input_file}")
    print(f"  cp {output_file} {input_file.replace('courts_named.json', 'courts.json')}")
    
    return len(courts), len(deduped_courts), len(indices_to_remove)

if __name__ == "__main__":
    main()
