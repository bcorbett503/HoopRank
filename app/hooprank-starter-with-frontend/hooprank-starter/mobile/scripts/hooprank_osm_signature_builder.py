#!/usr/bin/env python3
"""
HoopRank: Build a BIG list of basketball courts + likely hoops venues (rec centers, high schools, colleges)
for the Top N most-populous U.S. cities.

Why this exists:
- OSM "sport=basketball" captures many courts (mostly outdoor).
- Indoor runs often live inside buildings (schools/rec centers/universities) and are NOT always mapped as courts.
- For HoopRank, it's useful to have BOTH:
    1) actual mapped courts, and
    2) "venue anchors" where hoop runs happen (HS gyms, university rec centers, city rec centers).

Outputs:
- CSV with: name, lat, lon, indoor/outdoor (best-effort), venue_type, osm_id, tags, signature_score, etc.

Usage:
  python hooprank_osm_signature_builder.py --out hooprank_top100_venues.csv
  python hooprank_osm_signature_builder.py --max-cities 100 --radius-km 25 --out hooprank_top100_venues.csv
  python hooprank_osm_signature_builder.py --cities-csv my_cities.csv --out venues.csv
"""

from __future__ import annotations

import argparse
import io
import json
import re
import time
import zipfile
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional, Tuple

import pandas as pd
import requests
from tqdm import tqdm


GAZETTEER_URL_CANDIDATES = [
    # Try newest-first; if one 404s, script will fall back.
    "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/2024_Gaz_place_national.zip",
    "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2023_Gazetteer/2023_Gaz_place_national.zip",
    "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2022_Gazetteer/2022_Gaz_place_national.zip",
]

OVERPASS_URL_CANDIDATES = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.openstreetmap.ru/api/interpreter",
]


NAME_HINT_RE = re.compile(
    r"\b(rec|recreation|community|fieldhouse|gym|gymnasium|athletic|student recreation|boys\s*&\s*girls|ymca)\b",
    re.IGNORECASE,
)
HIGH_SCHOOL_RE = re.compile(r"\bhigh school\b|\bhs\b", re.IGNORECASE)


def _download_bytes(url: str, timeout_s: int = 60) -> bytes:
    r = requests.get(url, timeout=timeout_s)
    r.raise_for_status()
    return r.content


def load_top_cities_from_census_gazetteer(max_cities: int = 100) -> pd.DataFrame:
    """
    Returns dataframe with columns: city, state, lat, lon, population
    Based on Census Gazetteer "place" national file.
    """
    last_err: Optional[Exception] = None
    for url in GAZETTEER_URL_CANDIDATES:
        try:
            content = _download_bytes(url)
            zf = zipfile.ZipFile(io.BytesIO(content))
            txt_names = [n for n in zf.namelist() if n.lower().endswith(".txt")]
            if not txt_names:
                raise RuntimeError("No .txt file found in Gazetteer zip")
            txt_name = txt_names[0]
            df = pd.read_csv(zf.open(txt_name), sep="\t", dtype=str)
            # Common columns: GEOID, NAME, USPS, POPULATION, HU, ALAND, AWATER, ALAND_SQMI, AWATER_SQMI, LAT, LON
            needed = {"NAME", "USPS", "POPULATION", "LAT", "LON"}
            missing = needed - set(df.columns)
            if missing:
                raise RuntimeError(f"Gazetteer file missing expected columns: {missing}. Columns={list(df.columns)}")
            df = df.rename(
                columns={"NAME": "city", "USPS": "state", "POPULATION": "population", "LAT": "lat", "LON": "lon"}
            )
            df["population"] = df["population"].astype(int)
            df["lat"] = df["lat"].astype(float)
            df["lon"] = df["lon"].astype(float)
            # Keep incorporated places; then top by population
            df = df.sort_values("population", ascending=False).head(max_cities).reset_index(drop=True)
            return df[["city", "state", "population", "lat", "lon"]]
        except Exception as e:
            last_err = e
            print(f"[warn] Failed to load Gazetteer from {url}: {e}")

    raise RuntimeError(
        "Could not download Census Gazetteer places file from any known URL. "
        "Use --cities-csv to supply your own city list (city,state,lat,lon)."
    ) from last_err


