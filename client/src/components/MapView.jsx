import {
  MapContainer,
  TileLayer,
  Polygon,
  Popup,
  Tooltip,
  ScaleControl,
  Polyline,
  CircleMarker,
  Marker,
  useMap
} from 'react-leaflet';
import L from 'leaflet';
import { useEffect, useMemo, useRef, useState } from 'react';
import { landFillColor, reliefLabel } from '../utils/mapColors.js';
import { calculateLandScore } from '../utils/landScore.js';
import { BASEMAPS, DEFAULT_BASEMAP } from '../utils/basemaps.js';

const TILE_SOURCES = Object.fromEntries(
  Object.values(BASEMAPS).map((b) => [
    b.key,
    {
      url: b.raster,
      attribution: b.rasterAttribution || b.attribution,
      maxZoom: b.maxZoom || 19,
      nativeMaxZoom: b.nativeMaxZoom,
      tileClass: b.tileClass
    }
  ])
);

function toLatLngs(geometry) {
  return geometry.coordinates[0].map(([lng, lat]) => [lat, lng]);
}

// Ray-casting: is the clicked point inside this polygon?
function pointInPolygon(lat, lng, geometry) {
  const ring = geometry?.coordinates?.[0] || [];
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect = (yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// Polygon centroid (average of ring vertices) — used for "nearest plot" snapping
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

function FitBounds({ lands }) {
  const map = useMap();
  useEffect(() => {
    if (!lands.length) return;
    const all = lands.flatMap((l) => toLatLngs(l.geometry));
    if (all.length) map.fitBounds(all, { padding: [40, 40] });
  }, [lands, map]);
  return null;
}

// Keeps the map's maximum zoom in sync with the active basemap. This stops the
// user from zooming past the point where the provider actually has imagery, so
// the picture never turns into a blank/"no data" tile.
function MaxZoom({ maxZoom }) {
  const map = useMap();
  useEffect(() => {
    if (typeof maxZoom !== 'number') return;
    map.setMaxZoom(maxZoom);
    if (map.getZoom() > maxZoom) map.setZoom(maxZoom);
  }, [map, maxZoom]);
  return null;
}

// Smoothly flies to the selected plot when the selection changes.
function FlyToSelected({ land }) {
  const map = useMap();
  const prev = useRef(null);
  useEffect(() => {
    if (!land) return;
    if (prev.current === land.id) return;
    prev.current = land.id;
    const pts = toLatLngs(land.geometry);
    if (pts.length) map.flyToBounds(pts, { padding: [70, 70], maxZoom: 15, duration: 0.9 });
  }, [land, map]);
  return null;
}

// Stable selection handler: attached once to the map instance (no react-leaflet
// event-handler churn), so clicking a plot always works even after re-renders.
function MapSelect({ lands, onSelect, enabled }) {
  const map = useMap();
  const landsRef = useRef(lands);
  const onSelectRef = useRef(onSelect);
  const enabledRef = useRef(enabled);
  landsRef.current = lands;
  onSelectRef.current = onSelect;
  enabledRef.current = enabled;

  useEffect(() => {
    const handler = (e) => {
      if (!enabledRef.current) return;
      const lands = landsRef.current || [];
      if (!lands.length || !onSelectRef.current) return;
      const { lat, lng } = e.latlng;
      // 1) exact hit: the click landed inside a plot polygon
      let hit = lands.find((l) => pointInPolygon(lat, lng, l.geometry));
      // 2) forgiving: plots are tiny on a zoomed-out map, so snap to the
      //    nearest plot centre within 45px of the click
      if (!hit) {
        const clickPt = map.latLngToContainerPoint(e.latlng);
        let best = null;
        let bestDist = Infinity;
        for (const l of lands) {
          const c = centroid(l.geometry);
          if (!c) continue;
          const d = clickPt.distanceTo(map.latLngToContainerPoint(c));
          if (d < bestDist) {
            bestDist = d;
            best = l;
          }
        }
        if (best && bestDist <= 45) hit = best;
      }
      if (hit) onSelectRef.current(hit);
    };
    map.on('click', handler);
    return () => {
      map.off('click', handler);
    };
  }, [map]);

  return null;
}

// Reports pointer position + zoom for the live readout.
function CursorProbe({ onChange }) {
  const map = useMap();
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  useEffect(() => {
    const onMove = (e) => {
      if (onChangeRef.current) {
        onChangeRef.current({ lat: e.latlng.lat, lng: e.latlng.lng, zoom: map.getZoom() });
      }
    };
    const onZoom = () => {
      if (onChangeRef.current) {
        onChangeRef.current((c) => (c ? { ...c, zoom: map.getZoom() } : c));
      }
    };
    const onLeave = () => onChangeRef.current && onChangeRef.current(null);
    map.on('mousemove', onMove);
    map.on('mouseout', onLeave);
    map.on('zoomend', onZoom);
    return () => {
      map.off('mousemove', onMove);
      map.off('mouseout', onLeave);
      map.off('zoomend', onZoom);
    };
  }, [map]);
  return null;
}

// Collects measurement clicks while the measure tool is active.
function MeasureCapture({ active, onPoint }) {
  const map = useMap();
  const activeRef = useRef(active);
  const onPointRef = useRef(onPoint);
  activeRef.current = active;
  onPointRef.current = onPoint;
  useEffect(() => {
    const onClick = (e) => {
      if (!activeRef.current || !onPointRef.current) return;
      onPointRef.current([e.latlng.lat, e.latlng.lng]);
    };
    map.on('click', onClick);
    return () => map.off('click', onClick);
  }, [map]);
  return null;
}

// Exposes the Leaflet map instance to the parent so it can drive custom controls.
function MapHandle({ onReady }) {
  const map = useMap();
  useEffect(() => {
    if (onReady) onReady(map);
  }, [map, onReady]);
  return null;
}

function ndviColor(fertility) {
  const v = 0.35 + (fertility / 100) * 0.4;
  if (v >= 0.65) return '#166534';
  if (v >= 0.55) return '#22c55e';
  if (v >= 0.47) return '#a3e635';
  if (v >= 0.42) return '#facc15';
  return '#f97316';
}

function scoreBadge(land) {
  const { score } = calculateLandScore(land);
  return Math.round(score);
}

function PlotLabels({ lands, colorMode, showNdvi }) {
  return lands.map((land) => {
    const c = centroid(land.geometry);
    if (!c) return null;
    const color = showNdvi ? ndviColor(land.fertility) : landFillColor(land, colorMode);
    const html = `<div class="map-lbl" style="--c:${color}"><i style="background:${color}"></i><span>${land.code}</span><b>${scoreBadge(land)}</b></div>`;
    return (
      <Marker
        key={land.id}
        position={c}
        interactive={false}
        icon={L.divIcon({ html, className: 'map-lbl-wrap', iconSize: [0, 0] })}
      />
    );
  });
}

export default function MapView({
  lands = [],
  selectedId,
  onSelect,
  onApply,
  onToggleCompare,
  compareIds = [],
  colorMode = 'purpose',
  showLabels = false,
  measureActive = false,
  center = [39.7, 46.8],
  zoom = 9,
  height = '100%',
  showNdvi = false,
  basemap = DEFAULT_BASEMAP,
  onReady
}) {
  const [hovered, setHovered] = useState(null);

  const districtStats = useMemo(() => {
    const m = new Map();
    for (const land of lands) {
      const prev = m.get(land.district) || { plots: 0, ha: 0 };
      prev.plots += 1;
      prev.ha += Number(land.areaHa) || 0;
      m.set(land.district, prev);
    }
    return m;
  }, [lands]);
  const [cursor, setCursor] = useState(null);
  const [measurePts, setMeasurePts] = useState([]);
  const [mapInstance, setMapInstance] = useState(null);
  const tiles = TILE_SOURCES[basemap] || TILE_SOURCES[DEFAULT_BASEMAP];

  const handleReady = (m) => {
    setMapInstance(m);
    if (onReady) onReady(m);
  };

  useEffect(() => {
    if (!mapInstance) return;
    mapInstance.getContainer().style.cursor = measureActive ? 'crosshair' : '';
  }, [mapInstance, measureActive]);

  const focusLand = useMemo(() => lands.find((l) => l.id === selectedId) || null, [lands, selectedId]);

  useEffect(() => {
    if (!measureActive) setMeasurePts([]);
  }, [measureActive]);

  const measure = useMemo(() => {
    if (measurePts.length < 2) return { dist: 0, area: 0 };
    return { dist: pathDistanceKm(measurePts), area: polygonAreaHa(measurePts) };
  }, [measurePts]);

  let containerClass = 'z-0';

  return (
    <div className="relative" style={{ height }}>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom
        zoomControl={false}
        maxZoom={tiles.maxZoom}
        preferCanvas
        className={containerClass}
      >
        <MaxZoom maxZoom={tiles.maxZoom} />
        <TileLayer
          key={basemap}
          url={tiles.url}
          attribution={tiles.attribution}
          maxZoom={tiles.maxZoom}
          maxNativeZoom={tiles.nativeMaxZoom || tiles.maxZoom}
          className={tiles.tileClass}
          crossOrigin
        />
        <ScaleControl position="bottomleft" imperial={false} />
        <FitBounds lands={lands} />
        <FlyToSelected land={focusLand} />
        <MapSelect lands={lands} onSelect={onSelect} enabled={!measureActive} />
        <MeasureCapture active={measureActive} onPoint={(p) => setMeasurePts((prev) => [...prev, p])} />
        <CursorProbe onChange={setCursor} />
        <MapHandle onReady={handleReady} />
        {lands.map((land) => {
          const selected = land.id === selectedId;
          const isHover = land.id === hovered;
          const compared = compareIds.includes(land.id);
          const color = showNdvi ? ndviColor(land.fertility) : landFillColor(land, colorMode);
          let btnLabel = selected ? 'Seçildi ✓' : 'Bu sahəni seç';
          if (onApply) btnLabel = 'Müraciət et →';
          let weight = 1.5;
          if (selected) weight = 4;
          else if (isHover) weight = 3;
          let fillOpacity = showNdvi ? 0.5 : 0.32;
          if (colorMode === 'heat' && !showNdvi) fillOpacity = 0.6;
          if (selected) fillOpacity = 0.6;
          else if (isHover) fillOpacity = Math.max(fillOpacity, 0.5);
          const pathOptions = { color, fillColor: color, fillOpacity, weight };
          if (compared) {
            pathOptions.color = '#0f172a';
            pathOptions.dashArray = '6 4';
            pathOptions.weight = Math.max(weight, 3);
          }
          return (
            <Polygon
              key={land.id}
              positions={toLatLngs(land.geometry)}
              interactive={!measureActive}
              eventHandlers={{
                click: () => onSelect && onSelect(land),
                mouseover: () => setHovered(land.id),
                mouseout: () => setHovered((h) => (h === land.id ? null : h))
              }}
              pathOptions={pathOptions}
            >
              <Tooltip sticky>
                <span className="font-semibold">{land.districtName}</span> · {land.purposeLabel} ·{' '}
                {land.areaHa} ha · <span className="font-semibold">{reliefLabel(land.relief)}</span>
              </Tooltip>
              <Popup>
                <div className="min-w-[200px] space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-sm">{land.districtName}</strong>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                      {land.code}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600">{land.purposeLabel}</div>
                  <div className="text-[11px]">
                    <span className="rounded bg-brand-50 px-1.5 py-0.5 font-semibold text-brand-700">
                      🏛 Dövlət torpağı
                    </span>
                    <span className="ml-1 rounded bg-lime-50 px-1.5 py-0.5 font-semibold text-lime-700">
                      ⛰ {reliefLabel(land.relief)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-slate-500">
                    <div>Sahə: <b className="text-ink-900">{land.areaHa} ha</b></div>
                    <div>pH: <b className="text-ink-900">{land.ph}</b></div>
                    <div>Münbitlik: <b className="text-ink-900">{land.fertility}</b></div>
                    <div>Su: <b className="text-ink-900">{land.waterKm} km</b></div>
                    <div>Günəşli gün: <b className="text-ink-900">{land.sunDays}</b></div>
                  </div>
                  <button
                    onClick={() => {
                      if (onSelect) onSelect(land);
                      if (onApply) onApply(land);
                    }}
                    className="mt-1 w-full rounded-md bg-brand-600 px-2 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
                  >
                    {btnLabel}
                  </button>
                  {onToggleCompare && (
                    <button
                      onClick={() => onToggleCompare(land.id)}
                      className="w-full rounded-md bg-slate-100 px-2 py-1.5 text-xs font-semibold text-ink-700 hover:bg-slate-200"
                    >
                      {compared ? '— Müqayisədən çıxar' : '+ Müqayisəyə əlavə'}
                    </button>
                  )}
                </div>
              </Popup>
            </Polygon>
          );
        })}
        {showLabels && <PlotLabels lands={lands} colorMode={colorMode} showNdvi={showNdvi} />}
        {measurePts.length > 1 && (
          <Polyline positions={measurePts} pathOptions={{ color: '#0f172a', weight: 2, dashArray: '5 4' }} />
        )}
        {measurePts.length > 2 && (
          <Polygon positions={measurePts} pathOptions={{ color: '#0f172a', weight: 1.5, fillColor: '#0f172a', fillOpacity: 0.12 }} />
        )}
        {measurePts.map((p, i) => (
          <CircleMarker key={i} center={p} radius={4} pathOptions={{ color: '#0f172a', fillColor: '#fff', fillOpacity: 1, weight: 2 }} />
        ))}
      </MapContainer>

      {cursor && (
        <div className="pointer-events-none absolute bottom-2 right-2 z-[800] rounded-md bg-ink-900/80 px-2 py-1 font-mono text-[10px] text-white">
          {cursor.lat.toFixed(5)}, {cursor.lng.toFixed(5)} · z{cursor.zoom}
        </div>
      )}

      {measureActive && (
        <div className="absolute bottom-3 left-1/2 z-[800] flex -translate-x-1/2 items-center gap-3 rounded-xl bg-white/95 px-3 py-2 text-xs shadow-lg ring-1 ring-slate-200 backdrop-blur">
          <span className="font-semibold text-ink-900">Ölçmə</span>
          <span className="text-slate-600">
            Məsafə: <b className="text-ink-900">{formatDistance(measure.dist)}</b>
          </span>
          <span className="text-slate-600">
            Sahə: <b className="text-ink-900">{formatArea(measure.area)}</b>
          </span>
          <span className="text-slate-400">{measurePts.length} nöqtə</span>
          <button
            onClick={() => setMeasurePts([])}
            className="rounded-md bg-slate-100 px-2 py-1 font-semibold text-ink-700 hover:bg-slate-200"
          >
            Təmizlə
          </button>
        </div>
      )}
    </div>
  );
}
