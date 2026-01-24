#!/usr/bin/env python3
"""
Apply named courts from progress cache to mock_courts_data.dart.
This allows loading partial results while the main script is still running.
"""

import json
import re
import sys

PROGRESS_FILE = "/tmp/court_naming_progress.json"
INPUT_FILE = "/Users/brettcorbett/.gemini/antigravity/playground/electric-planetary/HoopRank/app/hooprank-starter-with-frontend/hooprank-starter/mobile/lib/services/mock_courts_data.dart"
OUTPUT_FILE = "/Users/brettcorbett/.gemini/antigravity/playground/electric-planetary/HoopRank/app/hooprank-starter-with-frontend/hooprank-starter/mobile/lib/services/mock_courts_data.dart"

def main():
    # Load progress
    print(f"Loading progress from {PROGRESS_FILE}...")
    with open(PROGRESS_FILE, "r") as f:
        progress = json.load(f)
    
    coord_cache = progress.get("completed", {})
    print(f"Found {len(coord_cache)} named courts in cache")
    
    if len(coord_cache) == 0:
        print("No named courts to apply")
        return
    
    # Load input file
    print(f"Reading {INPUT_FILE}...")
    with open(INPUT_FILE, "r") as f:
        content = f.read()
    
    # Count generic courts before
    before_count = content.count("'name': 'Basketball Court'")
    print(f"Generic 'Basketball Court' entries before: {before_count:,}")
    
    # Pattern to find court entries with coordinates
    pattern = r"\{\s*'id':\s*'([^']+)',\s*'name':\s*'Basketball Court',\s*'lat':\s*([\d.-]+),\s*'lng':\s*([\d.-]+)"
    
    def replace_name(match):
        court_id = match.group(1)
        lat = float(match.group(2))
        lng = float(match.group(3))
        
        # Check cache with rounded coords
        cache_key = f"{round(lat, 3)},{round(lng, 3)}"
        if cache_key in coord_cache:
            new_name = coord_cache[cache_key]
            # Escape single quotes in name
            new_name = new_name.replace("'", "\\'")
            return f"{{'id': '{court_id}', 'name': '{new_name}', 'lat': {lat}, 'lng': {lng}"
        return match.group(0)
    
    # Apply replacements
    print("Applying named courts...")
    new_content = re.sub(pattern, replace_name, content)
    
    # Count generic courts after
    after_count = new_content.count("'name': 'Basketball Court'")
    renamed = before_count - after_count
    print(f"Renamed {renamed:,} courts")
    print(f"Generic 'Basketball Court' entries after: {after_count:,}")
    
    # Write output
    print(f"Writing to {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, "w") as f:
        f.write(new_content)
    
    print("Done!")

if __name__ == "__main__":
    main()
