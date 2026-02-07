# Feature Implementation: AIS Coverage Awareness & Signal Integrity Guard

## Observe
- Current "Dark Vessel" detection is a simple time-based check (>15 mins).
- It doesn't distinguish between a ship leaving the range of coastal receivers (normal) and a ship turning off its transponder in a high-traffic/covered area (suspicious).
- Real professional tools (Bloomberg, Windward) use coverage maps to verify signal integrity.

## Analyze
- We need to define "High-Confidence Coverage Zones".
- **Primary Zones:** Coastal areas within ~100km of major ports and shipping lanes (Singapore, Suez, Gulf of Aden, Bangkok).
- **Logic:**
  - If signal lost **INSIDE** a Coverage Zone -> **"CONFIRMED BLACKOUT (SUSPICIOUS)"** (Red Alert).
  - If signal lost **OUTSIDE** a Coverage Zone -> **"SIGNAL RANGE EXCEEDED (NORMAL)"** (Gray Info).
- This significantly reduces "False Positives" and makes the intelligence actionable.

## Research
- **PostGIS Spatial Check:** `ST_DWithin` or `ST_Contains` against a set of coverage polygons.
- **Data Source:** We'll define a set of Strategic Signal Hubs (MMSI Station Locations) or simpler: Coastal Buffer Polygons.

## Thinking
1.  **Define Strategy:** Instead of complex station lists, we'll start with a "Strategic Corridor" logic.
2.  **Strategic Polygons:**
    - **Suez/Red Sea Corridor:** High priority.
    - **Malacca Strait/Singapore:** High traffic.
    - **Gulf of Thailand:** Local interest.
3.  **Backend (SQL):** Add a `coverage_status` check in `vessels.get.ts`.
4.  **UI Update:**
    - **SUSPICIOUS:** Pulsing Red text + "BLACKOUT" tag.
    - **NORMAL:** Dimmed Gray text + "OUT OF RANGE" tag.
5.  **Professionalism:** Add "DATA INTEGRITY: VERIFIED" badge to the terminal when signal is lost in predictable ways.

## Code Strategy
- Update `vessels.get.ts` to include a spatial check for coverage.
- Enhance `vessel.ts` store to categorize lost signals.
- Update `index.vue` list and `VesselMap.vue` to show different "Signal Lost" visual styles.
