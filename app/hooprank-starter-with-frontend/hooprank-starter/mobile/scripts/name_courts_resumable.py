#!/usr/bin/env python3
"""
HoopRank Court Naming Script (Resumable Version)

Reads mock_courts_data.dart and generates meaningful names for generic "Basketball Court" entries
using reverse geocoding. Saves progress incrementally so it can resume if interrupted.

Usage:
  python name_courts_resumable.py --input mock_courts_data.dart --output named_courts_data.dart
"""

import argparse
import json
import os
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

# Progress file to enable resuming
PROGRESS_FILE = "/tmp/court_naming_progress.json"

def load_progress() -> Dict:
    """Load progress from file if it exists."""
    if os.path.exists(PROGRESS_FILE):
        try:
            with open(PROGRESS_FILE, "r") as f:
                return json.load(f)
        except:
            pass
    return {"completed": {}, "last_index": 0}

def save_progress(progress: Dict):
    """Save progress to file."""
    with open(PROGRESS_FILE, "w") as f:
        json.dump(progress, f)

def round_coords(lat: float, lng: float, precision: int = 3) -> Tuple[float, float]:
    """Round coordinates for caching."""
    return (round(lat, precision), round(lng, precision))

def reverse_geocode(lat: float, lng: float) -> Optional[Dict]:
    """Reverse geocode coordinates to get location info."""
    try:
        params = {
            "lat": lat,
            "lon": lng,
            "format": "json",
            "zoom": 16,
            "addressdetails": 1,
        }
        headers = {
            "User-Agent": "HoopRank-CourtNamer/1.0 (brett@hooprank.app)"
        }
        response = requests.get(NOMINATIM_URL, params=params, headers=headers, timeout=10)
        if response.status_code == 200:
            return response.json()
    except Exception as e:
        pass
    return None

def generate_court_name(lat: float, lng: float, coord_cache: Dict) -> Optional[str]:
    """Generate a meaningful court name from coordinates."""
    cache_key = f"{round(lat, 3)},{round(lng, 3)}"
    if cache_key in coord_cache:
        return coord_cache[cache_key]
    
    time.sleep(RATE_LIMIT_SECONDS)
    
    geo_data = reverse_geocode(lat, lng)
    if not geo_data or "address" not in geo_data:
        return None
    
    addr = geo_data.get("address", {})
    
    # Priority order for name sources
    if park := addr.get("park"):
        name = f"{park} Court"
    elif playground := addr.get("playground"):
        name = f"{playground} Court"
    elif rec := addr.get("recreation_ground"):
        name = f"{rec} Court"
    elif school := addr.get("school"):
        name = f"{school} Basketball Court"
    elif university := addr.get("university"):
        name = f"{university} Court"
    elif neighbourhood := (addr.get("neighbourhood") or addr.get("suburb") or addr.get("quarter")):
        suffixes = ["Court", "Hoops", "Courts", "Park Court", "Playground"]
        name = f"{neighbourhood} {random.choice(suffixes)}"
    elif road := addr.get("road"):
        road_clean = road.replace(" Street", " St").replace(" Avenue", " Ave").replace(" Boulevard", " Blvd")
        suffixes = ["Court", "Hoops", "Courts", "Park Court", "Playground"]
        name = f"{road_clean} {random.choice(suffixes)}"
    elif city := (addr.get("city") or addr.get("town") or addr.get("village")):
        name = f"{city} Public Court"
    else:
        return None
    
    coord_cache[cache_key] = name
    return name


def parse_dart_courts(content: str) -> list:
    """Parse Dart mock_courts_data.dart and extract court entries."""
    pattern = r"\{\s*'id':\s*'([^']+)',\s*'name':\s*'([^']*)',\s*'lat':\s*([\d.-]+),\s*'lng':\s*([\d.-]+),?(?:\s*'[^']*':\s*'[^']*',?)*\s*\}"
    
    courts = []
    for match in re.finditer(pattern, content, re.DOTALL):
        courts.append({
            "id": match.group(1),
            "name": match.group(2),
            "lat": float(match.group(3)),
            "lng": float(match.group(4)),
            "full_match": match.group(0),
        })
    return courts


def main():
    parser = argparse.ArgumentParser(description="Name generic basketball courts (resumable)")
    parser.add_argument("--input", required=True, help="Input Dart file")
    parser.add_argument("--output", required=True, help="Output Dart file")
    parser.add_argument("--batch-size", type=int, default=500, help="Save progress every N courts")
    parser.add_argument("--reset", action="store_true", help="Reset progress and start fresh")
    args = parser.parse_args()
    
    # Load or reset progress
    if args.reset and os.path.exists(PROGRESS_FILE):
        os.remove(PROGRESS_FILE)
        print("Progress reset.")
    
    progress = load_progress()
    coord_cache = progress.get("completed", {})
    start_index = progress.get("last_index", 0)
    
    print(f"Reading {args.input}..."); sys.stdout.flush()
    with open(args.input, "r") as f:
        content = f.read()
    
    courts = parse_dart_courts(content)
    print(f"Found {len(courts):,} courts"); sys.stdout.flush()
    
    # Filter to only "Basketball Court" entries
    generic_courts = [c for c in courts if c["name"] == "Basketball Court"]
    print(f"  - Generic 'Basketball Court': {len(generic_courts):,}"); sys.stdout.flush()
    
    if start_index > 0:
        print(f"  - Resuming from index {start_index} ({len(coord_cache)} already named)"); sys.stdout.flush()
    
    renamed_count = len(coord_cache)
    replacements = []
    
    # Generate names for remaining courts
    for i in range(start_index, len(generic_courts)):
        court = generic_courts[i]
        
        if i % 100 == 0:
            print(f"  Progress: {i:,}/{len(generic_courts):,} ({renamed_count} renamed)"); sys.stdout.flush()
        
        # Save progress periodically
        if i > 0 and i % args.batch_size == 0:
            progress["completed"] = coord_cache
            progress["last_index"] = i
            save_progress(progress)
            print(f"  [saved progress at {i}]"); sys.stdout.flush()
        
        new_name = generate_court_name(court["lat"], court["lng"], coord_cache)
        
        if new_name:
            renamed_count += 1
            replacements.append((court["id"], court["full_match"], new_name))
    
    # Final save
    progress["completed"] = coord_cache
    progress["last_index"] = len(generic_courts)
    save_progress(progress)
    
    print(f"\nTotal renamed: {renamed_count:,}/{len(generic_courts):,}"); sys.stdout.flush()
    
    # Apply replacements to content
    print(f"Writing to {args.output}..."); sys.stdout.flush()
    new_content = content
    for court_id, old_entry, new_name in replacements:
        new_entry = old_entry.replace("'name': 'Basketball Court'", f"'name': '{new_name}'")
        new_content = new_content.replace(old_entry, new_entry, 1)
    
    with open(args.output, "w") as f:
        f.write(new_content)
    
    print(f"[done] Wrote {args.output}"); sys.stdout.flush()


if __name__ == "__main__":
    main()
