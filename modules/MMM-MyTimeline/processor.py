import json
import os
import re
import time
from datetime import datetime

try:
    from geopy.geocoders import Nominatim
except ImportError:
    print("Error: geopy not installed.")
    exit()

geolocator = Nominatim(user_agent="magic_mirror_multi_year_bot")

INPUT_FILE = 'data/Timeline.json'
OUTPUT_FILE = 'data/today_nostalgia.json'
CACHE_FILE = 'data/address_cache.json'

if os.path.exists(CACHE_FILE):
    with open(CACHE_FILE, 'r') as f:
        address_cache = json.load(f)
else:
    address_cache = {}

def get_clean_address(lat, lng):
    cache_key = f"{round(lat, 4)},{round(lng, 4)}"
    if cache_key in address_cache: return address_cache[cache_key]
    try:
        location = geolocator.reverse(f"{lat}, {lng}", timeout=10)
        if location:
            parts = location.address.split(',')
            addr = f"{parts[0].strip()}, {parts[1].strip()}" if len(parts) > 1 else parts[0]
            address_cache[cache_key] = addr
            return addr
    except: return "Unknown Address"

def clean_coord(coord_str):
    cleaned = re.sub(r'[^0-9.\-]', '', str(coord_str))
    try: return float(cleaned)
    except: return 0.0

def process_timeline():
    if not os.path.exists(INPUT_FILE): return
    with open(INPUT_FILE, 'r') as f:
        data = json.load(f)

    today = datetime.now()
    t_month, t_day = today.month, today.day
    segments = data.get('semanticSegments', [])
    
    # Group segments by year
    yearly_data = {}
    for s in segments:
        start_str = s.get('startTime')
        if not start_str: continue
        dt = datetime.fromisoformat(start_str.replace('Z', '+00:00'))
        if dt.month == t_month and dt.day == t_day and dt.year < today.year:
            year = dt.year
            if year not in yearly_data: yearly_data[year] = []
            yearly_data[year].append(s)

    all_years_output = []

    for year in sorted(yearly_data.keys()):
        print(f"Processing year {year}...")
        events = []
        trail = []
        day_segments = sorted(yearly_data[year], key=lambda x: x.get('startTime'))

        # Start of Day Logic
        first = day_segments[0]
        path = first.get('timelinePath', [])
        s_lat, s_lng = 0.0, 0.0
        if path:
            pt = path[0].get('point', "").split(',')
            s_lat, s_lng = clean_coord(pt[0]), clean_coord(pt[1])
        
        if s_lat != 0:
            events.append({
                "type": "visit",
                "location": "Starting Point",
                "time_range": "Morning",
                "lat": s_lat, "lng": s_lng
            })

        for segment in day_segments:
            start_dt = datetime.fromisoformat(segment['startTime'].replace('Z', '+00:00'))
            end_dt = datetime.fromisoformat(segment['endTime'].replace('Z', '+00:00'))
            time_label = f"{start_dt.strftime('%-I:%M %p')} - {end_dt.strftime('%-I:%M %p')}"
            
            if 'visit' in segment:
                v = segment['visit']
                cand = v.get('topCandidate', {})
                loc = v.get('location', {})
                latlng = (cand.get('placeLocation', {}).get('latLng', "") or loc.get('latLng', "")).split(',')
                if len(latlng) == 2:
                    lat, lng = clean_coord(latlng[0]), clean_coord(latlng[1])
                    name = cand.get('name') or loc.get('name')
                    sem = cand.get('semanticType') or loc.get('semanticType')
                    if not (name and "UNKNOWN" not in name):
                        name = "Home" if sem == "HOME" else get_clean_address(lat, lng)
                    events.append({"type": "visit", "location": name, "time_range": time_label, "lat": lat, "lng": lng})
                    trail.append({"lat": lat, "lng": lng})

            elif 'activity' in segment:
                act = segment['activity']
                t_name = act.get('topCandidate', {}).get('type', 'Moving').replace('_', ' ').capitalize()
                events.append({"type": "activity", "location": t_name, "time_range": time_label})

            for p in segment.get('timelinePath', []):
                pt = p.get('point', "").split(',')
                if len(pt) == 2: trail.append({"lat": clean_coord(pt[0]), "lng": clean_coord(pt[1])})

        all_years_output.append({"year": year, "events": events, "trail": trail})

    with open(CACHE_FILE, 'w') as f: json.dump(address_cache, f)
    with open(OUTPUT_FILE, 'w') as f: json.dump(all_years_output, f, indent=4)
    print("Multi-year data generated.")

if __name__ == "__main__":
    process_timeline()