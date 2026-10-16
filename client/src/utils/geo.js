const R = 6378137;

function rad(deg) {
  return (deg * Math.PI) / 180;
}

export function pathDistanceKm(points) {
  if (!points || points.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const [lat1, lng1] = points[i];
    const [lat2, lng2] = points[i + 1];
    const dLat = rad(lat2 - lat1);
    const dLng = rad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
    total += 2 * R * Math.asin(Math.sqrt(a));
  }
  return total / 1000;
}

export function polygonAreaHa(points) {
  if (!points || points.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const [lat1, lng1] = points[i];
    const [lat2, lng2] = points[(i + 1) % points.length];
    area += rad(lng2 - lng1) * (2 + Math.sin(rad(lat1)) + Math.sin(rad(lat2)));
  }
  area = Math.abs((area * R * R) / 2);
  return area / 10000;
}

export function formatDistance(km) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(km < 10 ? 2 : 1)} km`;
}

export function formatArea(ha) {
  if (ha < 1) return `${Math.round(ha * 10000)} m²`;
  return `${ha.toFixed(ha < 100 ? 1 : 0)} ha`;
}
