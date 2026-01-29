#!/usr/bin/env python3
"""
Remove false positive indoor venues that don't have basketball courts.
Uses name patterns to identify non-basketball facilities.
"""

import re
from collections import Counter, defaultdict

def parse_indoor_gyms(filepath):
    """Parse the Dart file to extract gym entries."""
    with open(filepath, 'r') as f:
        content = f.read()
    
    entry_pattern = re.compile(
        r"\{\s*\n\s*'id':\s*'([^']+)',\s*\n\s*'name':\s*'([^']*)',\s*\n\s*'lat':\s*([\d.-]+),\s*\n\s*'lng':\s*([\d.-]+),\s*\n\s*'category':\s*'([^']+)',\s*\n\s*'indoor':\s*true,\s*\n\s*\}",
        re.MULTILINE
    )
    
    entries = []
    for match in entry_pattern.finditer(content):
        entries.append({
            'id': match.group(1),
            'name': match.group(2),
            'lat': float(match.group(3)),
            'lng': float(match.group(4)),
            'category': match.group(5),
        })
    return entries

def is_false_positive(name, category):
    """
    Determine if a venue is likely a false positive (no basketball court).
    Returns (is_false_positive, reason) tuple.
    """
    name_lower = name.lower()
    
    # Schools are generally legitimate - they have gyms
    if category in ['school', 'high_school', 'middle_school', 'college']:
        # But some school-tagged entries aren't actually schools
        non_school_keywords = [
            'yoga', 'pilates', 'crossfit', 'orangetheory', 'f45 training',
            'pure barre', 'curves', 'martial arts academy', 'karate academy',
            'dance studio', 'ballet school', 'montessori',
        ]
        for kw in non_school_keywords:
            if kw in name_lower:
                return True, kw
        return False, None
    
    # For athletic_club and recreation_center, check more carefully
    
    # Definite false positives - these never have basketball courts
    definite_false = [
        # Yoga/Pilates/Barre studios
        ('yoga', 'yoga studio'),
        ('pilates', 'pilates studio'),
        ('pure barre', 'barre studio'),
        ('barre studio', 'barre studio'),
        ('barre fitness', 'barre studio'),
        
        # Boutique fitness
        ('orangetheory', 'Orangetheory'),
        ('orange theory', 'Orangetheory'),
        ('f45 training', 'F45'),
        ('f45 fitness', 'F45'),
        ('crossfit', 'CrossFit'),
        ('cross fit', 'CrossFit'),
        ('curves for women', 'Curves'),
        ('soul cycle', 'SoulCycle'),
        ('soulcycle', 'SoulCycle'),
        ('spin studio', 'spin studio'),
        ('cycling studio', 'cycling studio'),
        ('cycle bar', 'CycleBar'),
        ('cyclebar', 'CycleBar'),
        
        # Martial arts
        ('martial arts academy', 'martial arts'),
        ('karate academy', 'karate'),
        ('karate school', 'karate'),
        ('tae kwon do', 'taekwondo'),
        ('taekwondo', 'taekwondo'),
        ('jiu jitsu', 'jiu jitsu'),
        ('judo club', 'judo'),
        ('aikido', 'aikido'),
        ('kung fu', 'kung fu'),
        ('boxing gym', 'boxing'),
        ('boxing club', 'boxing'),
        ('mma gym', 'MMA'),
        
        # Dance
        ('dance studio', 'dance studio'),
        ('dance academy', 'dance studio'),
        ('ballet school', 'ballet'),
        ('ballet academy', 'ballet'),
        
        # Swimming only
        ('swim center', 'swim center'),
        ('swim club', 'swim club'),
        ('swimming pool', 'swimming pool'),
        ('aquatic center', 'aquatic center'),
        ('aquatic centre', 'aquatic center'),
        ('natatorium', 'natatorium'),
        
        # Senior centers (usually no basketball)
        ('senior center', 'senior center'),
        ('senior centre', 'senior center'),
        ('seniors center', 'senior center'),
        
        # Golf/Tennis only
        ('golf course', 'golf'),
        ('golf club', 'golf'),
        ('tennis club', 'tennis only'),
        ('tennis center', 'tennis only'),
        ('racquet club', 'racquet club'),
        ('racket club', 'racquet club'),
        
        # Medical/Rehab
        ('physical therapy', 'physical therapy'),
        ('rehabilitation center', 'rehab'),
        ('chiropractic', 'chiropractic'),
        
        # Other non-basketball
        ('weight watchers', 'weight watchers'),
        ('jenny craig', 'weight loss'),
    ]
    
    for keyword, reason in definite_false:
        if keyword in name_lower:
            return True, reason
    
    return False, None

