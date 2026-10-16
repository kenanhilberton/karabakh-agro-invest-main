import { useEffect, useMemo, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { landFillColor, reliefLabel } from '../utils/mapColors.js';
import { calculateLandScore } from '../utils/landScore.js';
import { BASEMAPS, DEFAULT_BASEMAP, TERRAIN_DEM } from '../utils/basemaps.js';
if (typeof maplibregl.setWorkerUrl === 'function') maplibregl.setWorkerUrl(workerUrl);

function ndviColor(v) {
  const t = Math.max(0, Math.min(1, (Number(v) || 50) / 100));
  const h = 20 + t * 110;
  return `hsl(${h}, 72%, 42%)`;
}

function centroid(geometry) {
  const ring = geometry?.coordinates?.[0] || [];
  if (!ring.length) return null;
  let lat = 0;
  let lng = 0;
  for (const [x, y] of ring) {
    lng += x;
    lat += y;
  }
  return [lat / ring.length, lng / ring.length];
}

// Inline raster style for satellite/relief basemaps. Terrain and the land
// plot layers are attached after the style loads (see the load handler).
function rasterBasemapStyle(basemap) {
  const cfg = BASEMAPS[basemap] || BASEMAPS.satellite;
  return {
    version: 8,
    sources: {
      base: {
        type: 'raster',
        tiles: [cfg.raster],
        tileSize: 256,
        // Cap the *native* zoom so MapLibre never requests placeholder tiles
        // (e.g. Esri z19+ over Karabakh); higher map zooms overzoom this tile.
        maxzoom: cfg.nativeMaxZoom || cfg.maxZoom || 19,
        attribution: cfg.attribution
      }
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#0b1b2b' } },
      { id: 'base-raster', type: 'raster', source: 'base' }
    ]
  };
}

// Vector basemaps render crisp at every zoom level (Google-Maps-like); the
// raster modes (satellite/relief) fall back to the inline style above.
function basemapStyle(basemap) {
  const cfg = BASEMAPS[basemap];
  if (cfg && cfg.vector) return cfg.vector;
  return rasterBasemapStyle(basemap);
}

function popupHtml(land, compared, canApply) {
  let applyBtn = '';
  if (canApply) {
    applyBtn = '<button data-apply class="mt-1 w-full rounded-md bg-brand-600 px-2 py-1.5 text-xs font-semibold text-white hover:bg-brand-700">Müraciət et →</button>';
  }
  let cmpBtn = '';
  if (canApply) {
    const label = compared ? '— Müqayisədən çıxar' : '+ Müqayisəyə əlavə';
    cmpBtn = `<button data-cmp class="mt-1 w-full rounded-md bg-slate-100 px-2 py-1.5 text-xs font-semibold text-ink-700 hover:bg-slate-200">${label}</button>`;
  }
  return `
    <div class="min-w-[200px] space-y-1.5">
      <div class="flex items-center justify-between gap-2">
        <strong class="text-sm">${land.districtName}</strong>
        <span class="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">${land.code}</span>
      </div>
      <div class="text-xs text-slate-600">${land.purposeLabel}</div>
      <div class="text-[11px]">
        <span class="rounded bg-brand-50 px-1.5 py-0.5 font-semibold text-brand-700">🏛 Dövlət torpağı</span>
        <span class="ml-1 rounded bg-lime-50 px-1.5 py-0.5 font-semibold text-lime-700">⛰ ${reliefLabel(land.relief)}</span>
      </div>
      <div class="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-slate-500">
        <div>Sahə: <b class="text-ink-900">${land.areaHa} ha</b></div>
        <div>pH: <b class="text-ink-900">${land.ph}</b></div>
        <div>Münbitlik: <b class="text-ink-900">${land.fertility}</b></div>
        <div>Su: <b class="text-ink-900">${land.waterKm} km</b></div>
        <div>Günəşli gün: <b class="text-ink-900">${land.sunDays}</b></div>
      </div>
      ${applyBtn}
      ${cmpBtn}
    </div>
  `;
}

export default function Map3D({
  lands = [],
  selectedId,
  onSelect,
  onApply,
  onToggleCompare,
  compareIds = [],
  colorMode = 'purpose',
  showLabels = false,
  center = [39.7, 46.8],
  zoom = 10,
  height = '100%',
  showNdvi = false,
  basemap = DEFAULT_BASEMAP,
  onReady
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const popupRef = useRef(null);
  const hoverIdRef = useRef(null);
  const landsRef = useRef(lands);
  const onSelectRef = useRef(onSelect);
  const onApplyRef = useRef(onApply);
  const onToggleCompareRef = useRef(onToggleCompare);
  const compareIdsRef = useRef(compareIds);
  const labelMarkersRef = useRef([]);
  const readyRef = useRef(false);
  const [cursor, setCursor] = useState(null);
  const [ready, setReady] = useState(false);

  landsRef.current = lands;
  onSelectRef.current = onSelect;
  onApplyRef.current = onApply;
  onToggleCompareRef.current = onToggleCompare;
  compareIdsRef.current = compareIds;

  const features = useMemo(() => {
    return {
      type: 'FeatureCollection',
      features: lands.map((l) => ({
        type: 'Feature',
        id: String(l.id),
        properties: {
          id: l.id,
          code: l.code,
          color: showNdvi ? ndviColor(l.fertility) : landFillColor(l, colorMode),
          height: 250 + (Number(l.fertility) || 50) * 13,
          districtName: l.districtName,
          purposeLabel: l.purposeLabel,
          areaHa: l.areaHa
        },
        geometry: l.geometry
      }))
    };
  }, [lands, showNdvi, colorMode]);

  useEffect(() => {
    if (!containerRef.current) return undefined;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: basemapStyle(basemap),
      center: [center[1], center[0]],
      zoom,
      pitch: 45,
      bearing: -15,
      maxPitch: 80,
      maxZoom: BASEMAPS[basemap]?.maxZoom || 20,
      antialias: true,
      preserveDrawingBuffer: true
    });
    mapRef.current = map;
    map.on('error', (e) => { /* swallow */ });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

    map.on('load', () => {
      // Terrain (relief). Basemap styles loaded from a URL do not ship a DEM
      // source, so add one when it is missing (satellite/relief already have it).
      if (!map.getSource('terrain')) {
        try {
          map.addSource('terrain', {
            type: 'raster-dem',
            tiles: TERRAIN_DEM,
            encoding: 'terrarium',
            tileSize: 256,
            maxzoom: 15
          });
        } catch { /* noop */ }
      }
      try { map.setTerrain({ source: 'terrain', exaggeration: 0.7 }); } catch { /* noop */ }
      if ((basemap === 'satellite' || basemap === 'relief') && !map.getLayer('hillshade')) {
        try {
          map.addLayer({
            id: 'hillshade',
            type: 'hillshade',
            source: 'terrain',
            paint: { 'hillshade-shadow-color': '#0b1b2b', 'hillshade-exaggeration': 0.25 }
          });
        } catch { /* noop */ }
      }
      if (typeof map.setSky === 'function') {
        try {
          map.setSky({
            'sky-color': '#7cc4ff',
            'horizon-color': '#dfeeff',
            'fog-color': '#e8f1fb',
            'fog-ground-blend': 0.5,
            'horizon-fog-blend': 0.5,
            'sky-horizon-blend': 0.7,
            'atmosphere-blend': 0.8
          });
        } catch { /* noop */ }
      }

      if (!map.getSource('plots')) {
        map.addSource('plots', {
          type: 'geojson',
          data: features,
          promoteId: 'id'
        });
      } else {
        map.getSource('plots').setData(features);
      }

      if (!map.getLayer('plots-fill')) {
        map.addLayer({
          id: 'plots-fill',
          type: 'fill-extrusion',
          source: 'plots',
          paint: {
            'fill-extrusion-color': [
              'case',
              ['boolean', ['feature-state', 'selected'], false], '#ffffff',
              ['boolean', ['feature-state', 'compare'], false], '#38bdf8',
              ['boolean', ['feature-state', 'hover'], false], '#e2f5ea',
              ['get', 'color']
            ],
            'fill-extrusion-height': ['get', 'height'],
            'fill-extrusion-base': 0,
            'fill-extrusion-opacity': 0.82
          }
        });
      }
      if (!map.getLayer('plots-line')) {
        map.addLayer({
          id: 'plots-line',
          type: 'line',
          source: 'plots',
          paint: { 'line-color': ['get', 'color'], 'line-width': 1.4, 'line-opacity': 0.9 }
        });
      }

      map.on('mousemove', 'plots-fill', (e) => {
        if (!e.features.length) return;
        map.getCanvas().style.cursor = 'pointer';
        if (hoverIdRef.current !== null && hoverIdRef.current !== e.features[0].id) {
          map.setFeatureState({ source: 'plots', id: hoverIdRef.current }, { hover: false });
        }
        hoverIdRef.current = e.features[0].id;
        map.setFeatureState({ source: 'plots', id: hoverIdRef.current }, { hover: true });
      });
      map.on('mouseleave', 'plots-fill', () => {
        map.getCanvas().style.cursor = '';
        if (hoverIdRef.current !== null) {
          map.setFeatureState({ source: 'plots', id: hoverIdRef.current }, { hover: false });
          hoverIdRef.current = null;
        }
      });

      const pick = (point) => {
        const hits = map.queryRenderedFeatures(point, { layers: ['plots-fill'] });
        if (hits.length) {
          const id = hits[0].properties.id;
          return landsRef.current.find((l) => l.id === id) || null;
        }
        let best = null;
        let bestDist = Infinity;
        for (const l of landsRef.current) {
          const c = centroid(l.geometry);
          if (!c) continue;
          const p = map.project([c[1], c[0]]);
          const d = Math.hypot(p.x - point.x, p.y - point.y);
          if (d < bestDist) { bestDist = d; best = l; }
        }
        if (best && bestDist <= 60) return best;
        return null;
      };

      const openPopup = (land, lngLat) => {
        if (!land) return;
        const compared = compareIdsRef.current.includes(land.id);
        const el = document.createElement('div');
        el.innerHTML = popupHtml(land, compared, !!onApplyRef.current);
        const applyBtn = el.querySelector('[data-apply]');
        if (applyBtn) applyBtn.addEventListener('click', () => onApplyRef.current && onApplyRef.current(land));
        const cmpBtn = el.querySelector('[data-cmp]');
        if (cmpBtn) cmpBtn.addEventListener('click', () => onToggleCompareRef.current && onToggleCompareRef.current(land.id));
        if (popupRef.current) popupRef.current.remove();
        const c = centroid(land.geometry);
        const pos = lngLat || (c ? [c[1], c[0]] : null);
        if (!pos) return;
        popupRef.current = new maplibregl.Popup({ offset: 14, closeButton: true, maxWidth: '280px' })
          .setLngLat(pos)
          .setDOMContent(el)
          .addTo(map);
      };

      map.on('click', 'plots-fill', (e) => {
        const land = landsRef.current.find((l) => l.id === e.features[0].properties.id);
        if (land && onSelectRef.current) onSelectRef.current(land);
        openPopup(land, [e.lngLat.lng, e.lngLat.lat]);
      });
      map.on('click', (e) => {
        const hits = map.queryRenderedFeatures(e.point, { layers: ['plots-fill'] });
        if (hits.length) return;
        const land = pick(e.point);
        if (land && onSelectRef.current) onSelectRef.current(land);
        if (land) openPopup(land, [e.lngLat.lng, e.lngLat.lat]);
      });

      if (landsRef.current.length) {
        const b = new maplibregl.LngLatBounds();
        landsRef.current.forEach((l) => {
          const c = centroid(l.geometry);
          if (c) b.extend([c[1], c[0]]);
        });
        if (!b.isEmpty()) map.fitBounds(b, { padding: 80, pitch: 55, duration: 0 });
      }

      map.on('mousemove', (e) => setCursor({ lat: e.lngLat.lat, lng: e.lngLat.lng, zoom: map.getZoom() }));
      map.on('mouseout', () => setCursor(null));

      readyRef.current = true;
      setReady(true);
      if (onReady) {
        onReady({
          zoomIn: () => map.zoomIn(),
          zoomOut: () => map.zoomOut(),
          invalidateSize: () => map.resize(),
          setView: ([lat, lng], z) => map.flyTo({ center: [lng, lat], zoom: z || 13, duration: 900 }),
          snapshot: () => map.getCanvas().toDataURL('image/png'),
          fitBounds: (pts) => {
            if (!pts || !pts.length) return;
            const bounds = new maplibregl.LngLatBounds();
            pts.forEach(([lat, lng]) => bounds.extend([lng, lat]));
            map.fitBounds(bounds, { padding: 80, pitch: 55, duration: 900 });
          }
        });
      }
    });

    return () => {
      readyRef.current = false;
      hoverIdRef.current = null;
      labelMarkersRef.current.forEach((m) => m.remove());
      labelMarkersRef.current = [];
      if (popupRef.current) popupRef.current.remove();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const src = map.getSource('plots');
    if (src) src.setData(features);
  }, [features]);

  // Camera: zoom onto the selected plot; otherwise frame all visible plots.
  // Keyed on `ready` so a deep-linked selection (e.g. "Xəritədə göstər") is
  // zoomed to as soon as the map finishes loading.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (selectedId) {
      const sel = lands.find((x) => x.id === selectedId);
      const c = sel ? centroid(sel.geometry) : null;
      if (c) {
        map.flyTo({ center: [c[1], c[0]], zoom: 14, pitch: 55, duration: 1000 });
        return;
      }
    }
    if (!lands.length) return;
    const b = new maplibregl.LngLatBounds();
    for (const l of lands) {
      const ring = l.geometry?.coordinates?.[0] || [];
      for (const [lng, lat] of ring) b.extend([lng, lat]);
    }
    if (b.isEmpty()) return;
    map.fitBounds(b, { padding: 90, pitch: 55, duration: 900, maxZoom: 14 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, lands, ready]);



  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    lands.forEach((l) => map.setFeatureState({ source: 'plots', id: String(l.id) }, { selected: false }));
    if (selectedId) map.setFeatureState({ source: 'plots', id: String(selectedId) }, { selected: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, features]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    lands.forEach((l) =>
      map.setFeatureState({ source: 'plots', id: String(l.id) }, { compare: compareIds.includes(l.id) })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compareIds, features]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    labelMarkersRef.current.forEach((m) => m.remove());
    labelMarkersRef.current = [];
    if (!showLabels) return undefined;
    lands.forEach((l) => {
      const c = centroid(l.geometry);
      if (!c) return;
      const color = showNdvi ? ndviColor(l.fertility) : landFillColor(l, colorMode);
      const outer = document.createElement('div');
      const inner = document.createElement('div');
      inner.className = 'map-lbl';
      inner.style.setProperty('--c', color);
      inner.innerHTML = `<i style="background:${color}"></i><span>${l.code}</span><b>${Math.round(calculateLandScore(l).score)}</b>`;
      outer.appendChild(inner);
      const marker = new maplibregl.Marker({ element: outer }).setLngLat([c[1], c[0]]).addTo(map);
      labelMarkersRef.current.push(marker);
    });
    return () => {
      labelMarkersRef.current.forEach((m) => m.remove());
      labelMarkersRef.current = [];
    };
  }, [showLabels, features, colorMode, showNdvi, lands]);

  return (
    <div className="relative" style={{ height }}>
      <div ref={containerRef} className="h-full w-full" />
      {cursor && (
        <div className="pointer-events-none absolute bottom-2 right-2 z-[5] rounded-md bg-ink-900/80 px-2 py-1 font-mono text-[10px] text-white">
          {cursor.lat.toFixed(5)}, {cursor.lng.toFixed(5)} · z{cursor.zoom}
        </div>
      )}
    </div>
  );
}
