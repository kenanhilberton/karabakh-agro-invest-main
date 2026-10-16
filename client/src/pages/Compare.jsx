import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { calculateLandScore, sortLandsSmart } from '../utils/landScore.js';
import Icon from '../components/Icon.jsx';

const MAX_LANDS = 4;

const METRICS = [
  { key: 'areaHa', label: 'Sahə', suffix: ' ha', higherBetter: true },
  { key: 'fertility', label: 'Münbitlik indeksi', suffix: '/100', higherBetter: true },
  { key: 'ph', label: 'Torpaq pH', suffix: '', higherBetter: false, optimal: { min: 6.0, max: 7.0 } },
  { key: 'waterKm', label: 'Su mənbəyinə məsafə', suffix: ' km', higherBetter: false },
  { key: 'sunDays', label: 'Günəşli günlər', suffix: ' gün', higherBetter: true }
];

function scoreMetric(land, metric) {
  const val = land[metric.key];
  if (val === undefined || val === null) return 0;

  if (metric.optimal) {
    const { min, max } = metric.optimal;
    if (val >= min && val <= max) return 100;
    const dist = val < min ? min - val : val - max;
    return Math.max(0, 100 - dist * 20);
  }

  if (metric.higherBetter) {
    return Math.min(100, val);
  }
  return Math.max(0, 100 - val * 10);
}

