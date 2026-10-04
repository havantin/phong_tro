/**
 * Travel Time Estimator based on Haversine distance in Thai Nguyen
 */

export interface TravelEstimate {
  distanceKm: number;
  walkingMinutes: number;
  bicycleMinutes: number;
  motorbikeMinutes: number;
  displayText: string;
}

export function estimateTravelTime(distanceKm: number): TravelEstimate {
  // Average speeds in Thai Nguyen suburban/urban roads:
  // Walking: ~4.5 km/h -> 1 km takes ~13.3 minutes
  // Bicycle: ~12 km/h -> 1 km takes ~5 minutes
  // Motorbike: ~25 km/h -> 1 km takes ~2.4 minutes

  const walkingMinutes = Math.max(1, Math.round(distanceKm * 13.3));
  const bicycleMinutes = Math.max(1, Math.round(distanceKm * 5));
  const motorbikeMinutes = Math.max(1, Math.round(distanceKm * 2.4));

  let displayText = '';
  if (distanceKm <= 1.0) {
    displayText = `🚶 ${walkingMinutes} phút đi bộ (${distanceKm.toFixed(1)} km)`;
  } else if (distanceKm <= 2.5) {
    displayText = `🛵 ${motorbikeMinutes} phút xe máy (${distanceKm.toFixed(1)} km)`;
  } else {
    displayText = `🛵 ${motorbikeMinutes} phút (${distanceKm.toFixed(1)} km)`;
  }

  return {
    distanceKm,
    walkingMinutes,
    bicycleMinutes,
    motorbikeMinutes,
    displayText,
  };
}
