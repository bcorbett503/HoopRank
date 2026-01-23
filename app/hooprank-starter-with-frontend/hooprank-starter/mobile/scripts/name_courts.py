#!/usr/bin/env python3
"""
HoopRank Court Naming Script

Reads mock_courts_data.dart and generates meaningful names for generic "Basketball Court" entries
using reverse geocoding to derive neighborhood/street/park names from coordinates.

Usage:
  python name_courts.py --input mock_courts_data.dart --output named_courts_data.dart
  python name_courts.py --input mock_courts_data.dart --output named_courts_data.dart --limit 1000
"""

import argparse
import re
import sys
import time
import random
from typing import Optional, Dict, Tuple
import requests

# Free geocoding API - Nominatim (OpenStreetMap)
NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse"

# Rate limiting for Nominatim (1 request per second)
RATE_LIMIT_SECONDS = 1.1

# Cache to avoid duplicate API calls for nearby coordinates
coord_cache: Dict[Tuple[float, float], str] = {}

def round_coords(lat: float, lng: float, precision: int = 3) -> Tuple[float, float]:
    """Round coordinates for caching (nearby courts get same name prefix)."""
    return (round(lat, precision), round(lng, precision))

def reverse_geocode(lat: float, lng: float) -> Optional[Dict]:
    """
    Reverse geocode coordinates to get location info.
    Returns dict with neighbourhood, suburb, city, road, etc.
    """
    try:
        params = {
            "lat": lat,
            "lon": lng,
            "format": "json",
            "zoom": 16,  # Neighbourhood level
            "addressdetails": 1,
        }
        headers = {
            "User-Agent": "HoopRank-CourtNamer/1.0 (brett@hooprank.app)"
        }
        response = requests.get(NOMINATIM_URL, params=params, headers=headers, timeout=10)
        if response.status_code == 200:
            return response.json()
    except Exception as e:
        print(f"  [warn] Geocode failed for ({lat}, {lng}): {e}")
    return None

def generate_court_name(lat: float, lng: float, original_name: str = "Basketball Court") -> str:
    """
    Generate a meaningful court name from coordinates.
    Returns names like "Mission District Court", "Oak Park Hoops", etc.
    """
    # Check cache first
    cache_key = round_coords(lat, lng)
    if cache_key in coord_cache:
        return coord_cache[cache_key]
    
    # Rate limit
    time.sleep(RATE_LIMIT_SECONDS)
    
    geo_data = reverse_geocode(lat, lng)
    if not geo_data or "address" not in geo_data:
        return original_name
    
    addr = geo_data.get("address", {})
    
    # Try to find a good name source in priority order
    name_candidates = []
    
    # 1. Park or playground name (best source)
    if park := addr.get("park"):
        name = f"{park} Court"
        coord_cache[cache_key] = name
        return name
    
    if playground := addr.get("playground"):
        name = f"{playground} Court"
        coord_cache[cache_key] = name
        return name
    
    # 2. Recreation ground or sports centre
    if rec := addr.get("recreation_ground"):
        name = f"{rec} Court"
        coord_cache[cache_key] = name
        return name
    
    # 3. School or university (for campus courts)
    if school := addr.get("school"):
        name = f"{school} Basketball Court"
        coord_cache[cache_key] = name
        return name
    
    if university := addr.get("university"):
        name = f"{university} Court"
        coord_cache[cache_key] = name
        return name
    
    # 4. Neighbourhood + descriptor
    neighbourhood = addr.get("neighbourhood") or addr.get("suburb") or addr.get("quarter")
    city = addr.get("city") or addr.get("town") or addr.get("village") or addr.get("municipality")
    road = addr.get("road")
    
    # Suffixes to make names interesting
    suffixes = ["Court", "Hoops", "Courts", "Park Court", "Playground"]
    suffix = random.choice(suffixes)
    
    if neighbourhood:
        name = f"{neighbourhood} {suffix}"
        coord_cache[cache_key] = name
        return name
    
    # 5. Road + descriptor
    if road:
        # Clean up road name
        road_clean = road.replace(" Street", " St").replace(" Avenue", " Ave").replace(" Boulevard", " Blvd")
        name = f"{road_clean} {suffix}"
        coord_cache[cache_key] = name
        return name
    
    # 6. City-level fallback
    if city:
        name = f"{city} Public Court"
        coord_cache[cache_key] = name
        return name
    
    # No luck - keep original
    return original_name


