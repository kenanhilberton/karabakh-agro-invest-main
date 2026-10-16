// Shared basemap configuration for the Leaflet (2D) and MapLibre (3D) maps.
//
// Vector basemaps ("vector") render crisp, Google-Maps-like detail at every
// zoom level because the tiles are geometry, not pixels. Raster basemaps
// ("raster") are used for satellite imagery and relief maps. Every mode also
// has a raster fallback so the Leaflet map can use the same keys.

export const ESRI_SAT =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

export const TERRAIN_DEM = [
  'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
];

// Order shown in the basemap switcher (both 2D and 3D).
export const BASEMAP_LIST = [
  { key: 'streets', label: 'Xəritə' },
  { key: 'satellite', label: 'Peyk' },
  { key: 'relief', label: 'Relyef' },
  { key: 'dark', label: 'Tünd' }
];

export const DEFAULT_BASEMAP = 'streets';

// Key-free raster source for the Leaflet (2D) map. CARTO stopped serving its
// *raster* basemaps without an API key on 25 Sep 2026 (they now return an
// "API key required" watermark), so the 2D raster basemaps use OpenStreetMap,
// which needs no key. The MapLibre (3D) map keeps using CARTO *vector* styles —
// only the raster endpoints require a key.
export const OSM_RASTER = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

export const BASEMAPS = {
  streets: {
    key: 'streets',
    label: 'Xəritə',
    vector: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
    raster: OSM_RASTER,
    rasterAttribution: '&copy; OpenStreetMap contributors',
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    maxZoom: 19,
    nativeMaxZoom: 19
  },
  satellite: {
    key: 'satellite',
    label: 'Peyk',
    raster: ESRI_SAT,
    attribution: 'Tiles &copy; Esri &mdash; Maxar, Earthstar Geographics',
    // Esri World Imagery only has real imagery up to ~z18 over the Karabakh
    // districts. Requesting z19+ returns a grey "Map data not yet available"
    // placeholder tile. We therefore stop zooming at the native limit (z18) so
    // the image is always real and crisp — never a placeholder, never blurry.
    maxZoom: 18,
    nativeMaxZoom: 18
  },
  relief: {
    key: 'relief',
    label: 'Relyef',
    raster: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap &middot; SRTM | &copy; OpenTopoMap',
    maxZoom: 17,
    nativeMaxZoom: 17
  },
  dark: {
    key: 'dark',
    label: 'Tünd',
    vector: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
    raster: OSM_RASTER,
    rasterAttribution: '&copy; OpenStreetMap contributors',
    // OSM tiles inverted to a dark theme via CSS (see index.css), so the dark
    // basemap also stays key-free.
    tileClass: 'map-tiles-dark',
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    maxZoom: 19,
    nativeMaxZoom: 19
  }
};

// Maps legacy basemap keys (from older shared links) onto the new set.
const LEGACY_ALIASES = { osm: 'streets', topo: 'relief', light: 'streets' };

export function normalizeBasemap(key) {
  if (!key) return DEFAULT_BASEMAP;
  const mapped = LEGACY_ALIASES[key] || key;
  return BASEMAPS[mapped] ? mapped : DEFAULT_BASEMAP;
}
