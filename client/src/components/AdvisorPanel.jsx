import { useEffect, useState } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import { api } from '../api.js';

export default function AdvisorPanel({ land, onPickCrop }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!land?.id) {
      setData(null);
      return;
    }
    let alive = true;
    setLoading(true);
    api
      .recommend(land.id)
      .then((r) => {
        if (alive) setData(r);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [land?.id]);

  if (!land) return null;

  const top = data?.recommendations?.[0];
  const radar = top
    ? Object.entries(top.factors).map(([k, v]) => ({ factor: k, dəyər: v }))
    : [];

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold text-ink-900">
          <span className="chip bg-violet-100 text-violet-700">AI</span>
          Ağıllı Məsləhətçi
        </h3>
        {loading && <span className="text-[11px] text-brand-600">analiz edilir…</span>}
      </div>

      {!data && !loading && <p className="mt-2 text-xs text-slate-400">Məlumat yoxdur.</p>}

      {data && (
        <>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">{data.summary}</p>

          {top && (
            <div className="mt-3 rounded-xl bg-gradient-to-br from-brand-50 to-sky-50 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{top.icon}</span>
                  <div>
                    <div className="text-sm font-black text-ink-900">{top.label}</div>
                    <div className="text-[11px] text-slate-500">Tövsiyə olunan istiqamət</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-brand-700">{top.score}%</div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-400">{top.confidence} uyğunluq</div>
                </div>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/70">
                <div className="h-full rounded-full bg-brand-500" style={{ width: top.score + '%' }} />
              </div>
            </div>
          )}

          {radar.length > 0 && (
            <div className="mt-2 h-44">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radar} outerRadius="72%">
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis dataKey="factor" tick={{ fontSize: 10, fill: '#64748b' }} />
                  <Radar dataKey="dəyər" stroke="#059669" fill="#10b981" fillOpacity={0.45} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="mt-2 space-y-2">
            {data.recommendations.map((r, i) => (
              <div key={r.crop} className="rounded-lg bg-slate-50 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{r.icon}</span>
                    <span className="text-xs font-semibold text-ink-900">{r.label}</span>
                    {i === 0 && <span className="chip bg-brand-100 text-[10px] text-brand-700">#1</span>}
                  </div>
                  <span className="text-xs font-bold text-ink-900">{r.score}%</span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full" style={{ width: r.score + '%', backgroundColor: r.color }} />
                </div>
                {r.reasons.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5">
                    {r.reasons.slice(0, 2).map((why, k) => (
                      <li key={k} className="text-[10px] text-slate-500">✓ {why}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>

          {top && onPickCrop && (
            <button className="btn-primary mt-3 w-full" onClick={() => onPickCrop(top.crop)}>
              «{top.label}» ilə müraciətə keç
            </button>
          )}
        </>
      )}
    </div>
  );
}