def load_cities_from_csv(path: str) -> pd.DataFrame:
    df = pd.read_csv(path)
    required = {"city", "state", "lat", "lon"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"--cities-csv is missing required columns: {missing}")
    df["lat"] = df["lat"].astype(float)
    df["lon"] = df["lon"].astype(float)
    if "population" not in df.columns:
        df["population"] = 0
    return df[["city", "state", "population", "lat", "lon"]]


def pick_working_overpass_endpoint(timeout_s: int = 20) -> str:
    for url in OVERPASS_URL_CANDIDATES:
        try:
            # Minimal query to test availability
            q = '[out:json][timeout:10];node(0,0,0.0001,0.0001);out 1;'
            r = requests.post(url, data={"data": q}, timeout=timeout_s)
            if r.status_code == 200:
                return url
        except Exception:
            pass
    raise RuntimeError("Could not reach any Overpass endpoint. Try again later or change OVERPASS_URL_CANDIDATES.")


def build_overpass_query(
    lat: float,
    lon: float,
    radius_m: int,
    include_courts: bool,
    include_rec_centers: bool,
    include_schools: bool,
    include_universities: bool,
    timeout_s: int,
) -> str:
    """
    Returns an Overpass QL query that grabs:
    - basketball courts (sport=basketball) (nodes/ways/relations)
    - rec centers + sports halls (venue anchors)
    - high schools (venue anchors)
    - colleges/universities (venue anchors)
    """
    parts: List[str] = []

    if include_courts:
        # Courts are often mapped as leisure=pitch + sport=basketball, but not always.
        parts.append(f'nwr["sport"="basketball"](around:{radius_m},{lat},{lon});')
        parts.append(f'nwr["leisure"="pitch"]["sport"="basketball"](around:{radius_m},{lat},{lon});')
        # Some mappers store multi-sport lists like "basketball;tennis" (rare for courts but happens)
        parts.append(f'nwr["sport"~"(^|;)basketball(;|$)"](around:{radius_m},{lat},{lon});')

    if include_rec_centers:
        # Rec centers / gyms / sports halls (these often host indoor pickup, but may not be tagged basketball explicitly)
        parts.append(f'nwr["building"="sports_hall"](around:{radius_m},{lat},{lon});')
        parts.append(f'nwr["leisure"="sports_centre"](around:{radius_m},{lat},{lon});')
        parts.append(f'nwr["leisure"="leisure_centre"](around:{radius_m},{lat},{lon});')
        parts.append(f'nwr["amenity"="community_centre"](around:{radius_m},{lat},{lon});')
        # Name-hint filters catch "Recreation Center", "Fieldhouse", "YMCA", etc.
        parts.append(f'nwr["name"~"Rec|Recreation|Community|Fieldhouse|Gym|Gymnasium|YMCA|Boys|Girls",i](around:{radius_m},{lat},{lon});')

    if include_schools:
        # Only try to grab HIGH SCHOOLS (important for HoopRank).
        parts.append(f'nwr["amenity"="school"]["school:level"="high"](around:{radius_m},{lat},{lon});')
        parts.append(f'nwr["amenity"="school"]["isced:level"~"3"](around:{radius_m},{lat},{lon});')
        parts.append(f'nwr["amenity"="school"]["name"~"High School",i](around:{radius_m},{lat},{lon});')
        parts.append(f'nwr["amenity"="school"]["name"~"\\bHS\\b",i](around:{radius_m},{lat},{lon});')

    if include_universities:
        parts.append(f'nwr["amenity"="university"](around:{radius_m},{lat},{lon});')
        parts.append(f'nwr["amenity"="college"](around:{radius_m},{lat},{lon});')
        # Student recreation centers are often mapped without amenity=university; name filter helps.
        parts.append(f'nwr["name"~"Student Recreation|Rec Center|Recreation Center|Recreation Centre",i](around:{radius_m},{lat},{lon});')

    q = f'[out:json][timeout:{timeout_s}];(' + "".join(parts) + ");out tags center;"
    return q


def overpass_fetch(url: str, query: str, timeout_s: int = 120, sleep_s: float = 1.0) -> Dict[str, Any]:
    """
    Execute Overpass query. Adds a small sleep to be nice to Overpass.
    """
    r = requests.post(url, data={"data": query}, timeout=timeout_s)
    # If Overpass is overloaded, it may return 429/504 or HTML. Let user see it.
    r.raise_for_status()
    time.sleep(sleep_s)
    return r.json()


