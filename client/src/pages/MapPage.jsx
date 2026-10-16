import { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import MapView from '../components/MapView.jsx';
import ROICalculator from '../components/ROICalculator.jsx';
import AdvisorPanel from '../components/AdvisorPanel.jsx';
import NdviPanel from '../components/NdviPanel.jsx';
import Icon from '../components/Icon.jsx';
import { STATUS_COLORS } from '../constants.js';
import { sortLandsSmart, calculateLandScore } from '../utils/landScore.js';
import { landFillColor, legendFor, COLOR_MODES, reliefLabel } from '../utils/mapColors.js';
import { BASEMAP_LIST, DEFAULT_BASEMAP, normalizeBasemap } from '../utils/basemaps.js';

const Map3D = lazy(() => import('../components/Map3D.jsx'));

const BASEMAPS = BASEMAP_LIST;

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

function fertilityTone(v) {
  if (v >= 75) return 'bg-brand-500';
  if (v >= 55) return 'bg-lime-500';
  if (v >= 40) return 'bg-amber-500';
  return 'bg-orange-500';
}

function phTone(ph) {
  if (ph >= 6 && ph <= 7.5) return 'bg-brand-500';
  if (ph >= 5.5 && ph <= 8.2) return 'bg-amber-500';
  return 'bg-flag-red';
}

function waterTone(km) {
  if (km <= 5) return 'bg-brand-500';
  if (km <= 12) return 'bg-amber-500';
  return 'bg-orange-500';
}

function compareRowCls(on) {
  if (on) {
    return 'grid w-8 shrink-0 place-items-center rounded-lg bg-brand-600 text-sm font-bold text-white';
  }
  return 'grid w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-sm font-bold text-slate-500 hover:bg-slate-200';
}

function ndviHex(fertility) {
  const v = 0.35 + (fertility / 100) * 0.4;
  if (v >= 0.65) return '#166534';
  if (v >= 0.55) return '#22c55e';
  if (v >= 0.47) return '#a3e635';
  if (v >= 0.42) return '#facc15';
  return '#f97316';
}

function triggerDownload(href, filename) {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.click();
}

// Composes the current 2D Leaflet view (tiles + plot polygons) into a PNG.
function composeLeafletPng(map, lands, colorMode, showNdvi) {
  if (!map) return null;
  const size = map.getSize();
  const canvas = document.createElement('canvas');
  canvas.width = size.x;
  canvas.height = size.y;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0b1b2b';
  ctx.fillRect(0, 0, size.x, size.y);
  const contRect = map.getContainer().getBoundingClientRect();
  const tiles = map.getContainer().querySelectorAll('.leaflet-tile');
  tiles.forEach((img) => {
    if (!img.complete || !img.naturalWidth) return;
    const r = img.getBoundingClientRect();
    try {
      ctx.drawImage(img, r.left - contRect.left, r.top - contRect.top, r.width, r.height);
    } catch {
      /* tainted tile — skip */
    }
  });
  for (const l of lands) {
    const pts = l.geometry.coordinates[0].map(([lng, lat]) => map.latLngToContainerPoint([lat, lng]));
    if (!pts.length) continue;
    const color = showNdvi ? ndviHex(l.fertility) : landFillColor(l, colorMode);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = color;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  try {
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

export default function MapPage() {
  const initialParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const [meta, setMeta] = useState({ districts: [], crops: [], statuses: [] });
  const [lands, setLands] = useState([]);
  const [filters, setFilters] = useState(() => ({
    district: initialParams.get('district') || '',
    purpose: initialParams.get('purpose') || '',
    status: initialParams.get('status') || ''
  }));
  const [query, setQuery] = useState(() => initialParams.get('q') || '');
  const [selected, setSelected] = useState(null);
  const [favorites, setFavorites] = useState(() => {
    try { return JSON.parse(localStorage.getItem('kai_fav_lands') || '[]'); } catch { return []; }
  });
  useEffect(() => {
    try { localStorage.setItem('kai_fav_lands', JSON.stringify(favorites)); } catch {}
  }, [favorites]);
  const [roiMax, setRoiMax] = useState(200);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showNdvi, setShowNdvi] = useState(() => initialParams.get('ndvi') === '1');
  const [basemap, setBasemap] = useState(() => normalizeBasemap(initialParams.get('base')));
  const [view, setView] = useState(() => initialParams.get('view') || '3d');
  const [legendOpen, setLegendOpen] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [sortMode, setSortMode] = useState(() => initialParams.get('sort') || 'smart');
  const [colorMode, setColorMode] = useState(() => initialParams.get('color') || 'purpose');
  const [showLabels, setShowLabels] = useState(() => initialParams.get('labels') === '1');
  const [compareIds, setCompareIds] = useState([]);
  const [measureActive, setMeasureActive] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [toast, setToast] = useState('');
  const navigate = useNavigate();

  const mapRef = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    Promise.all([api.meta(), api.lands()])
      .then(([m, l]) => {
        setMeta(m);
        setLands(l);
        const wantedSel = initialParams.get('sel');
        if (wantedSel) {
          const found = l.find((x) => String(x.id) === String(wantedSel));
          if (found) setSelected(found);
        }
      })
      .catch((e) => setError(e.message || 'Xəritə məlumatları yüklənmədi'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onFs = () => {
      setFullscreen(!!document.fullscreenElement);
      setTimeout(() => mapRef.current?.invalidateSize(), 250);
    };
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const statusLabel = useMemo(
    () => Object.fromEntries((meta.statuses || []).map((s) => [s.key, s.label])),
    [meta.statuses]
  );

  const legendItems = useMemo(() => legendFor(colorMode, meta), [colorMode, meta]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = lands.filter((l) => {
      if (filters.district && l.district !== filters.district) return false;
      if (filters.purpose && l.purpose !== filters.purpose) return false;
      if (filters.status && l.status !== filters.status) return false;
      if (q) {
        const hay = `${l.code} ${l.districtName} ${l.purposeLabel} ${reliefLabel(l.relief)}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    if (sortMode === 'smart') return sortLandsSmart(list);
    if (sortMode === 'area') return [...list].sort((a, b) => b.areaHa - a.areaHa);
    if (sortMode === 'fertility') return [...list].sort((a, b) => b.fertility - a.fertility);
    if (sortMode === 'water') return [...list].sort((a, b) => a.waterKm - b.waterKm);
    return list;
  }, [lands, filters, query, sortMode]);

  const stats = useMemo(() => {
    let totalHa = 0;
    let availableHa = 0;
    for (const l of filtered) {
      totalHa += l.areaHa;
      if (l.status === 'available') availableHa += l.areaHa;
    }
    return { count: filtered.length, totalHa: Math.round(totalHa), availableHa: Math.round(availableHa) };
  }, [filtered]);

  const center = useMemo(() => {
    if (selected) {
      const c = centroid(selected.geometry);
      if (c) return c;
    }
    if (filters.district) {
      const d = meta.districts.find((x) => x.key === filters.district);
      if (d) return d.center;
    }
    return [39.7, 46.8];
  }, [selected, filters.district, meta.districts]);

  // Open zoomed-in when a land is selected (e.g. deep-link from Birgəİnvest).
  const mapZoom = useMemo(() => {
    if (selected) return 14;
    if (filters.district) return 11;
    return 9;
  }, [selected, filters.district]);

  const handleReady = useCallback((map) => {
    mapRef.current = map;
  }, []);

  const zoomIn = useCallback(() => mapRef.current?.zoomIn(), []);
  const zoomOut = useCallback(() => mapRef.current?.zoomOut(), []);
  const recenter = useCallback(() => {
    const map = mapRef.current;
    if (!map || !filtered.length) return;
    const pts = filtered.flatMap((l) => l.geometry.coordinates[0].map(([lng, lat]) => [lat, lng]));
    if (pts.length) map.fitBounds(pts, { padding: [50, 50] });
  }, [filtered]);
  const locate = useCallback(() => {
    const map = mapRef.current;
    if (!map || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => map.setView([pos.coords.latitude, pos.coords.longitude], 13),
      () => {}
    );
  }, []);
  const toggleFullscreen = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen?.();
    else document.exitFullscreen?.();
  }, []);

  const switchView = (v) => {
    setView(v);
    if (view === '3d') setMeasureActive(false);
  };

  const toggleMeasure = () => {
    if (view === '3d') setView('2d');
    setMeasureActive((v) => !v);
  };

  const resetFilters = () => {
    setFilters({ district: '', purpose: '', status: '' });
    setQuery('');
  };

  const osmUrl = useMemo(() => {
    const c = selected ? centroid(selected.geometry) : null;
    if (!c) return '#';
    const lat = c[0].toFixed(5);
    const lon = c[1].toFixed(5);
    return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=14/${lat}/${lon}`;
  }, [selected]);

  useEffect(() => {
    if (selected) setRoiMax(Number(selected.areaHa) || 200);
  }, [selected?.id]);

  // Keep the URL in sync so a configured view can be shared as a deep-link.
  const selectedId = selected?.id;
  useEffect(() => {
    if (loading) return; // avoid clobbering deep-link before data is resolved
    const p = new URLSearchParams();
    if (filters.district) p.set('district', filters.district);
    if (filters.purpose) p.set('purpose', filters.purpose);
    if (filters.status) p.set('status', filters.status);
    if (query) p.set('q', query);
    if (sortMode !== 'smart') p.set('sort', sortMode);
    if (basemap !== DEFAULT_BASEMAP) p.set('base', basemap);
    if (view !== '3d') p.set('view', view);
    if (showNdvi) p.set('ndvi', '1');
    if (colorMode !== 'purpose') p.set('color', colorMode);
    if (showLabels) p.set('labels', '1');
    if (selectedId) p.set('sel', String(selectedId));
    const qs = p.toString();
    window.history.replaceState(null, '', qs ? `/map?${qs}` : '/map');
  }, [loading, filters, query, sortMode, basemap, view, showNdvi, colorMode, showLabels, selectedId]);

  const showToast = useCallback((msg) => {
    setToast(msg);
    window.setTimeout(() => setToast(''), 2600);
  }, []);

  const toggleCompare = useCallback(
    (id) => {
      setCompareIds((prev) => {
        if (prev.includes(id)) return prev.filter((x) => x !== id);
        if (prev.length >= 4) {
          showToast('Müqayisə üçün maksimum 4 sahə seçilə bilər');
          return prev;
        }
        return [...prev, id];
      });
    },
    [showToast]
  );

  const exportGeoJson = useCallback(() => {
    const fc = {
      type: 'FeatureCollection',
      properties: { colorMode, generatedAt: new Date().toISOString() },
      features: filtered.map((l) => ({
        type: 'Feature',
        id: l.id,
        properties: {
          code: l.code,
          district: l.districtName,
          purpose: l.purpose,
          areaHa: l.areaHa,
          fertility: l.fertility,
          ph: l.ph,
          waterKm: l.waterKm,
          sunDays: l.sunDays,
          relief: l.relief,
          ownerType: 'dovlet',
          status: l.status
        },
        geometry: l.geometry
      }))
    };
    const blob = new Blob([JSON.stringify(fc, null, 2)], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, 'karabakh-torpaq.geojson');
    URL.revokeObjectURL(url);
    setExportOpen(false);
  }, [filtered, colorMode]);

  const exportPng = useCallback(() => {
    try {
      if (view === '3d') {
        const snap = mapRef.current?.snapshot?.();
        if (!snap) {
          showToast('PNG üçün 3D xəritə hələ hazır deyil');
          return;
        }
        triggerDownload(snap, 'karabakh-xerite.png');
      } else {
        const png = composeLeafletPng(mapRef.current, filtered, colorMode, showNdvi);
        if (!png) {
          showToast('PNG export alınmadı (kafel məhdudiyyəti)');
          return;
        }
        triggerDownload(png, 'karabakh-xerite.png');
      }
    } catch {
      showToast('PNG export alınmadı');
    }
    setExportOpen(false);
  }, [view, filtered, colorMode, showNdvi, showToast]);

  const goCompare = useCallback(() => {
    if (compareIds.length < 2) return;
    navigate(`/compare?ids=${compareIds.join(',')}`);
  }, [compareIds, navigate]);

  const selectCrop = (p) =>
    setSelected((s) => ({
      ...s,
      purpose: p,
      purposeLabel: meta.crops.find((c) => c.key === p)?.label || s.purposeLabel
    }));

  // "«X» ilə müraciətə keç" — open the application wizard for this plot with the
  // recommended crop preselected.
  const applyWithCrop = (p) => {
    if (!selected?.id) return;
    navigate(`/apply/${selected.id}?purpose=${encodeURIComponent(p)}`);
  };

  let ndviBtn = 'btn-ghost';
  if (showNdvi) ndviBtn = 'btn-primary';
  let labelsBtn = 'btn-ghost';
  if (showLabels) labelsBtn = 'btn-primary';
  let measureBtn = 'btn-ghost';
  if (measureActive) measureBtn = 'btn-blue';

  const mapProps = {
    lands: filtered,
    selectedId: selected?.id,
    center,
    zoom: mapZoom,
    onSelect: setSelected,
    onApply: (l) => navigate(`/apply/${l.id}`),
    onToggleCompare: toggleCompare,
    compareIds,
    colorMode,
    showLabels,
    measureActive,
    showNdvi,
    basemap,
    onReady: handleReady
  };

  let mapEl;
  if (view === '3d') {
    mapEl = (
      <Suspense
        fallback={
          <div className="grid h-full place-items-center text-sm text-slate-400">
            <span className="animate-pulse">3D xəritə yüklənir…</span>
          </div>
        }
      >
                <Map3D key={`${basemap}-${view}`} {...mapProps} />
      </Suspense>
    );
  } else {
    mapEl = <MapView {...mapProps} />;
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">
            <Icon name="map" className="h-4 w-4" /> Coğrafi məlumat sistemi
          </div>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-ink-900">
            İnteraktiv torpaq xəritəsi
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Dövlət tərəfindən irəli sürülən torpaq sahələri relyefinə görə (düzənlik, dağ ətəyi,
            dağlıq) fərqləndirilir — filtrələyin, xəritədə araşdırın və AI məsləhətçi ilə məhsul
            istiqamətini müəyyənləşdirin.
          </p>
        </div>
        <div className="flex gap-2">
          <Stat label="Sahə" value={stats.count} />
          <Stat label="Ümumi" value={`${stats.totalHa} ha`} />
          <Stat label="Boş" value={`${stats.availableHa} ha`} />
        </div>
      </header>

      <div className="card mb-4 flex flex-wrap items-center gap-2 p-2.5">
        <div className="relative min-w-[200px] flex-1">
          <Icon
            name="search"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Kod və ya rayon üzrə axtar…"
            className="input w-full pl-9"
          />
        </div>
        <select
          className="input w-auto"
          value={filters.district}
          onChange={(e) => setFilters((f) => ({ ...f, district: e.target.value }))}
        >
          <option value="">Bütün rayonlar</option>
          {meta.districts.map((d) => (
            <option key={d.key} value={d.key}>
              {d.name}
            </option>
          ))}
        </select>
        <select
          className="input w-auto"
          value={filters.purpose}
          onChange={(e) => setFilters((f) => ({ ...f, purpose: e.target.value }))}
        >
          <option value="">Bütün təyinatlar</option>
          {meta.crops.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
        <select
          className="input w-auto"
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
        >
          <option value="">Bütün statuslar</option>
          {meta.statuses.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          className="input w-auto"
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value)}
          title="Sıralama üsulu"
        >
          <option value="smart">Ağıllı (məhsuldarlıq)</option>
          <option value="area">Sahə (böyük→kiçik)</option>
          <option value="fertility">Münbitlik</option>
          <option value="water">Su yaxınlığı</option>
        </select>
        <select
          className="input w-auto"
          value={colorMode}
          onChange={(e) => setColorMode(e.target.value)}
          title="Rəng rejimi"
        >
          {COLOR_MODES.map((m) => (
            <option key={m.key} value={m.key}>
              Rəng: {m.label}
            </option>
          ))}
        </select>
        <button className="btn-ghost" onClick={resetFilters}>
          Sıfırla
        </button>
        <button
          className={ndviBtn}
          onClick={() => setShowNdvi((v) => !v)}
          title="Peyk bitki örtüyü qatı"
        >
          <Icon name="leaf" className="h-4 w-4" /> NDVI qatı
        </button>
        <button
          className={labelsBtn}
          onClick={() => setShowLabels((v) => !v)}
          title="Sahə kodları və skor nişanları"
        >
          <Icon name="tag" className="h-4 w-4" /> Labellər
        </button>
        <button
          className={measureBtn}
          onClick={toggleMeasure}
          title="Məsafə və sahə ölçmə aləti (2D)"
        >
          <Icon name="ruler" className="h-4 w-4" /> Ölçmə
        </button>
        <div className="flex items-center overflow-hidden rounded-lg border border-slate-200">
          {['2d', '3d'].map((v) => {
            const on = view === v;
            const cls = on ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50';
            return (
              <button
                key={v}
                onClick={() => switchView(v)}
                className={`px-3 py-2 text-xs font-bold uppercase transition ${cls}`}
                title={v === '3d' ? '3D relyefli görünüş' : '2D xəritə görünüşü'}
              >
                {v}
              </button>
            );
          })}
        </div>
        <div className="relative">
          <button
            className="btn-ghost"
            onClick={() => setExportOpen((o) => !o)}
            title="Nəticələri ixrac et"
          >
            <Icon name="download" className="h-4 w-4" /> İxrac
          </button>
          {exportOpen && (
            <div className="absolute right-0 top-full z-[900] mt-1 w-44 overflow-hidden rounded-lg bg-white shadow-xl ring-1 ring-slate-200">
              <button
                onClick={exportGeoJson}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-ink-700 hover:bg-slate-50"
              >
                <Icon name="file" className="h-4 w-4 text-brand-600" /> GeoJSON ({filtered.length})
              </button>
              <button
                onClick={exportPng}
                className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-xs font-semibold text-ink-700 hover:bg-slate-50"
              >
                <Icon name="external" className="h-4 w-4 text-brand-600" /> Xəritə PNG
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
        <div ref={wrapRef} className="card relative h-[68vh] min-h-[480px] overflow-hidden p-0">
          {loading ? (
            <div className="grid h-full place-items-center text-sm text-slate-400">Yüklənir…</div>
          ) : error ? (
            <div className="grid h-full place-items-center px-6 text-center text-sm text-flag-red">{error}</div>
          ) : (
            mapEl
          )}

          {!loading && (
            <>
              <div className="absolute left-3 top-3 z-20 flex flex-col gap-2">
                <div className="flex items-center gap-2 rounded-xl bg-ink-900/85 px-3 py-2 text-white shadow-lg backdrop-blur">
                  <Icon name="layers" className="h-4 w-4 text-brand-300" />
                  <span className="text-xs font-semibold">{filtered.length} sahə</span>
                  <span className="text-slate-500">·</span>
                  <span className="text-xs">{stats.totalHa} ha</span>
                </div>
                <div className="flex flex-col items-start gap-2">
                  <button
                    onClick={() => setLegendOpen((o) => !o)}
                    className="flex items-center gap-1.5 rounded-xl bg-white/90 px-3 py-1.5 text-xs font-semibold text-ink-700 shadow-lg ring-1 ring-slate-200 backdrop-blur transition hover:bg-white"
                  >
                    <Icon name="star" className="h-3.5 w-3.5 text-brand-600" /> Legenda
                    <Icon name={legendOpen ? 'minus' : 'plus'} className="h-3 w-3" />
                  </button>
                  {legendOpen && (
                    <div className="w-[230px] rounded-xl bg-white/90 p-3 shadow-lg ring-1 ring-slate-200 backdrop-blur">
                      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        Rəng rejimi: {COLOR_MODES.find((m) => m.key === colorMode)?.label}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {legendItems.map((it) => (
                          <span
                            key={it.label}
                            className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                            style={{ backgroundColor: it.color }}
                          >
                            {it.label}
                          </span>
                        ))}
                      </div>
                      <div className="mt-2 border-t border-slate-100 pt-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        Status
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {meta.statuses.map((s) => (
                          <span key={s.key} className={`chip ${STATUS_COLORS[s.key] || 'bg-slate-100 text-slate-600'}`}>
                            {s.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="absolute right-3 top-3 z-20 flex flex-col gap-2">
                <div className="flex flex-col overflow-hidden rounded-xl bg-white/90 shadow-lg ring-1 ring-slate-200 backdrop-blur">
                  <MapBtn icon="plus" label="Yaxınlaşdır" onClick={zoomIn} />
                  <span className="h-px bg-slate-200" />
                  <MapBtn icon="minus" label="Uzaqlaşdır" onClick={zoomOut} />
                </div>
                <div className="flex flex-col gap-0.5 rounded-xl bg-white/90 p-1 shadow-lg ring-1 ring-slate-200 backdrop-blur">
                  <MapBtn icon="target" label="Nəticələrə sığdır" onClick={recenter} />
                  <MapBtn icon="crosshair" label="Mənim yerim" onClick={locate} />
                  <MapBtn
                    icon={fullscreen ? 'minimize' : 'maximize'}
                    label="Tam ekran"
                    onClick={toggleFullscreen}
                  />
                </div>
                {true && (
                  <div className="flex flex-col gap-0.5 rounded-xl bg-white/90 p-1 shadow-lg ring-1 ring-slate-200 backdrop-blur">
                    {BASEMAPS.map((b) => (
                      <BasemapBtn
                        key={b.key}
                        label={b.label}
                        active={basemap === b.key}
                        onClick={() => setBasemap(b.key)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {!loading && compareIds.length > 0 && (
            <div className="absolute bottom-3 left-3 z-[800] flex items-center gap-2 rounded-xl bg-ink-900/90 px-3 py-2 text-white shadow-lg backdrop-blur">
              <Icon name="layers" className="h-4 w-4 text-brand-300" />
              <span className="text-xs font-semibold">{compareIds.length}/4 seçilib</span>
              <button
                onClick={goCompare}
                disabled={compareIds.length < 2}
                className="rounded-md bg-brand-600 px-2.5 py-1 text-xs font-bold transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Müqayisə et
              </button>
              <button
                onClick={() => setCompareIds([])}
                className="rounded-md bg-white/10 px-2 py-1 text-xs font-semibold hover:bg-white/20"
              >
                Təmizlə
              </button>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          {selected ? (
            <>
              <div className="card overflow-hidden p-0">
                <div className="relative overflow-hidden bg-ink-900 p-4 text-white">
                  <div className="absolute inset-0 bg-grid opacity-30" />
                  <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-brand-500/30 blur-3xl" />
                  <div className="relative">
                    <div className="flex items-center justify-between gap-2">
                      <span className="chip bg-white/10 text-brand-200">Torpaq sahəsi</span>
                      <span className={`chip ${STATUS_COLORS[selected.status] || 'bg-white/10 text-white'}`}>
                        {statusLabel[selected.status] || selected.status}
                      </span>
                    </div>
                    <h2 className="mt-2 text-2xl font-black leading-tight">{selected.districtName} {favorites.includes(selected.id) ? '★' : ''}</h2>
                    <div className="mt-1 flex items-center gap-2 text-sm text-slate-300">
                      <span>{selected.purposeLabel}</span>
                      <span className="text-slate-500">·</span>
                      <span className="font-mono text-xs">{selected.code}</span>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        className="btn-primary flex-1"
                        onClick={() => navigate(`/apply/${selected.id}`)}
                      >
                        Müraciət et →
                      </button>
                      <button
                        className="btn-ghost flex-1"
                        onClick={() =>
                          navigate(
                            `/investments/new?landId=${selected.id}&district=${selected.district}&purpose=${selected.purpose}&areaHa=${selected.areaHa}&landCode=${selected.code}&relief=${encodeURIComponent(reliefLabel(selected.relief))}`
                          )
                        }
                      >
                        Birgəİnvest layihəsi →
                      </button>
                      <a
                        href={osmUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-ghost border-white/20 bg-white/10 text-white hover:bg-white/20"
                        title="OpenStreetMap-də aç"
                      >
                        <Icon name="external" className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-2 gap-2">
                    <MetricTile label="Sahə" value={`${selected.areaHa} ha`} />
                    <MetricTile label="Relyef" value={reliefLabel(selected.relief)} />
                    <MetricTile label="Torpaq sahibi" value="Dövlət (Torpaq Fondu)" />
                    <MetricTile label="İcarə qaydası" value={selected.cadence} />
                  </div>
                  <div className="mt-3 space-y-3">
                    <Gauge
                      label="Münbitlik indeksi"
                      value={selected.fertility}
                      max={100}
                      suffix="/100"
                      tone={fertilityTone(selected.fertility)}
                    />
                    <Gauge
                      label="Torpaq pH"
                      value={selected.ph}
                      max={14}
                      decimals={1}
                      suffix=" · ideal 6–7.5"
                      tone={phTone(selected.ph)}
                    />
                    <Gauge
                      label="Su mənbəyinə məsafə"
                      value={selected.waterKm}
                      max={30}
                      suffix=" km"
                      tone={waterTone(selected.waterKm)}
                      invert
                    />
                    <Gauge
                      label="Günəşli günlər / il"
                      value={selected.sunDays}
                      max={320}
                      suffix=" gün"
                      tone="bg-amber-500"
                    />
                  </div>
                </div>
              </div>

              <ROICalculator
                crops={meta.crops}
                purpose={selected.purpose}
                areaHa={selected.areaHa}
                maxHa={roiMax}
                onPurpose={selectCrop}
                onArea={(a) => setSelected((s) => ({ ...s, areaHa: Number(a) }))}
              />
              <AdvisorPanel land={selected} onPickCrop={applyWithCrop} />
              <NdviPanel land={selected} />
            </>
          ) : (
            <div className="card p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-ink-900">Nəticələr</h3>
                <span className="chip bg-slate-100 text-slate-600">{filtered.length}</span>
              </div>
              {filtered.length === 0 ? (
                <p className="mt-3 text-sm text-slate-400">Filtrə uyğun sahə tapılmadı.</p>
              ) : (
                <ul className="mt-2 max-h-[56vh] space-y-1.5 overflow-auto pr-1">
                  {filtered.map((l) => {
                    const { score, grade } = calculateLandScore(l);
                    return (
                      <li key={l.id} className="flex items-stretch gap-1">
                        <button
                          onClick={() => setSelected(l)}
                          className="flex w-full items-center gap-2.5 rounded-lg border border-slate-100 p-2 text-left transition hover:border-brand-200 hover:bg-brand-50/60"
                        >
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: l.color }}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-semibold text-ink-900">
                              {l.districtName}
                            </span>
                            <span className="block truncate text-[11px] text-slate-400">
                              {l.code} · {l.purposeLabel} · ⛰ {reliefLabel(l.relief)}
                            </span>
                          </span>
                          <span className="text-right flex flex-col items-end gap-1">
                            <span className="block text-xs font-bold text-ink-900">{l.areaHa} ha</span>
                            <span className={`chip ${STATUS_COLORS[l.status] || 'bg-slate-100 text-slate-600'}`}>
                              {statusLabel[l.status] || l.status}
                            </span>
                            <span className={`chip bg-brand-50 text-brand-700 text-[10px] font-bold`}>
                              {score} · {grade}
                            </span>
                          </span>
                        </button>
                        <button
                          onClick={() => toggleCompare(l.id)}
                          title={compareIds.includes(l.id) ? 'Müqayisədən çıxar' : 'Müqayisəyə əlavə'}
                          className={compareRowCls(compareIds.includes(l.id))}
                        >
                          {compareIds.includes(l.id) ? '✓' : '+'}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </aside>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[2000] -translate-x-1/2 rounded-xl bg-ink-900 px-4 py-2.5 text-sm font-semibold text-white shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}

function MapBtn({ icon, label, onClick, active }) {
  const base = 'grid h-9 w-9 place-items-center rounded-lg transition';
  let cls = `${base} text-slate-600 hover:bg-slate-100`;
  if (active) cls = `${base} bg-brand-600 text-white`;
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label} className={cls}>
      <Icon name={icon} className="h-4 w-4" />
    </button>
  );
}

function BasemapBtn({ label, active, onClick }) {
  let cls =
    'rounded-md px-2 py-1 text-[10px] font-bold leading-tight text-slate-600 transition hover:bg-slate-100';
  if (active) cls = 'rounded-md px-2 py-1 text-[10px] font-bold leading-tight bg-brand-600 text-white';
  return (
    <button type="button" onClick={onClick} className={cls}>
      {label}
    </button>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-center shadow-sm">
      <div className="text-lg font-black leading-none text-ink-900">{value}</div>
      <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </div>
    </div>
  );
}

function MetricTile({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2.5">
      <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-0.5 text-sm font-bold text-ink-900">{value}</div>
    </div>
  );
}

function Gauge({ label, value, max, suffix = '', tone = 'bg-brand-500', invert = false, decimals = 0 }) {
  const raw = Math.max(0, Math.min(100, (value / max) * 100));
  let width = raw;
  if (invert) width = 100 - raw;
  width = Math.max(4, width);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-medium text-slate-500">{label}</span>
        <span className="whitespace-nowrap text-sm font-bold text-ink-900">
          {Number(value).toFixed(decimals)}
          {suffix}
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}
