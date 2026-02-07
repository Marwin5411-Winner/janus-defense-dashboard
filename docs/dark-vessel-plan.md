# Feature Implementation: Dark Vessel Detection

## Observe
- Current system tracks vessels with active AIS signals.
- PostGIS database stores historical `last_seen` timestamps and spatial data (`geom`).
- "Dark vessels" are defined as those that stopped transmitting AIS signals within a monitored area.

## Analyze
- To detect "Dark Vessels", we need to identify vessels that were seen recently (e.g., in the last 2 hours) but have not sent a signal in the last 15-30 minutes.
- We need to calculate the "Gap" between their last transmission and the current time.
- If a vessel disappears in a high-risk area (like the Red Sea), it should trigger a high-priority "Dark Vessel" alert.

## Research
- **SQL Logic:** Query for vessels where `last_seen` is between 15 minutes and 2 hours ago.
- **Frontend Logic:** Display these vessels with a distinct style (e.g., dimmed or dashed circle) and an "Estimated Position" based on their last known speed and course.
- **PostGIS:** Use `ST_Distance` or bounding boxes to flag vessels disappearing in specific zones.

## Thinking
1. **Backend Update:** Create a new API endpoint `/api/dark-vessels` or update `vessels.get.ts` to include a `isDark` flag.
2. **Thresholds:** 
   - AIS Signal Gap > 15 mins = "Warning" (Potential signal loss).
   - AIS Signal Gap > 30 mins = "Dark Vessel" (Suspicious).
3. **Dead Reckoning:** Calculate estimated current position:
   - `new_lat = last_lat + (speed * cos(course) * time_gap)`
   - `new_lon = last_lon + (speed * sin(course) * time_gap)`
4. **UI Update:**
   - Monospace font (JetBrains Mono) for the data table.
   - Orange/Red flickering text for Dark Vessel alerts.
   - Dashed line on map showing projected path.

## Code Strategy
- Update `vessels.get.ts` to fetch both active and recently lost signals.
- Update `vessel.ts` store to handle the `isDark` state.
- Update `index.vue` and `VesselMap.vue` to visualize projected paths.
