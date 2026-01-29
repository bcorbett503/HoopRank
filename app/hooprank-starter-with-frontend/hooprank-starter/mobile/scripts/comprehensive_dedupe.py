#!/usr/bin/env python3
"""
Comprehensive court deduplication:
1. Dedupe outdoor courts with same/similar name within 500m (keep one)
2. Remove outdoor courts when indoor gym exists for same location
3. Priority: Indoor gyms > Outdoor courts
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
    """Normalize name for comparison."""
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
    """Get significant tokens from a name."""
    if not name:
        return set()
    name = normalize_name(name)
    stopwords = {'the', 'a', 'an', 'of', 'at', 'in', 'and', '&'}
    tokens = set(name.split()) - stopwords
    return tokens

def names_are_similar(name1, name2, threshold=0.6):
    """Check if two names are similar using token overlap."""
    tokens1 = get_name_tokens(name1)
    tokens2 = get_name_tokens(name2)
    
    if not tokens1 or not tokens2:
        return False
    
    intersection = tokens1 & tokens2
    union = tokens1 | tokens2
    
    if not union:
        return False
    
    return len(intersection) / len(union) >= threshold

def load_outdoor_courts(filepath):
    """Load outdoor courts from JSON file."""
    with open(filepath, 'r') as f:
        return json.load(f)

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

def dedupe_outdoor_courts(courts, distance_threshold=500):
    """
    Dedupe outdoor courts with EXACT same name within distance_threshold.
    This catches multiple court surfaces at the same school.
    """
    # Group by exact name
    name_groups = defaultdict(list)
    for i, court in enumerate(courts):
        name = court.get('name', '')
        if name:
            name_groups[name].append((i, court))
    
    indices_to_remove = set()
    
    for name, courts_list in name_groups.items():
        if len(courts_list) > 1:
            # Keep the first one, remove others that are within distance
            kept_idx, kept_court = courts_list[0]
            
            for idx, court in courts_list[1:]:
                if idx in indices_to_remove:
                    continue
                
                dist = haversine_distance(
                    kept_court['lat'], kept_court['lng'],
                    court['lat'], court['lng']
                )
                
                if dist < distance_threshold:
                    indices_to_remove.add(idx)
    
    return indices_to_remove

def remove_outdoor_if_indoor_exists(outdoor_courts, indoor_gyms, distance_threshold=300):
    """
    Remove outdoor courts where an indoor gym exists for the same location.
    Uses fuzzy name matching.
    """
    # Build spatial index for indoor gyms
    indoor_buckets = defaultdict(list)
    for gym in indoor_gyms:
        bucket_lat = int(gym['lat'] * 100)
        bucket_lng = int(gym['lng'] * 100)
        for dlat in [-1, 0, 1]:
            for dlng in [-1, 0, 1]:
                indoor_buckets[(bucket_lat + dlat, bucket_lng + dlng)].append(gym)
    
    indices_to_remove = set()
    removed_examples = []
    
    for idx, court in enumerate(outdoor_courts):
        if idx in indices_to_remove:
            continue
        
        bucket_lat = int(court['lat'] * 100)
        bucket_lng = int(court['lng'] * 100)
        
        nearby_indoor = indoor_buckets.get((bucket_lat, bucket_lng), [])
        
        for gym in nearby_indoor:
            dist = haversine_distance(court['lat'], court['lng'], gym['lat'], gym['lng'])
            if dist < distance_threshold:
                # Check name similarity
                if names_are_similar(court['name'], gym['name'], threshold=0.5):
                    indices_to_remove.add(idx)
                    if len(removed_examples) < 20:
                        removed_examples.append({
                            'outdoor': court['name'],
                            'indoor': gym['name'],
                            'distance': dist
                        })
                    break
    
    return indices_to_remove, removed_examples

def main():
    outdoor_file = '/Users/brettcorbett/.gemini/antigravity/playground/electric-planetary/HoopRank/app/hooprank-starter-with-frontend/hooprank-starter/mobile/assets/data/courts_named.json'
    courts_file = '/Users/brettcorbett/.gemini/antigravity/playground/electric-planetary/HoopRank/app/hooprank-starter-with-frontend/hooprank-starter/mobile/assets/data/courts.json'
    indoor_file = '/Users/brettcorbett/.gemini/antigravity/playground/electric-planetary/HoopRank/app/hooprank-starter-with-frontend/hooprank-starter/mobile/lib/services/indoor_gyms_data.dart'
    
    print("=" * 60)
    print("COMPREHENSIVE COURT DEDUPLICATION")
    print("=" * 60)
    
    print("\nLoading data...")
    outdoor_courts = load_outdoor_courts(outdoor_file)
    print(f"  Outdoor courts: {len(outdoor_courts)}")
    
    indoor_gyms = parse_indoor_gyms(indoor_file)
    print(f"  Indoor gyms: {len(indoor_gyms)}")
    
    # Step 1: Dedupe outdoor courts with same name
    print("\n" + "-" * 60)
    print("STEP 1: Deduplicating outdoor courts with EXACT same name within 500m")
    print("-" * 60)
    
    same_name_indices = dedupe_outdoor_courts(outdoor_courts, distance_threshold=500)
    print(f"  Found {len(same_name_indices)} duplicate outdoor courts to remove")
    
    # Step 2: Remove outdoor courts where indoor gym exists
    print("\n" + "-" * 60)
    print("STEP 2: Removing outdoor courts where indoor gym exists (within 300m, similar name)")
    print("-" * 60)
    
    indoor_priority_indices, examples = remove_outdoor_if_indoor_exists(
        outdoor_courts, indoor_gyms, distance_threshold=300
    )
    print(f"  Found {len(indoor_priority_indices)} outdoor courts that duplicate indoor gyms")
    
    if examples:
        print("\n  Sample removals:")
        for ex in examples[:10]:
            print(f"    Outdoor: '{ex['outdoor']}' -> Indoor: '{ex['indoor']}' ({ex['distance']:.0f}m)")
    
    # Combine all indices to remove
    all_indices_to_remove = same_name_indices | indoor_priority_indices
    print(f"\n  Total outdoor courts to remove: {len(all_indices_to_remove)}")
    
    # Create deduplicated list
    deduped_outdoor = [court for i, court in enumerate(outdoor_courts) if i not in all_indices_to_remove]
    print(f"\n  Outdoor courts after deduplication: {len(deduped_outdoor)}")
    
    # Write back to files
    print("\n" + "-" * 60)
    print("STEP 3: Writing deduplicated data")
    print("-" * 60)
    
    print(f"  Writing to {outdoor_file}...")
    with open(outdoor_file, 'w') as f:
        json.dump(deduped_outdoor, f)
    
    print(f"  Writing to {courts_file}...")
    with open(courts_file, 'w') as f:
        json.dump(deduped_outdoor, f)
    
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"  Original outdoor courts: {len(outdoor_courts)}")
    print(f"  Same-name duplicates removed: {len(same_name_indices)}")
    print(f"  Indoor-priority removals: {len(indoor_priority_indices)}")
    print(f"  Total removed: {len(all_indices_to_remove)}")
    print(f"  Final outdoor courts: {len(deduped_outdoor)}")
    print(f"  Indoor gyms: {len(indoor_gyms)}")
    print(f"  TOTAL COURTS: {len(deduped_outdoor) + len(indoor_gyms)}")
    print("=" * 60)
    
    return len(outdoor_courts), len(deduped_outdoor), len(all_indices_to_remove)

if __name__ == "__main__":
    main()