def write_dart_file(entries, filepath, header_comment=""):
    """Write entries back to Dart file format."""
    lines = [
        "// AUTO-GENERATED FILE - DO NOT EDIT MANUALLY",
        "// Generated from OpenStreetMap data",
        "// Attribution: © OpenStreetMap contributors (ODbL)",
        "// Contains: Indoor basketball venues (schools, athletic clubs, rec centers)",
        "// FILTERED: Removed non-basketball venues (yoga, CrossFit, etc.)",
        "",
        "/// Indoor basketball venue data from OpenStreetMap",
        "final List<Map<String, dynamic>> indoorGymsData = [",
    ]
    
    for e in entries:
        # Escape single quotes in name
        name = e['name'].replace("'", "\\'")
        lines.append(f"  {{")
        lines.append(f"    'id': '{e['id']}',")
        lines.append(f"    'name': '{name}',")
        lines.append(f"    'lat': {e['lat']},")
        lines.append(f"    'lng': {e['lng']},")
        lines.append(f"    'category': '{e['category']}',")
        lines.append(f"    'indoor': true,")
        lines.append(f"  }},")
    
    lines.append("];")
    
    with open(filepath, 'w') as f:
        f.write('\n'.join(lines))

def main():
    input_file = '/Users/brettcorbett/.gemini/antigravity/playground/electric-planetary/HoopRank/app/hooprank-starter-with-frontend/hooprank-starter/mobile/lib/services/indoor_gyms_data.dart'
    
    print("=" * 60)
    print("INDOOR VENUE FALSE POSITIVE REMOVAL")
    print("=" * 60)
    
    print("\nParsing indoor gyms data...")
    entries = parse_indoor_gyms(input_file)
    print(f"  Total entries: {len(entries)}")
    
    # Categorize entries
    false_positives = []
    valid_entries = []
    removal_reasons = Counter()
    
    for e in entries:
        is_fp, reason = is_false_positive(e['name'], e['category'])
        if is_fp:
            false_positives.append((e, reason))
            removal_reasons[reason] += 1
        else:
            valid_entries.append(e)
    
    print(f"\n  False positives identified: {len(false_positives)}")
    print(f"  Valid entries remaining: {len(valid_entries)}")
    
    print("\n" + "-" * 60)
    print("REMOVAL BREAKDOWN BY REASON")
    print("-" * 60)
    for reason, count in removal_reasons.most_common(20):
        print(f"  {reason}: {count}")
    
    print("\n" + "-" * 60)
    print("SAMPLE REMOVALS")
    print("-" * 60)
    by_reason = defaultdict(list)
    for e, reason in false_positives:
        by_reason[reason].append(e['name'])
    
    for reason in list(removal_reasons.keys())[:10]:
        print(f"\n  {reason}:")
        for name in by_reason[reason][:5]:
            print(f"    - {name}")
    
    # Write filtered data
    print("\n" + "-" * 60)
    print("WRITING FILTERED DATA")
    print("-" * 60)
    
    write_dart_file(valid_entries, input_file)
    print(f"  Wrote {len(valid_entries)} entries to {input_file}")
    
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"  Original entries: {len(entries)}")
    print(f"  Removed (false positives): {len(false_positives)}")
    print(f"  Remaining (valid): {len(valid_entries)}")
    print("=" * 60)
    
    return len(entries), len(valid_entries), len(false_positives)

if __name__ == "__main__":
    main()
