import json
import os
import re
import time
from datetime import datetime

try:
    from geopy.geocoders import Nominatim
    from geopy.exc import GeocoderTimedOut
except ImportError:
    print("Error: geopy not installed. Run 'pip3 install geopy --break-system-packages'")
    exit()

# Initialize Geocoder
geolocator = Nominatim(user_agent="magic_mirror_timeline_bot")

INPUT_FILE = 'data/Timeline.json'
OUTPUT_FILE = 'data/today_nostalgia.json'
CACHE_FILE = 'data/address_cache.json'

# Load or create address cache
if os.path.exists(CACHE_FILE):
    with open(CACHE_FILE, 'r') as f:
        address_cache = json.load(f)
else:
    address_cache = {}

def get_clean_address(lat, lng):
    """Converts lat/lng to a readable address using cache or Geocoding."""
    cache_key = f"{round(lat, 4)},{round(lng, 4)}"
    if cache_key in address_cache:
        return address_cache[cache_key]

    try:
        print(f"Geocoding location: {cache_key}...")
        location = geolocator.reverse(f"{lat}, {lng}", timeout=10)
        if location:
            parts = location.address.split(',')
            # Returns "Street Name, Number" or similar short version
            addr = f"{parts[0].strip()}, {parts[1].strip()}" if len(parts) > 1 else parts[0]
            address_cache[cache_key] = addr
            return addr
    except Exception as e:
        print(f"Geocoding error: {e}")
    
    return "Unknown Address"

def clean_coord(coord_str):
    if not coord_str: return 0.0
    cleaned = re.sub(r'[^0-9.\-]', '', str(coord_str))
    try:
        return float(cleaned)
    except ValueError:
        return 0.0

def process_timeline():
    if not os.path.exists(INPUT_FILE):
        print(f"File {INPUT_FILE} not found!")
        return

    with open(INPUT_FILE, 'r') as f:
        data = json.load(f)

    today = datetime.now()
    t_month, t_day = today.month, today.day
    segments = data.get('semanticSegments', [])
    
    available_years = set()
    for s in segments:
        start_str = s.get('startTime')
        if start_str:
            dt = datetime.fromisoformat(start_str.replace('Z', '+00:00'))
            if dt.month == t_month and dt.day == t_day and dt.year < today.year:
                available_years.add(dt.year)
    
    if not available_years:
        print(f"No history found for {today.strftime('%B %d')}.")
        return
        
    target_year = min(available_years, key=lambda x: abs(x - (today.year - 5)))
    print(f"Analyzing {today.strftime('%B %d')}, {target_year}...")

    nostalgia_events = []
    trail_coordinates = []
    
    # Filter and sort segments for the target day
    day_segments = [s for s in segments if datetime.fromisoformat(s['startTime'].replace('Z', '+00:00')).year == target_year and 
                    datetime.fromisoformat(s['startTime'].replace('Z', '+00:00')).month == t_month and 
                    datetime.fromisoformat(s['startTime'].replace('Z', '+00:00')).day == t_day]
    day_segments.sort(key=lambda x: x.get('startTime'))

    # --- NEW: DETECT STARTING LOCATION ---
    if day_segments:
        first_seg = day_segments[0]
        start_dt = datetime.fromisoformat(first_seg.get('startTime').replace('Z', '+00:00'))
        
        # Try to find the coordinates of where the day began
        s_lat, s_lng = 0.0, 0.0
        path = first_seg.get('timelinePath', [])
        
        if path:
            pt = path[0].get('point', "").split(',')
            s_lat, s_lng = clean_coord(pt[0]), clean_coord(pt[1])
        elif 'visit' in first_seg:
            v = first_seg['visit']
            latlng = (v.get('topCandidate', {}).get('placeLocation', {}).get('latLng', "") or 
                      v.get('location', {}).get('latLng', "")).split(',')
            if len(latlng) == 2:
                s_lat, s_lng = clean_coord(latlng[0]), clean_coord(latlng[1])

        if s_lat != 0.0:
            # Check if Google already knows this is 'HOME'
            v_info = first_seg.get('visit', {})
            sem = v_info.get('topCandidate', {}).get('semanticType') or v_info.get('location', {}).get('semanticType')
            
            if sem == "HOME":
                start_loc_name = "Home"
            else:
                start_loc_name = f"Started at {get_clean_address(s_lat, s_lng)}"
            
            nostalgia_events.append({
                "type": "visit",
                "location": start_loc_name,
                "time_range": f"Start of Day",
                "lat": s_lat, "lng": s_lng
            })

    # --- PROCESS ALL SEGMENTS ---
    for segment in day_segments:
        start_dt = datetime.fromisoformat(segment['startTime'].replace('Z', '+00:00'))
        end_dt = datetime.fromisoformat(segment['endTime'].replace('Z', '+00:00'))
        time_label = f"{start_dt.strftime('%-I:%M %p')} - {end_dt.strftime('%-I:%M %p')}"
        
        if 'visit' in segment:
            v = segment['visit']
            cand = v.get('topCandidate', {})
            loc = v.get('location', {})
            
            latlng_str = cand.get('placeLocation', {}).get('latLng', "") or loc.get('latLng', "")
            latlng = latlng_str.split(',')
            
            if len(latlng) == 2:
                lat, lng = clean_coord(latlng[0]), clean_coord(latlng[1])
                name = cand.get('name') or loc.get('name')
                sem = cand.get('semanticType') or loc.get('semanticType')
                
                if name and "UNKNOWN" not in name and "ALIASED" not in name:
                    final_name = name
                elif sem == "HOME":
                    final_name = "Home"
                elif sem == "WORK":
                    final_name = "Work"
                else:
                    final_name = get_clean_address(lat, lng)
                    time.sleep(1) 

                nostalgia_events.append({
                    "type": "visit", "location": final_name, "time_range": time_label, "lat": lat, "lng": lng
                })
                trail_coordinates.append({"lat": lat, "lng": lng})

        elif 'activity' in segment:
            act = segment['activity']
            t_name = act.get('topCandidate', {}).get('type', 'Moving').replace('_', ' ').capitalize()
            nostalgia_events.append({
                "type": "activity", "location": t_name, "time_range": time_label
            })

        for p in segment.get('timelinePath', []):
            pt = p.get('point', "").split(',')
            if len(pt) == 2:
                trail_coordinates.append({"lat": clean_coord(pt[0]), "lng": clean_coord(pt[1])})

    # Save cache and results
    with open(CACHE_FILE, 'w') as f:
        json.dump(address_cache, f)
    
    with open(OUTPUT_FILE, 'w') as f:
        json.dump({"target_year": target_year, "events": nostalgia_events, "trail": trail_coordinates}, f, indent=4)
    print(f"Success! {len(nostalgia_events)} events saved.")

if __name__ == "__main__":
    process_timeline()