def classify_element(tags: Dict[str, str]) -> Tuple[str, str, str, bool]:
    """
    Returns:
      kind: "court" | "venue"
      venue_type: "Basketball Court" | "Rec Center / Gym" | "High School" | "College/University" | "Other"
      court_type: "Indoor" | "Outdoor" | "Unknown"
      inferred: whether indoor/outdoor is inferred (not explicit)
    """
    amenity = tags.get("amenity", "")
    leisure = tags.get("leisure", "")
    building = tags.get("building", "")
    sport = tags.get("sport", "")

    # Decide kind / venue_type
    if leisure == "pitch" and "basketball" in sport:
        kind = "court"
        venue_type = "Basketball Court"
    elif sport == "basketball" and leisure in ("pitch", "sports_pitch", "") and amenity == "" and building == "":
        # Many courts are just sport=basketball nodes.
        kind = "court"
        venue_type = "Basketball Court"
    elif amenity == "school":
        kind = "venue"
        venue_type = "High School"
    elif amenity in ("college", "university"):
        kind = "venue"
        venue_type = "College/University"
    elif building == "sports_hall" or leisure in ("sports_centre", "leisure_centre") or amenity == "community_centre":
        kind = "venue"
        venue_type = "Rec Center / Gym"
    else:
        # Use name hints as a fallback
        name = tags.get("name", "")
        if NAME_HINT_RE.search(name):
            kind = "venue"
            venue_type = "Rec Center / Gym"
        else:
            # Default
            kind = "venue" if amenity or leisure or building else "court"
            venue_type = "Other" if kind == "venue" else "Basketball Court"

    # Indoor/outdoor
    inferred = False
    indoor_tag = tags.get("indoor", "").lower()
    location_tag = tags.get("location", "").lower()
    covered_tag = tags.get("covered", "").lower()

    if indoor_tag == "yes" or location_tag == "indoor":
        court_type = "Indoor"
    elif building == "sports_hall":
        court_type = "Indoor"
        inferred = True
    elif kind == "venue" and venue_type in ("High School", "College/University", "Rec Center / Gym"):
        # Most of these imply indoor hoops access (a gym), even if not explicitly tagged.
        court_type = "Indoor"
        inferred = True
    elif leisure == "pitch":
        court_type = "Outdoor"
        inferred = True
    elif covered_tag == "yes":
        # Covered courts are typically outdoor-but-covered; treat as Outdoor unless indoor=yes is set.
        court_type = "Outdoor"
        inferred = True
    else:
        court_type = "Unknown"
        inferred = True

    return kind, venue_type, court_type, inferred


def signature_score(tags: Dict[str, str], kind: str, venue_type: str) -> int:
    """
    Heuristic score to bubble up 'signature' places (useful for app onboarding / featured courts).
    """
    score = 0
    name = tags.get("name", "")
    if name:
        score += 2
    if "wikipedia" in tags or "wikidata" in tags:
        score += 4
    if "website" in tags:
        score += 2
    if "operator" in tags or "brand" in tags:
        score += 1
    if "opening_hours" in tags:
        score += 1
    if tags.get("access") in ("private", "customers", "members"):
        score -= 1

    # Venue-type boosts
    if venue_type in ("High School", "College/University"):
        score += 2
    if venue_type == "Rec Center / Gym":
        score += 1

    # Name hints
    if NAME_HINT_RE.search(name):
        score += 1
    if HIGH_SCHOOL_RE.search(name) and venue_type == "High School":
        score += 1

    # Courts with extra detail are often more important
    if kind == "court":
        if "surface" in tags:
            score += 1
        if "lit" in tags:
            score += 1

    return score


