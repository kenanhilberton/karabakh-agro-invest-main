import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
  PieChart, Pie, AreaChart, Area
} from 'recharts';
import { api } from '../api.js';
import Icon from '../components/Icon.jsx';

const fmt = (n) => new Intl.NumberFormat('az-AZ', { maximumFractionDigits: 0 }).format(Math.round(n || 0));
const fmtMln = (n) => (n >= 1000000 ? (n / 1000000).toFixed(1) + ' mln' : fmt(n));

function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const p2 = (n) => String(n).padStart(2, '0');
  return (
    <span className="tabular-nums">
      {p2(now.getDate())}.{p2(now.getMonth() + 1)}.{now.getFullYear()} · {p2(now.getHours())}:{p2(now.getMinutes())}:{p2(now.getSeconds())}
    </span>
  );
}

const TONES = {
  brand: { grad: 'from-brand-400 to-brand-600', chip: 'bg-brand-50 text-brand-600' },
  blue: { grad: 'from-sky-400 to-indigo-600', chip: 'bg-sky-50 text-sky-600' },
  amber: { grad: 'from-amber-400 to-orange-500', chip: 'bg-amber-50 text-amber-600' },
  violet: { grad: 'from-violet-400 to-purple-600', chip: 'bg-violet-50 text-violet-600' }
};

function gradeTone(g) {
  if (g === 'A') return 'bg-brand-100 text-brand-700';
  if (g === 'B') return 'bg-sky-100 text-sky-700';
  if (g === 'C') return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-flag-red';
}

const MEDALS = ['bg-amber-400 text-white', 'bg-slate-300 text-white', 'bg-orange-400 text-white'];

