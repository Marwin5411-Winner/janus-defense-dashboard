# Feature Implementation: Dead Reckoning (Ghost Path) Intelligence

## Observe
- Current system only displays vessels with active AIS signals (last 2 hours).
- When a vessel leaves the 40-70km coastal range of terrestrial AIS receivers, it disappears from the dashboard.
- Users lose situational awareness during "Deep Sea" transits.

## Analyze
- To maintain continuity, we need to "predict" where a vessel is based on its last reported state.
- **State Data:** `latitude`, `longitude`, `speed_kn`, `course`, `timestamp`.
- **Dead Reckoning Logic:** 
  - `TimeGap = Now - LastSeen`
  - `Distance = Speed * TimeGap`
  - `NewPosition = DestinationPoint(LastPos, Course, Distance)`
- Vessels with a gap > 15 mins but < 24 hours should be treated as "Ghost Vessels".

## Research
- **Haversine Formula / Destination Point:** To calculate new Lat/Lon given distance and bearing.
- **Frontend Visualization:** 
  - Active: Solid icon, bright color.
  - Ghost: Semi-transparent icon, dashed stroke.
  - Dead Reckoning Line: A dotted line connecting `LastSeenPos` to `EstimatedPos`.

## Thinking
1. **Backend:** Update `vessels.get.ts` to fetch vessels seen in the last 24 hours (instead of 2 hours).
2. **Logic Utility:** Create `utils/navigation.ts` to handle the spherical geometry calculations.
3. **Frontend Store:** Update `vessel.ts` to calculate the `estimatedPosition` for all vessels in real-time.
4. **UI Components:** Update `VesselMap.vue` to render the "Ghost Path" and "Estimated Position" markers.
5. **Transparency:** Clearly label these as "ESTIMATED" to maintain data integrity.

## Code Strategy
- Shift the heavy lifting of prediction to the Frontend (Store) so it updates smoothly in the UI every second.
- Implement a `isGhost` flag based on a 15-minute signal gap.