def parse_dart_courts(content: str) -> list:
    """
    Parse Dart mock_courts_data.dart and extract court entries.
    Returns list of dicts with id, name, lat, lng, and the original text block.
    
    Handles multi-line format like:
      {
        'id': 'osm_123',
        'name': 'Basketball Court',
        'lat': 37.123,
        'lng': -122.456,
      },
    """
    # Match each court entry block (multi-line, with optional fields)
    pattern = r"\{\s*'id':\s*'([^']+)',\s*'name':\s*'([^']*)',\s*'lat':\s*([\d.-]+),\s*'lng':\s*([\d.-]+),?(?:\s*'[^']*':\s*'[^']*',?)*\s*\}"
    
    courts = []
    for match in re.finditer(pattern, content, re.DOTALL):
        courts.append({
            "id": match.group(1),
            "name": match.group(2),
            "lat": float(match.group(3)),
            "lng": float(match.group(4)),
            "full_match": match.group(0),
            "start": match.start(),
            "end": match.end(),
        })
    return courts


def main():
    parser = argparse.ArgumentParser(description="Name generic basketball courts using reverse geocoding")
    parser.add_argument("--input", required=True, help="Input Dart file (mock_courts_data.dart)")
    parser.add_argument("--output", required=True, help="Output Dart file with named courts")
    parser.add_argument("--limit", type=int, default=0, help="Limit number of courts to process (0 = all)")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without writing")
    args = parser.parse_args()
    
    print(f"Reading {args.input}..."); sys.stdout.flush()
    with open(args.input, "r") as f:
        content = f.read()
    
    courts = parse_dart_courts(content)
    print(f"Found {len(courts):,} courts"); sys.stdout.flush()
    
    # Filter to only "Basketball Court" entries
    generic_courts = [c for c in courts if c["name"] == "Basketball Court"]
    print(f"  - Generic 'Basketball Court': {len(generic_courts):,}"); sys.stdout.flush()
    
    if args.limit > 0:
        generic_courts = generic_courts[:args.limit]
        print(f"  - Processing first {args.limit} courts")
    
    # Generate names
    renamed = 0
    replacements = []
    
    for i, court in enumerate(generic_courts):
        if i % 100 == 0:
            print(f"  Progress: {i:,}/{len(generic_courts):,} ({renamed} renamed)")
            sys.stdout.flush()
        
        new_name = generate_court_name(court["lat"], court["lng"], court["name"])
        
        if new_name != court["name"]:
            renamed += 1
            old_entry = court["full_match"]
            new_entry = old_entry.replace(f"'name': 'Basketball Court'", f"'name': '{new_name}'")
            replacements.append((old_entry, new_entry))
            
            if args.dry_run and renamed <= 10:
                print(f"    [{court['id']}] ({court['lat']:.4f}, {court['lng']:.4f})")
                print(f"      -> {new_name}")
    
    print(f"\nTotal renamed: {renamed:,}/{len(generic_courts):,}")
    
    if args.dry_run:
        print("\n[DRY RUN] No files written.")
        return
    
    # Apply replacements
    print(f"Writing to {args.output}...")
    new_content = content
    for old, new in replacements:
        new_content = new_content.replace(old, new, 1)
    
    with open(args.output, "w") as f:
        f.write(new_content)
    
    print(f"[done] Wrote {args.output}")


if __name__ == "__main__":
    main()
