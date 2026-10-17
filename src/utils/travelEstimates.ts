/**
 * Travel Time & Distance Estimator based on Haversine in Thai Nguyen
 * Clearly distinguishes between Crow Flies (đường chim bay) and Road Distance (đi đường).
 */

export interface TravelEstimate {
  distanceKm: number;
  estimatedRoadKm: number;
  walkingMinutes: number;
  bicycleMinutes: number;
  motorbikeMinutes: number;
  crowFliesText: string;
  roadDistanceText: string;
  displayText: string;
  isCentroidMatch: boolean;
}

export function estimateTravelTime(distanceKm: number | undefined | null): TravelEstimate | null {
  if (distanceKm === undefined || distanceKm === null || isNaN(distanceKm) || distanceKm < 0) {
    return null;
  }

  // Exact 0.000km or point-overlap
  if (distanceKm < 0.001) {
    return {
      distanceKm: 0,
      estimatedRoadKm: 0,
      walkingMinutes: 1,
      bicycleMinutes: 1,
      motorbikeMinutes: 1,
      crowFliesText: '0 km (trùng tọa độ điểm mốc)',
      roadDistanceText: 'Tại điểm mốc',
      displayText: '📍 Trùng tọa độ điểm mốc',
      isCentroidMatch: true,
    };
  }

  // Under 100 meters
  if (distanceKm < 0.1) {
    return {
      distanceKm,
      estimatedRoadKm: 0.1,
      walkingMinutes: 1,
      bicycleMinutes: 1,
      motorbikeMinutes: 1,
      crowFliesText: '< 100m (đường chim bay)',
      roadDistanceText: 'Khoảng cách đi đường ước tính: ~100m',
      displayText: '🚶 Sát cổng trường (< 100m đường chim bay)',
      isCentroidMatch: false,
    };
  }

  // Road detour coefficient in Thai Nguyen urban/suburban traffic is approx 1.25 - 1.30
  const estimatedRoadKm = Number((distanceKm * 1.25).toFixed(1));

  // Average estimated speeds in Thai Nguyen roads:
  // Walking: ~4.5 km/h -> 1 km takes ~13.3 mins
  // Bicycle: ~12 km/h -> 1 km takes ~5 mins
  // Motorbike: ~25 km/h -> 1 km takes ~2.4 mins
  const walkingMinutes = Math.max(1, Math.round(distanceKm * 13.3));
  const bicycleMinutes = Math.max(1, Math.round(distanceKm * 5));
  const motorbikeMinutes = Math.max(1, Math.round(distanceKm * 2.4));

  const crowFliesText = `~${distanceKm.toFixed(1)} km (đường chim bay)`;
  const roadDistanceText = `Khoảng cách đi đường ước tính: ~${estimatedRoadKm} km`;

  let displayText = '';
  if (walkingMinutes <= 15) {
    displayText = `🚶 ~${walkingMinutes} phút đi bộ (~${distanceKm.toFixed(1)} km đường chim bay)`;
  } else {
    displayText = `🛵 ~${motorbikeMinutes} phút xe máy (~${distanceKm.toFixed(1)} km đường chim bay)`;
  }

  return {
    distanceKm,
    estimatedRoadKm,
    walkingMinutes,
    bicycleMinutes,
    motorbikeMinutes,
    crowFliesText,
    roadDistanceText,
    displayText,
    isCentroidMatch: false,
  };
}