def elements_to_rows(
    elements: Iterable[Dict[str, Any]],
    city_anchor: str,
    state_anchor: str,
) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for el in elements:
        etype = el.get("type")
        eid = el.get("id")
        tags = el.get("tags", {}) or {}

        # Lat/lon:
        if etype == "node":
            lat = el.get("lat")
            lon = el.get("lon")
        else:
            center = el.get("center") or {}
            lat = center.get("lat")
            lon = center.get("lon")

        if lat is None or lon is None:
            continue

        kind, venue_type, court_type, inferred = classify_element(tags)
        score = signature_score(tags, kind, venue_type)

        rows.append(
            {
                "name": tags.get("name", "") or tags.get("official_name", "") or "",
                "city_anchor": city_anchor,
                "state_anchor": state_anchor,
                "lat": float(lat),
                "lon": float(lon),
                "kind": kind,  # court vs venue
                "venue_type": venue_type,
                "court_type": court_type,
                "court_type_inferred": inferred,
                "osm_type": etype,
                "osm_id": int(eid) if eid is not None else None,
                "signature_score": score,
                "access": tags.get("access", ""),
                "operator": tags.get("operator", ""),
                "website": tags.get("website", ""),
                "tags_json": json.dumps(tags, ensure_ascii=False),
            }
        )
    return rows


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True, help="Output CSV path")
    ap.add_argument("--max-cities", type=int, default=100, help="How many top cities to process (default: 100)")
    ap.add_argument("--radius-km", type=float, default=20.0, help="Search radius around city center (default: 20km)")
    ap.add_argument("--timeout-s", type=int, default=180, help="Overpass query timeout (default: 180s)")
    ap.add_argument("--sleep-s", type=float, default=1.0, help="Sleep between Overpass requests (default: 1s)")
    ap.add_argument("--only-named", action="store_true", help="Keep only elements that have a name tag")
    ap.add_argument("--cities-csv", default="", help="Optional CSV with columns city,state,lat,lon[,population]")

    ap.add_argument("--no-courts", action="store_true", help="Do NOT include sport=basketball courts")
    ap.add_argument("--no-rec-centers", action="store_true", help="Do NOT include rec centers / gyms")
    ap.add_argument("--no-schools", action="store_true", help="Do NOT include high schools")
    ap.add_argument("--no-universities", action="store_true", help="Do NOT include colleges/universities")

    args = ap.parse_args()

    if args.cities_csv:
        cities = load_cities_from_csv(args.cities_csv)
        if args.max_cities:
            cities = cities.head(args.max_cities)
    else:
        cities = load_top_cities_from_census_gazetteer(max_cities=args.max_cities)

    overpass_url = pick_working_overpass_endpoint()
    print(f"[info] Using Overpass endpoint: {overpass_url}")
    radius_m = int(args.radius_km * 1000)

    all_rows: List[Dict[str, Any]] = []
    seen: set = set()

    for _, row in tqdm(cities.iterrows(), total=len(cities), desc="Cities"):
        city = row["city"]
        state = row["state"]
        lat = float(row["lat"])
        lon = float(row["lon"])

        q = build_overpass_query(
            lat=lat,
            lon=lon,
            radius_m=radius_m,
            include_courts=not args.no_courts,
            include_rec_centers=not args.no_rec_centers,
            include_schools=not args.no_schools,
            include_universities=not args.no_universities,
            timeout_s=args.timeout_s,
        )

        try:
            data = overpass_fetch(overpass_url, q, timeout_s=args.timeout_s + 60, sleep_s=args.sleep_s)
        except Exception as e:
            print(f"[warn] Overpass failed for {city}, {state}: {e}")
            continue

        elements = data.get("elements", [])
        rows = elements_to_rows(elements, city_anchor=city, state_anchor=state)

        for r in rows:
            key = f'{r["osm_type"]}/{r["osm_id"]}'
            if key in seen:
                continue
            seen.add(key)
            all_rows.append(r)

    df = pd.DataFrame(all_rows)

    if args.only_named:
        df = df[df["name"].astype(str).str.len() > 0].copy()

    # Add a coarse tier for product onboarding use:
    def tier(s: int) -> str:
        if s >= 7:
            return "A"
        if s >= 4:
            return "B"
        return "C"

    df["signature_tier"] = df["signature_score"].fillna(0).astype(int).map(tier)

    # Sort: best signature first, then by city
    df = df.sort_values(["signature_tier", "signature_score", "city_anchor"], ascending=[True, False, True])

    df.to_csv(args.out, index=False)
    print(f"[done] Wrote {len(df):,} rows to {args.out}")


if __name__ == "__main__":
    main()
