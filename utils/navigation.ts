/**
 * Navigation utilities for Dead Reckoning calculations
 */

export const calculateEstimatedPosition = (
  lat: number,
  lon: number,
  speedKn: number,
  courseDeg: number,
  lastSeen: string
) => {
  const lastDate = new Date(lastSeen);
  const now = new Date();
  const timeGapHours = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60);

  // If gap is too large (> 24h) or negative, don't predict
  if (timeGapHours > 24 || timeGapHours < 0) return { lat, lon };

  // Speed in Knots to Nautical Miles per hour
  const distanceNM = speedKn * timeGapHours;
  
  // Earth's radius in Nautical Miles (approx)
  const R = 3440.065; 
  
  const lat1 = (lat * Math.PI) / 180;
  const lon1 = (lon * Math.PI) / 180;
  const brng = (courseDeg * Math.PI) / 180;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(distanceNM / R) +
      Math.cos(lat1) * Math.sin(distanceNM / R) * Math.cos(brng)
  );

  const lon2 = lon1 + Math.atan2(
    Math.sin(brng) * Math.sin(distanceNM / R) * Math.cos(lat1),
    Math.cos(distanceNM / R) - Math.sin(lat1) * Math.sin(lat2)
  );

  return {
    lat: (lat2 * 180) / Math.PI,
    lon: (lon2 * 180) / Math.PI
  };
};
