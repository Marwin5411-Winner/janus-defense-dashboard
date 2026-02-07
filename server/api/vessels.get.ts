import pg from 'pg'


export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const pool = new pg.Pool({
    host: 'db-postgresql-sgp1-77927-do-user-11181753-0.f.db.ondigitalocean.com',
    port: 25060,
    user: 'janus',
    password: config.dbPassword as string,
    database: 'janus-gateway',
    ssl: {
      rejectUnauthorized: false
    }
  })

  try {
    // Strategic Coverage Zones (Simplified for V1)
    // Points represent major coastal receiver hubs
    const coverageHubs = [
      { name: 'Suez', lat: 29.9, lon: 32.5 },
      { name: 'Bab-el-Mandeb', lat: 12.6, lon: 43.4 },
      { name: 'Singapore', lat: 1.3, lon: 103.8 },
      { name: 'Gulf of Thailand', lat: 12.7, lon: 100.9 },
      { name: 'Hormuz', lat: 26.6, lon: 56.5 },
      { name: 'Colombo', lat: 6.9, lon: 79.8 }
    ]

    const query = `
      WITH latest_vessels AS (
        SELECT DISTINCT ON (mmsi) 
          mmsi, ship_name as name, latitude, longitude, speed_kn as speed, course, last_seen as timestamp, geom
        FROM vessels 
        WHERE last_seen > NOW() - INTERVAL '12 hours'
          AND latitude IS NOT NULL 
          AND longitude IS NOT NULL
          AND latitude BETWEEN -90 AND 90
          AND longitude BETWEEN -180 AND 180
        ORDER BY mmsi, last_seen DESC
        LIMIT 500
      ),
      coverage_check AS (
        SELECT *,
          EXISTS (
            SELECT 1 FROM (
              VALUES 
                (ST_SetSRID(ST_MakePoint(32.5, 29.9), 4326)),   -- Suez
                (ST_SetSRID(ST_MakePoint(43.4, 12.6), 4326)),   -- Aden
                (ST_SetSRID(ST_MakePoint(103.8, 1.3), 4326)),   -- Singapore
                (ST_SetSRID(ST_MakePoint(100.9, 12.7), 4326)),  -- Thailand
                (ST_SetSRID(ST_MakePoint(56.5, 26.6), 4326)),   -- Hormuz
                (ST_SetSRID(ST_MakePoint(79.8, 6.9), 4326))     -- Colombo
            ) AS hubs(geom)
            WHERE ST_DWithin(latest_vessels.geom, hubs.geom, 1.0) -- approx 110km
          ) as in_coverage_zone
        FROM latest_vessels
      )
      SELECT *,
        CASE 
          WHEN timestamp < NOW() - INTERVAL '15 minutes' THEN true
          ELSE false
        END as is_dark,
        EXTRACT(EPOCH FROM (NOW() - timestamp)) / 60 as gap_minutes
      FROM coverage_check
    `
    const res = await pool.query(query)
    
    const data = res.rows.map(row => ({
      ...row,
      id: row.mmsi.toString(),
      isDark: row.is_dark,
      inCoverage: row.in_coverage_zone,
      gapMinutes: Math.round(row.gap_minutes),
      shipType: row.name?.toLowerCase().includes('naval') || row.name?.startsWith('HTMS') ? 'Military' : 'Commercial'
    }))

    await pool.end()

    return {
      success: true,
      data: data,
      count: data.length,
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    console.error('DB Error:', error)
    await pool.end()
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch vessel data from Janus v17 Hub'
    })
  }
})
