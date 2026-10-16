import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceArea } from 'recharts';
import { api } from '../api.js';

export default function NdviPanel({ land }) {
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
      .ndvi(land.id)
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

  let healthTone = 'text-slate-500';
  let healthBg = 'bg-slate-50';
  if (data?.current.health === 'Yaxşı') {
    healthTone = 'text-brand-700';
    healthBg = 'bg-brand-50';
  } else if (data?.current.health === 'Orta') {
    healthTone = 'text-amber-700';
    healthBg = 'bg-amber-50';
  } else if (data?.current.health === 'Zəif') {
    healthTone = 'text-flag-red';
    healthBg = 'bg-red-50';
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold text-ink-900">
          <span className="chip bg-emerald-100 text-emerald-700">🛰️ Peyk</span>
          Bitki örtüyü monitorinqi
        </h3>
        {loading && <span className="text-[11px] text-brand-600">yüklənir…</span>}
      </div>

      {data && (
        <>
          <div className="mt-2 flex items-center gap-3">
            <div className={`rounded-lg px-3 py-2 ${healthBg}`}>
              <div className="text-[10px] uppercase tracking-wide text-slate-400">NDVI indeksi</div>
              <div className={`text-2xl font-black ${healthTone}`}>{data.current.value}</div>
            </div>
            <div className="text-xs text-slate-500">
              <div className="font-semibold text-ink-900">{data.current.label}</div>
              <div>{data.current.health} vəziyyət</div>
              <div className="mt-0.5 text-[10px] text-slate-400">{data.source}</div>
            </div>
          </div>

          <div className="mt-3 h-32">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.series} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#94a3b8' }} interval={1} />
                <YAxis domain={[0, 1]} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                <ReferenceArea y1={0.6} y2={1} fill="#10b981" fillOpacity={0.06} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(v) => [v, 'NDVI']} />
                <Line type="monotone" dataKey="ndvi" stroke="#059669" strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-1 text-[10px] text-slate-400">
            * Sentinel-2 mock data · 10 m rezolyusiya · aylıq vegetasiya indeksi
          </p>
        </>
      )}
    </div>
  );
}