export default function Analytics() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = () => api.analytics().then(setData).catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-50 text-flag-red">
          <Icon name="chart" className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-lg font-black text-ink-900">Məlumat yüklənə bilmədi</h1>
        <p className="mt-1 text-sm text-slate-500">{error}</p>
      </div>
    );
  }

  if (!data) return <Skeleton />;

  const { kpi, byDistrict, byPurpose, funnel, topApplications, competition } = data;
  const byTechnology = data.byTechnology || [];
  const byValueChain = data.byValueChain || [];
  const totalPurposeHa = byPurpose.reduce((s, p) => s + p.ha, 0) || 1;
  const funnelMax = Math.max(1, ...funnel.map((f) => f.value));
  const techMax = Math.max(1, ...byTechnology.map((t) => t.count));
  const chainMax = Math.max(1, ...byValueChain.map((v) => v.count));

  const utilization = kpi.totalPlots ? Math.round((kpi.applications / kpi.totalPlots) * 100) : 0;
  const approvalRate = kpi.applications ? Math.round((kpi.approved / kpi.applications) * 100) : 0;
  const availablePct = kpi.totalHa ? Math.round((kpi.availableHa / kpi.totalHa) * 100) : 0;
  const avgInvestment = kpi.applications ? Math.round(kpi.totalInvestment / kpi.applications) : 0;
  const avgHa = kpi.totalPlots ? Math.round(kpi.totalHa / kpi.totalPlots) : 0;

  return (
    <div>
      <section className="relative overflow-hidden bg-ink-900 text-white">
        <div className="absolute inset-0 bg-grid opacity-[0.15]" />
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-brand-500/25 blur-3xl" />
        <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-flag-blue/25 blur-3xl" />
        <div className="relative mx-auto max-w-[1400px] px-4 py-9">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-brand-300">
                <Icon name="chart" className="h-4 w-4" /> Analitika mərkəzi
              </div>
              <h1 className="mt-2 text-3xl font-black tracking-tight">Portal üzrə icmal</h1>
              <p className="mt-1 flex items-center gap-2 text-sm text-slate-300">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-400" />
                </span>
                Real vaxt məlumatları · <LiveClock />
              </p>
            </div>

            <div className="flex items-center gap-3">
              {competition && (
                <div className="flex items-center gap-2.5 rounded-xl bg-white/10 px-3.5 py-2.5 ring-1 ring-white/15 backdrop-blur">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/15 text-amber-300">
                    <Icon name="trophy" className="h-4 w-4" />
                  </span>
                  <div className="leading-tight">
                    <div className="text-xs font-bold">{competition.title}</div>
                    <div className="text-[11px] text-slate-300">{competition.daysLeft} gün qalıb</div>
                  </div>
                </div>
              )}
              <button
                onClick={refresh}
                disabled={refreshing}
                className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-ink-900 shadow-lg transition hover:bg-slate-100 disabled:opacity-70"
              >
                <Icon
                  name="bolt"
                  className={`h-4 w-4 text-brand-600 ${refreshing ? 'animate-spin' : ''}`}
                />
                Yenilə
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1400px] px-4 py-8">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            tone="brand"
            icon="layers"
            label="Ümumi torpaq fondu"
            value={`${fmt(kpi.totalHa)} ha`}
            sub={`${kpi.totalPlots} torpaq sahəsi · orta ${avgHa} ha`}
            progress={100}
          />
          <KpiCard
            tone="violet"
            icon="leaf"
            label="Mövcud (boş) sahə"
            value={`${fmt(kpi.availableHa)} ha`}
            sub={`fondun ${availablePct}%-i müraciətə açıqdır`}
            progress={availablePct}
          />
          <KpiCard
            tone="blue"
            icon="file"
            label="Müraciətlər"
            value={kpi.applications}
            sub={`${kpi.approved} təsdiqlənmiş · ${approvalRate}% uğur`}
            progress={utilization}
          />
          <KpiCard
            tone="amber"
            icon="coin"
            label="Cəlb olunan investisiya"
            value={`${fmtMln(kpi.totalInvestment)} ₼`}
            sub={kpi.avgPaybackYears ? `orta geri qaytarma ${kpi.avgPaybackYears} il` : 'müraciət gözlənilir'}
            progress={Math.min(100, utilization)}
          />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat icon="target" label="Sahə doluluğu" value={`${utilization}%`} />
          <MiniStat icon="check" label="Təsdiq nisbəti" value={`${approvalRate}%`} />
          <MiniStat icon="coin" label="Orta investisiya" value={`${fmtMln(avgInvestment)} ₼`} />
          <MiniStat icon="clock" label="Orta ödəmə" value={kpi.avgPaybackYears ? `${kpi.avgPaybackYears} il` : '—'} />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat icon="leaf" label="Əkin və bağ sahəsi" value={`${fmt(kpi.arableAreaHa)} ha`} />
          <MiniStat icon="users" label="Daimi iş yeri" value={fmt(kpi.permanentJobs)} />
          <MiniStat icon="users" label="Mövsümi iş yeri" value={fmt(kpi.seasonalJobs)} />
          <MiniStat icon="grain" label="İllik məhsul həcmi" value={`${fmt(kpi.annualOutputTons)} ton`} />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="card p-5 lg:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-bold text-ink-900">
                <Icon name="layers" className="h-4 w-4 text-brand-600" /> Rayonlar üzrə torpaq sahəsi
              </h2>
              <span className="chip bg-slate-100 text-slate-500">hektar</span>
            </div>
            <div className="mt-4 h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byDistrict} layout="vertical" margin={{ left: 12, right: 20 }}>
                  <defs>
                    <linearGradient id="barHa" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#34d399" />
                      <stop offset="100%" stopColor="#059669" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis
                    type="category"
                    dataKey="districtName"
                    tick={{ fontSize: 11, fill: '#475569' }}
                    width={88}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: '#f1f5f9' }}
                    contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #e2e8f0' }}
                    formatter={(v, n, p) => [`${v} ha · ${p.payload.plots} sahə`, '']}
                  />
                  <Bar dataKey="ha" fill="url(#barHa)" radius={[0, 6, 6, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card p-5">
            <h2 className="flex items-center gap-2 text-sm font-bold text-ink-900">
              <Icon name="leaf" className="h-4 w-4 text-brand-600" /> Təyinat üzrə bölgü
            </h2>
            <div className="relative mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={byPurpose}
                    dataKey="ha"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={58}
                    outerRadius={88}
                    paddingAngle={3}
                    stroke="none"
                  >
                    {byPurpose.map((p) => (
                      <Cell key={p.purpose} fill={p.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #e2e8f0' }}
                    formatter={(v, n) => [`${v} ha`, n]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 grid place-items-center">
                <div className="text-center">
                  <div className="text-2xl font-black text-ink-900">{fmt(totalPurposeHa)}</div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-400">hektar</div>
                </div>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {byPurpose.map((p) => (
                <div key={p.purpose} className="flex items-center gap-2 text-xs">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                  <span className="flex-1 truncate text-slate-600">{p.label}</span>
                  <span className="font-semibold text-ink-900">{fmt(p.ha)} ha</span>
                  <span className="w-9 text-right text-slate-400">
                    {Math.round((p.ha / totalPurposeHa) * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="card p-5 lg:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-bold text-ink-900">
                <Icon name="trend" className="h-4 w-4 text-brand-600" /> Rayonlar üzrə investisiya
                potensialı
              </h2>
              <span className="chip bg-slate-100 text-slate-500">₼</span>
            </div>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={byDistrict} margin={{ left: -8, right: 12 }}>
                  <defs>
                    <linearGradient id="inv" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                  <XAxis dataKey="districtName" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={fmtMln} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #e2e8f0' }}
                    formatter={(v) => [`${fmt(v)} ₼`, 'İnvestisiya']}
                  />
                  <Area
                    type="monotone"
                    dataKey="investment"
                    stroke="#0ea5e9"
                    fill="url(#inv)"
                    strokeWidth={2.5}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card p-5">
            <h2 className="flex items-center gap-2 text-sm font-bold text-ink-900">
              <Icon name="compass" className="h-4 w-4 text-brand-600" /> Müraciət mərhələləri
            </h2>
            <div className="mt-4 space-y-3.5">
              {funnel.map((f) => {
                const width = Math.round((f.value / funnelMax) * 100);
                return (
                  <div key={f.key}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-600">{f.label}</span>
                      <span className="font-bold text-ink-900">{f.value}</span>
                    </div>
                    <div className="h-7 w-full overflow-hidden rounded-lg bg-slate-100">
                      <div
                        className="flex h-full items-center rounded-lg bg-gradient-to-r from-brand-500 to-sky-500 px-2 text-[10px] font-bold text-white transition-all duration-700"
                        style={{ width: Math.max(width, f.value > 0 ? 14 : 0) + '%' }}
                      >
                        {f.value > 0 && `${f.value}`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-bold text-ink-900">
                <Icon name="sparkle" className="h-4 w-4 text-violet-600" /> Müasir texnologiyalar
              </h2>
              <span className="chip bg-slate-100 text-slate-500">müraciət üzrə</span>
            </div>
            <div className="mt-4 space-y-3.5">
              {byTechnology.length === 0 && <p className="text-xs text-slate-400">Məlumat yoxdur.</p>}
              {byTechnology.map((t) => {
                const width = Math.round((t.count / techMax) * 100);
                return (
                  <div key={t.key}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-600">{t.label}</span>
                      <span className="font-bold text-ink-900">{t.count}</span>
                    </div>
                    <div className="h-3 w-full overflow-hidden rounded-lg bg-slate-100">
                      <div
                        className="h-full rounded-lg bg-gradient-to-r from-violet-500 to-purple-600 transition-all duration-700"
                        style={{ width: Math.max(width, t.count > 0 ? 10 : 0) + '%' }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-bold text-ink-900">
                <Icon name="layers" className="h-4 w-4 text-brand-600" /> Dəyər zənciri
              </h2>
              <span className="chip bg-slate-100 text-slate-500">mərhələ üzrə</span>
            </div>
            <div className="mt-4 space-y-3.5">
              {byValueChain.length === 0 && <p className="text-xs text-slate-400">Məlumat yoxdur.</p>}
              {byValueChain.map((v, i) => {
                const width = Math.round((v.count / chainMax) * 100);
                return (
                  <div key={v.key}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-600">
                        <span className="mr-1.5 text-slate-300">{i + 1}.</span>
                        {v.label}
                      </span>
                      <span className="font-bold text-ink-900">{v.count}</span>
                    </div>
                    <div className="h-3 w-full overflow-hidden rounded-lg bg-slate-100">
                      <div
                        className="h-full rounded-lg bg-gradient-to-r from-brand-500 to-sky-500 transition-all duration-700"
                        style={{ width: Math.max(width, v.count > 0 ? 10 : 0) + '%' }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-bold text-ink-900">
                <Icon name="award" className="h-4 w-4 text-brand-600" /> Top müraciətlər
              </h2>
              <span className="chip bg-slate-100 text-slate-500">skor üzrə</span>
            </div>
            <div className="mt-4 space-y-2">
              {topApplications.length === 0 && (
                <p className="text-xs text-slate-400">Hələ müraciət yoxdur.</p>
              )}
              {topApplications.map((a, i) => {
                let medal = 'bg-slate-200 text-slate-600';
                if (i < 3) medal = MEDALS[i];
                return (
                  <div
                    key={a.trackingCode}
                    className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 transition hover:border-brand-200 hover:bg-brand-50/50"
                  >
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-black ${medal}`}>
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-ink-900">
                        {a.company || a.applicantName}
                      </div>
                      <div className="truncate text-[11px] text-slate-400">
                        {a.districtName} · {fmtMln(a.investmentAmount)} ₼ · {a.trackingCode}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-black tabular-nums text-ink-900">{a.score ?? '—'}</div>
                      {a.grade && (
                        <span className={`chip text-[10px] ${gradeTone(a.grade)}`}>{a.grade}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card overflow-hidden p-0">
            <div className="flex items-center justify-between p-5 pb-3">
              <h2 className="flex items-center gap-2 text-sm font-bold text-ink-900">
                <Icon name="building" className="h-4 w-4 text-brand-600" /> Rayonlar üzrə doluluq
              </h2>
              <span className="chip bg-slate-100 text-slate-500">{byDistrict.length} rayon</span>
            </div>
            <div className="max-h-[360px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-y border-slate-100 text-[10px] uppercase tracking-wide text-slate-400">
                    <th className="px-5 py-2 text-left font-semibold">Rayon</th>
                    <th className="px-2 py-2 text-right font-semibold">Sahə</th>
                    <th className="px-2 py-2 text-right font-semibold">Təyinat sayı</th>
                    <th className="px-5 py-2 text-right font-semibold">Doluluq</th>
                  </tr>
                </thead>
                <tbody>
                  {byDistrict.map((d) => {
                    const occ = d.plots ? Math.round((d.applications / d.plots) * 100) : 0;
                    return (
                      <tr key={d.district} className="border-b border-slate-50 hover:bg-slate-50/60">
                        <td className="px-5 py-2.5 font-semibold text-ink-900">{d.districtName}</td>
                        <td className="px-2 py-2.5 text-right tabular-nums text-slate-600">{fmt(d.ha)} ha</td>
                        <td className="px-2 py-2.5 text-right tabular-nums text-slate-600">{d.plots}</td>
                        <td className="px-5 py-2.5">
                          <div className="flex items-center justify-end gap-2">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full rounded-full bg-brand-500"
                                style={{ width: `${Math.max(occ, d.applications > 0 ? 8 : 0)}%` }}
                              />
                            </div>
                            <span className="w-8 text-right text-xs font-semibold text-slate-500">
                              {occ}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value, sub, tone = 'brand', progress = 0 }) {
  const t = TONES[tone] || TONES.brand;
  return (
    <div className="card relative overflow-hidden p-4">
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${t.grad}`} />
      <div className="flex items-start justify-between">
        <span className={`grid h-9 w-9 place-items-center rounded-lg ${t.chip}`}>
          <Icon name={icon} className="h-4 w-4" />
        </span>
        <span className="text-right text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          {label}
        </span>
      </div>
      <div className="mt-3 text-2xl font-black tabular-nums text-ink-900">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-slate-400">{sub}</div>}
      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full bg-gradient-to-r ${t.grad}`} style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

function MiniStat({ icon, label, value }) {
  return (
    <div className="card flex items-center gap-3 p-3.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-50 text-brand-600">
        <Icon name={icon} className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
        <div className="truncate text-sm font-black text-ink-900">{value}</div>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div>
      <div className="h-40 animate-pulse bg-ink-900" />
      <div className="mx-auto max-w-[1400px] space-y-4 px-4 py-8">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card h-28 animate-pulse bg-slate-100" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="card h-96 animate-pulse bg-slate-100 lg:col-span-2" />
          <div className="card h-96 animate-pulse bg-slate-100" />
        </div>
      </div>
    </div>
  );
}