function MetricBar({ value, label, tone = 'bg-brand-500' }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px] font-medium text-slate-600">
        <span>{label}</span>
        <span className="font-bold text-ink-900">{Math.round(pct)}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${tone} transition-all duration-500`} style={{ width: `${Math.max(4, pct)}%` }} />
      </div>
    </div>
  );
}

const GRADE_COLORS = {
  A: 'bg-brand-500',
  B: 'bg-lime-500',
  C: 'bg-amber-500',
  D: 'bg-orange-500',
  F: 'bg-red-500'
};

function LandCard({ land, onRemove }) {
  const { score, grade, breakdown } = calculateLandScore(land);
  const roi = Math.round((land.fertility / 100) * 200 + (100 - Math.min(land.waterKm * 10, 100)));

  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="absolute right-3 top-3 z-10">
        <button
          onClick={() => onRemove(land.id)}
          className="grid h-8 w-8 place-items-center rounded-full bg-red-50 text-flag-red transition hover:bg-red-100"
          title="Kaldır"
        >
          <Icon name="x" className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-lg font-black text-white">
              {land.districtName?.slice(0, 2)}
            </span>
            <div>
              <h3 className="text-lg font-black leading-tight text-ink-900">{land.districtName}</h3>
              <p className="text-sm text-slate-500">{land.code} · {land.purposeLabel}</p>
            </div>
          </div>
          <span className={`chip ${GRADE_COLORS[grade] || 'bg-brand-500'} px-2.5 py-0.5 text-xs font-bold text-white`}>
            {grade}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Ümumi skor</div>
            <div className="text-2xl font-black text-ink-900">{score}</div>
          </div>
          <div className="rounded-xl bg-brand-50 p-3">
            <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Sahə</div>
            <div className="text-2xl font-black text-brand-700">{land.areaHa} ha</div>
          </div>
        </div>

        <div className="space-y-2">
          {METRICS.map((m) => (
            <MetricBar
              key={m.key}
              value={scoreMetric(land, m)}
              label={m.label}
              tone={m.key === 'ph' || m.key === 'sunDays' ? 'bg-amber-500' : m.key === 'waterKm' ? 'bg-sky-500' : 'bg-brand-500'}
            />
          ))}
        </div>

        {breakdown && (
          <div className="rounded-xl bg-slate-50/70 p-3">
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Bal paylanması</div>
            <div className="space-y-1">
              {Object.entries(breakdown).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between text-[11px] text-slate-600">
                  <span className="capitalize">{k}</span>
                  <span className="font-semibold text-ink-900">{typeof v === 'number' ? Math.round(v) : v}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-center text-xs">
          <div className="rounded-lg bg-brand-50 p-2">
            <div className="text-[10px] font-medium text-brand-700">ROI (5 il)</div>
            <div className="font-bold text-brand-800">{roi}%+</div>
          </div>
          <div className="rounded-lg bg-sky-50 p-2">
            <div className="text-[10px] font-medium text-sky-700">Su</div>
            <div className="font-bold text-sky-800">{land.waterKm} km</div>
          </div>
          <div className="rounded-lg bg-amber-50 p-2">
            <div className="text-[10px] font-medium text-amber-700">Günəş</div>
            <div className="font-bold text-amber-800">{land.sunDays} gün</div>
          </div>
        </div>

        <div className="flex gap-2">
          <Link to={`/map?land=${land.id}`} className="btn-ghost flex-1 text-sm">
            <Icon name="map" className="h-4 w-4" /> Xəritə
          </Link>
          <Link to={`/apply/${land.id}`} className="btn-primary flex-1 text-sm">
            Müraciət et
          </Link>
        </div>
      </div>
    </div>
  );
}

function EmptySlot({ index, onAdd }) {
  return (
    <button
      onClick={onAdd}
      className="relative flex h-full min-h-[320px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-6 text-center transition hover:border-brand-300 hover:bg-brand-50/40"
    >
      <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-xl bg-slate-100 text-slate-400">
        <Icon name="plus" className="h-8 w-8" />
      </div>
      <h4 className="text-sm font-semibold text-slate-500">Sahə {index + 1}</h4>
      <p className="mt-1 text-xs text-slate-400">Sahə əlavə etmək üçün klikləyin</p>
      <span className="btn-primary mt-4 w-full text-sm">Sahə seç</span>
    </button>
  );
}

function LandPicker({ open, lands, selectedIds, onPick, onClose }) {
  const [query, setQuery] = useState('');
  const [purpose, setPurpose] = useState('all');

  useEffect(() => {
    if (open) {
      setQuery('');
      setPurpose('all');
    }
  }, [open]);

  const purposes = useMemo(() => {
    const set = new Map();
    for (const l of lands) set.set(l.purpose, l.purposeLabel);
    return [['all', 'Hamısı'], ...set.entries()];
  }, [lands]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return lands.filter((l) => {
      if (purpose !== 'all' && l.purpose !== purpose) return false;
      if (!q) return true;
      return `${l.districtName} ${l.code} ${l.purposeLabel}`.toLowerCase().includes(q);
    });
  }, [lands, query, purpose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-ink-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <div>
            <h3 className="text-lg font-black text-ink-900">Sahə seç</h3>
            <p className="text-xs text-slate-500">Müqayisə üçün mövcud torpaq sahələrindən seçin</p>
          </div>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200">
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row">
          <div className="relative flex-1">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-9"
              placeholder="Rayon, kod və ya təyinat üzrə axtar…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </div>
          <select className="input sm:w-48" value={purpose} onChange={(e) => setPurpose(e.target.value)}>
            {purposes.map(([v, label]) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </select>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4">
          {filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">Uyğun sahə tapılmadı.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {filtered.map((l) => {
                const picked = selectedIds.includes(l.id);
                const { score, grade } = calculateLandScore(l);
                return (
                  <li key={l.id}>
                    <button
                      disabled={picked}
                      onClick={() => onPick(l.id)}
                      className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                        picked
                          ? 'cursor-not-allowed border-brand-200 bg-brand-50/60 opacity-60'
                          : 'border-slate-100 hover:border-brand-300 hover:bg-brand-50/40'
                      }`}
                    >
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: l.color }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-ink-900">{l.districtName}</span>
                        <span className="block truncate text-[11px] text-slate-400">{l.code} · {l.purposeLabel} · {l.areaHa} ha</span>
                      </span>
                      <span className={`chip ${GRADE_COLORS[grade] || 'bg-brand-500'} text-[11px] font-bold text-white`}>
                        {picked ? 'Seçildi' : `${score} · ${grade}`}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryTable({ lands }) {
  return (
    <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
      <div className="mb-4 flex items-center gap-2">
        <Icon name="chart" className="h-5 w-5 text-brand-600" />
        <h3 className="text-lg font-bold text-ink-900">Xülasə müqayisə cədvəli</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
              <th className="pb-2">Göstərici</th>
              {lands.map((l, i) => (
                <th key={l.id} className="pb-2 text-center font-bold text-ink-900">
                  <span className="mr-1 text-slate-400">{i + 1}.</span>{l.code}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {METRICS.map((m) => {
              const scores = lands.map((l) => scoreMetric(l, m));
              const best = Math.max(...scores);
              return (
                <tr key={m.key} className="text-center">
                  <td className="py-2 text-left font-medium text-slate-600">{m.label}</td>
                  {lands.map((l, i) => {
                    const val = l[m.key];
                    const isBest = scores[i] === best && lands.length > 1;
                    return (
                      <td key={l.id} className={`py-2 font-semibold ${isBest ? 'text-brand-700' : 'text-ink-900'}`}>
                        <span className="inline-flex items-center gap-1">
                          {typeof val === 'number' ? val.toFixed(m.key === 'ph' ? 1 : 0) : '—'}
                          {m.suffix && <span className="text-[10px] font-normal text-slate-400">{m.suffix.trim()}</span>}
                          {isBest && <Icon name="award" className="h-3.5 w-3.5 text-brand-500" />}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            <tr className="text-center">
              <td className="py-2 text-left font-medium text-slate-600">Ümumi skor</td>
              {lands.map((l) => {
                const { score, grade } = calculateLandScore(l);
                return (
                  <td key={l.id} className="py-2">
                    <span className={`chip ${GRADE_COLORS[grade] || 'bg-brand-500'} font-bold text-white`}>{score} · {grade}</span>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ComparePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [allLands, setAllLands] = useState([]);
  const [selectedIds, setSelectedIds] = useState(
    () => searchParams.get('ids')?.split(',').filter(Boolean).slice(0, MAX_LANDS) || []
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);

  const load = () => {
    setLoading(true);
    setError('');
    api
      .lands({ status: 'available' })
      .then((l) => {
        setAllLands(l);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message || 'Sahələri yükləmək mümkün olmadı');
        setLoading(false);
      });
  };

  useEffect(load, []);

  useEffect(() => {
    const ids = (searchParams.get('ids')?.split(',').filter(Boolean) || []).slice(0, MAX_LANDS);
    setSelectedIds(ids);
  }, [searchParams]);

  const syncParams = (ids) => {
    setSelectedIds(ids);
    const next = new URLSearchParams(searchParams);
    if (ids.length) next.set('ids', ids.join(','));
    else next.delete('ids');
    setSearchParams(next, { replace: true });
  };

  const addLand = (id) => {
    if (selectedIds.includes(id) || selectedIds.length >= MAX_LANDS) return;
    syncParams([...selectedIds, id]);
    setPickerOpen(false);
  };

  const removeLand = (id) => syncParams(selectedIds.filter((x) => x !== id));

  const selectedLands = useMemo(
    () => allLands.filter((l) => selectedIds.includes(l.id)),
    [allLands, selectedIds]
  );
  const sortedLands = useMemo(() => sortLandsSmart(selectedLands), [selectedLands]);

  return (
    <div className="min-h-[70vh] bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="flex items-center gap-2 text-3xl font-black text-ink-900">
                <Icon name="flag" className="h-7 w-7 text-brand-600" /> Sahə müqayisəsi
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-500">
                Ən çox {MAX_LANDS} sahəni yan-yana yerləşdirib münbitlik, ROI, su, pH və digər göstəricilərə görə müqayisə edin.
              </p>
            </div>
            <span className="chip bg-white text-slate-600 ring-1 ring-slate-200">
              {selectedIds.length} / {MAX_LANDS} sahə seçilib
            </span>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => setPickerOpen(true)} disabled={selectedIds.length >= MAX_LANDS}>
              <Icon name="plus" className="h-4 w-4" /> Sahə əlavə et
            </button>
            <button className="btn-ghost" onClick={() => navigate('/map')}>
              <Icon name="map" className="h-4 w-4" /> Xəritəyə bax
            </button>
            {selectedIds.length > 0 && (
              <button className="btn-ghost" onClick={() => syncParams([])}>
                <Icon name="x" className="h-4 w-4" /> Təmizlə
              </button>
            )}
          </div>
        </div>

        {error ? (
          <div className="mx-auto max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-red-50 text-flag-red">
              <Icon name="x" className="h-7 w-7" />
            </div>
            <h3 className="mt-4 text-lg font-bold text-ink-900">Xəta baş verdi</h3>
            <p className="mt-1 text-sm text-slate-500">{error}</p>
            <button className="btn-primary mt-5" onClick={load}>Yenidən cəhd et</button>
          </div>
        ) : loading ? (
          <div className="grid min-h-[40vh] place-items-center">
            <div className="flex flex-col items-center gap-3 text-slate-500">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
              <span className="text-sm font-medium">Sahələr yüklənir…</span>
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: Math.max(3, selectedIds.length) }).map((_, i) =>
                sortedLands[i] ? (
                  <LandCard key={sortedLands[i].id} land={sortedLands[i]} onRemove={removeLand} />
                ) : (
                  <EmptySlot key={`empty-${i}`} index={i} onAdd={() => setPickerOpen(true)} />
                )
              )}
            </div>

            {selectedIds.length >= 2 && <SummaryTable lands={sortedLands} />}
          </>
        )}
      </div>

      <LandPicker
        open={pickerOpen}
        lands={allLands}
        selectedIds={selectedIds}
        onPick={addLand}
        onClose={() => setPickerOpen(false)}
      />
    </div>
  );
}
