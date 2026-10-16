import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import Countdown from '../components/Countdown.jsx';
import Icon from '../components/Icon.jsx';

const fmt = (n) => new Intl.NumberFormat('az-AZ', { maximumFractionDigits: 0 }).format(n || 0);
const dateLong = (iso) => new Date(iso).toLocaleDateString('az-AZ', { day: '2-digit', month: 'long', year: 'numeric' });
const dateShort = (iso) => new Date(iso).toLocaleDateString('az-AZ', { day: '2-digit', month: 'short', year: 'numeric' });
const daysUntil = (iso) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));

const STAGE_ICONS = ['file', 'shield', 'target', 'award', 'trophy'];
const INCENTIVE_ICONS = ['calendar', 'coin', 'shield', 'leaf', 'users', 'bolt'];

function downloadIcs(comp) {
  const stamp = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//KarabakhAgroInvest//Competition//AZ',
    'BEGIN:VEVENT',
    `UID:${comp.id}@karabakhagroinvest.az`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(comp.startDate)}`,
    `DTEND:${stamp(comp.endDate)}`,
    `SUMMARY:${comp.title}`,
    `DESCRIPTION:${comp.description.replace(/\s+/g, ' ')}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ];
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${comp.code}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function StatusBadge({ status }) {
  if (status === 'active') {
    return (
      <span className="chip bg-brand-500/20 text-brand-200 ring-1 ring-brand-400/30">
        <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-brand-400" />
        Aktiv
      </span>
    );
  }
  if (status === 'closed') {
    return <span className="chip bg-white/10 text-slate-300 ring-1 ring-white/15">Bağlı</span>;
  }
  return <span className="chip bg-amber-400/15 text-amber-200 ring-1 ring-amber-300/30">Yaxınlaşır</span>;
}

function Kpi({ icon, label, value, sub }) {
  return (
    <div className="rounded-xl bg-white/5 px-4 py-3 ring-1 ring-white/10">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        <Icon name={icon} className="h-3.5 w-3.5 text-brand-300" />
        {label}
      </div>
      <div className="mt-1 text-lg font-black text-white">{value}</div>
      {sub && <div className="text-[11px] text-slate-400">{sub}</div>}
    </div>
  );
}

export default function Competition() {
  const [list, setList] = useState([]);
  const [crops, setCrops] = useState([]);
  const [econ, setEcon] = useState([]);
  const [stats, setStats] = useState(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    api
      .competitions()
      .then(setList)
      .catch((e) => setError(e.message || 'Müsabiqələri yükləmək mümkün olmadı'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    api.meta().then((m) => setCrops(m.crops)).catch(() => {});
    api.roiCrops().then(setEcon).catch(() => {});
    api.landStats().then(setStats).catch(() => {});
  }, [load]);

  const active = useMemo(() => list.find((c) => c.status === 'active') || list[0], [list]);
  const others = useMemo(() => list.filter((c) => c.id !== active?.id), [list, active]);
  const cropMap = useMemo(() => Object.fromEntries(crops.map((c) => [c.key, c])), [crops]);
  const econMap = useMemo(() => Object.fromEntries(econ.map((e) => [e.key, e])), [econ]);

  const progress = useMemo(() => {
    if (!active) return 0;
    const start = new Date(active.startDate).getTime();
    const end = new Date(active.endDate).getTime();
    return Math.max(0, Math.min(1, (Date.now() - start) / (end - start || 1)));
  }, [active]);

  const stageCount = active?.stages?.length || 1;
  const autoStage = Math.min(stageCount - 1, Math.floor(progress * stageCount));
  const currentStage = Number.isInteger(active?.currentStage)
    ? Math.max(0, Math.min(stageCount - 1, active.currentStage))
    : autoStage;
  const progressPct = Math.round(progress * 100);

  function share() {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: active.title, url }).catch(() => {});
      return;
    }
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  if (loading && !active) {
    return (
      <div className="grid min-h-[60vh] place-items-center bg-slate-50">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          <span className="text-sm font-medium">Müsabiqələr yüklənir…</span>
        </div>
      </div>
    );
  }

  if (error && !active) {
    return (
      <div className="grid min-h-[60vh] place-items-center bg-slate-50 px-4">
        <div className="mx-auto max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-red-50 text-flag-red">
            <Icon name="x" className="h-7 w-7" />
          </div>
          <h3 className="mt-4 text-lg font-bold text-ink-900">Müsabiqə məlumatı yüklənmədi</h3>
          <p className="mt-1 text-sm text-slate-500">{error}</p>
          <button className="btn-primary mt-5" onClick={load}>Yenidən cəhd et</button>
        </div>
      </div>
    );
  }

  if (!active) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-20 text-center text-sm text-slate-400">
        Hazırda aktiv müsabiqə yoxdur.
      </div>
    );
  }

  return (
    <div>
      <section className="relative overflow-hidden bg-ink-900 text-white">
        <div className="absolute inset-0 bg-grid opacity-50" />
        <div className="absolute -left-24 top-[-120px] h-[420px] w-[420px] animate-blob rounded-full bg-brand-500/25 blur-3xl" />
        <div className="absolute right-[-160px] top-10 h-[460px] w-[460px] animate-blob rounded-full bg-flag-blue/20 blur-3xl" style={{ animationDelay: '3s' }} />

        <div className="relative mx-auto max-w-6xl px-4 py-14">
          <div className="flex animate-fade-up flex-wrap items-center gap-2">
            <span className="chip bg-flag-blue/15 text-flag-blue ring-1 ring-flag-blue/20">İnvestisiya müsabiqəsi</span>
            <StatusBadge status={active.status} />
            <span className="chip bg-white/5 text-slate-300 ring-1 ring-white/10">{active.code}</span>
          </div>

          <h1 className="mt-4 max-w-3xl text-3xl font-black leading-tight tracking-tight sm:text-4xl animate-fade-up delay-1">
            {active.title}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300 animate-fade-up delay-2">
            {active.description}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3 animate-fade-up delay-2">
            <Link to="/apply" className="btn-primary px-5 py-3">
              Müraciət et
              <Icon name="arrow" className="h-4 w-4" />
            </Link>
            <button type="button" onClick={() => downloadIcs(active)} className="btn bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/20">
              <Icon name="calendar" className="h-4 w-4" />
              Təqvimə əlavə et
            </button>
            <button type="button" onClick={share} className="btn bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/20">
              <Icon name={copied ? 'check' : 'share'} className="h-4 w-4" />
              {copied ? 'Kopyalandı' : 'Paylaş'}
            </button>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-[1.5fr_1fr] animate-fade-up delay-3">
            <div className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Kpi icon="coin" label="Mükafat fondu" value={`${fmt(active.totalBudget)} ₼`} />
                <Kpi icon="file" label="Müraciətlər" value={active.applicationsCount} />
                <Kpi icon="layers" label="Kateqoriyalar" value={(active.categories || []).length} />
                <Kpi icon="clock" label="Qalan gün" value={active.daysLeft} />
              </div>

              <div className="mt-6">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>{dateLong(active.startDate)}</span>
                  <span>{dateLong(active.endDate)}</span>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-400 to-flag-blue transition-all"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-brand-300">{progressPct}% tamamlandı</span>
                  <span className="text-slate-400">{active.daysLeft} gün qaldı</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center gap-4 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 p-5 text-center ring-1 ring-white/10">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                <Icon name="clock" className="h-4 w-4 text-brand-300" />
                Bitməsinə qalan
              </div>
              <Countdown endDate={active.endDate} />
              <div className="text-[11px] text-slate-400">Son müraciət: {dateLong(active.endDate)}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="max-w-2xl">
          <span className="chip bg-brand-50 text-brand-700">Kateqoriyalar</span>
          <h2 className="mt-3 text-3xl font-black text-ink-900">Dəstəklənən istiqamətlər</h2>
          <p className="mt-2 text-sm text-slate-500">
            Hər kateqoriya üzrə mövcud torpaq potensialı və investisiya göstəriciləri.
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(active.categories || []).map((key) => {
            const c = cropMap[key];
            const e = econMap[key];
            const ha = stats?.byPurpose?.[c?.label] || 0;
            return (
              <Link
                key={key}
                to="/map"
                className="group card relative overflow-hidden p-0 transition duration-300 hover:-translate-y-1.5 hover:shadow-xl"
              >
                <div className="h-1.5 w-full" style={{ background: c?.color || '#94a3b8' }} />
                <div className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ background: c?.color }} />
                      <h3 className="text-base font-bold text-ink-900">{c?.label || key}</h3>
                    </div>
                    <span className="chip bg-slate-100 text-slate-600">{Math.round(ha)} ha</span>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-slate-50 p-2">
                      <div className="text-[10px] uppercase tracking-wide text-slate-400">Məhsul</div>
                      <div className="text-sm font-bold text-ink-900">{e ? `${e.yieldTonPerHa} t/ha` : '—'}</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2">
                      <div className="text-[10px] uppercase tracking-wide text-slate-400">Qiymət</div>
                      <div className="text-sm font-bold text-ink-900">{e ? `${fmt(e.pricePerTon)} ₼` : '—'}</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2">
                      <div className="text-[10px] uppercase tracking-wide text-slate-400">İnv./ha</div>
                      <div className="text-sm font-bold text-ink-900">{e ? `${fmt(e.costPerHa)} ₼` : '—'}</div>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-xs font-semibold text-brand-700">
                    <span>{e && e.maturityYears > 1 ? `Yetkinlik: ${e.maturityYears} il` : 'İllik məhsul'}</span>
                    <span className="inline-flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                      Xəritədə bax <Icon name="arrow" className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <span className="chip bg-flag-blue/10 text-flag-blue">Mərhələlər</span>
              <h2 className="mt-3 text-3xl font-black text-ink-900">Müsabiqənin gedişatı</h2>
            </div>
            <span className="text-sm text-slate-500">
              Cari mərhələ: <b className="text-ink-900">{active.stages?.[currentStage]}</b>
            </span>
          </div>

          <div className="relative mt-10">
            <div className="absolute left-0 right-0 top-6 hidden h-0.5 bg-slate-200 lg:block" />
            <div
              className="absolute left-0 top-6 hidden h-0.5 bg-gradient-to-r from-brand-500 to-flag-blue lg:block"
              style={{ width: `${Math.min(100, (currentStage / Math.max(1, stageCount - 1)) * 100)}%` }}
            />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
              {(active.stages || []).map((s, i) => {
                let state = 'todo';
                if (i < currentStage) state = 'done';
                else if (i === currentStage) state = 'current';

                let circle = 'bg-white text-slate-400 ring-1 ring-slate-200';
                if (state === 'done') circle = 'bg-brand-600 text-white ring-4 ring-brand-100';
                else if (state === 'current') circle = 'bg-flag-blue text-white ring-4 ring-sky-100';

                let label = 'text-slate-400';
                if (state !== 'todo') label = 'text-ink-900';

                let tag = 'Gözlənilir';
                let tagCls = 'bg-slate-100 text-slate-500';
                if (state === 'done') {
                  tag = 'Tamamlandı';
                  tagCls = 'bg-brand-50 text-brand-700';
                } else if (state === 'current') {
                  tag = 'Davam edir';
                  tagCls = 'bg-sky-50 text-flag-blue';
                }

                return (
                  <div key={s} className="relative flex flex-col items-center text-center">
                    <div className={`relative z-10 grid h-12 w-12 place-items-center rounded-full ${circle}`}>
                      <Icon name={STAGE_ICONS[i % STAGE_ICONS.length]} className="h-5 w-5" />
                    </div>
                    <div className={`mt-3 text-sm font-bold ${label}`}>{s}</div>
                    <span className={`chip mt-2 ${tagCls}`}>{tag}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="card p-6">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white">
                <Icon name="sparkle" className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-lg font-bold text-ink-900">Güzəşt və dəstəklər</h3>
                <p className="text-xs text-slate-500">Qaliblərə təqdim olunan paket</p>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {(active.incentives || []).map((x, i) => (
                <div key={x} className="flex items-start gap-3 rounded-xl bg-brand-50/70 p-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-brand-700 ring-1 ring-brand-100">
                    <Icon name={INCENTIVE_ICONS[i % INCENTIVE_ICONS.length]} className="h-4 w-4" />
                  </span>
                  <span className="pt-1 text-sm text-ink-700">{x}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-sky-500 to-flag-blue text-white">
                <Icon name="shield" className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-lg font-bold text-ink-900">İştirak şərtləri</h3>
                <p className="text-xs text-slate-500">Uyğunluq tələbləri</p>
              </div>
            </div>
            <ol className="mt-5 space-y-3">
              {(active.eligibility || []).map((x, i) => (
                <li key={x} className="flex items-start gap-3 text-sm text-slate-600">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-500">
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{x}</span>
                </li>
              ))}
            </ol>
            <div className="mt-5 flex items-center gap-2 rounded-xl bg-sky-50 p-3 text-xs text-flag-blue">
              <Icon name="check" className="h-4 w-4" />
              Bütün şərtlərə uyğunluğunuzu wizard avtomatik yoxlayır.
            </div>
          </div>
        </div>
      </section>

      {others.length > 0 && (
        <section className="border-t border-slate-200 bg-slate-50">
          <div className="mx-auto max-w-6xl px-4 py-14">
            <div className="max-w-2xl">
              <span className="chip bg-slate-200 text-slate-600">Gələcək</span>
              <h2 className="mt-3 text-3xl font-black text-ink-900">Digər müsabiqələr</h2>
            </div>
            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              {others.map((c) => {
                const until = daysUntil(c.startDate);
                return (
                  <div key={c.id} className="group card overflow-hidden p-0 transition duration-300 hover:-translate-y-1 hover:shadow-xl">
                    <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 to-orange-500" />
                    <div className="p-6">
                      <div className="flex items-center justify-between">
                        <span className="chip bg-slate-100 text-slate-600">{c.code}</span>
                        <StatusBadge status={c.status} />
                      </div>
                      <h3 className="mt-3 text-lg font-bold text-ink-900">{c.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-slate-500">{c.description}</p>

                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {(c.categories || []).map((k) => {
                          const cr = cropMap[k];
                          return (
                            <span key={k} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                              <span className="h-2 w-2 rounded-full" style={{ background: cr?.color }} />
                              {cr?.label || k}
                            </span>
                          );
                        })}
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-lg bg-slate-50 p-2">
                          <div className="text-[10px] uppercase tracking-wide text-slate-400">Büdcə</div>
                          <div className="text-sm font-bold text-ink-900">{fmt(c.totalBudget)} ₼</div>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2">
                          <div className="text-[10px] uppercase tracking-wide text-slate-400">Başlama</div>
                          <div className="text-sm font-bold text-ink-900">{dateShort(c.startDate)}</div>
                        </div>
                        <div className="rounded-lg bg-amber-50 p-2">
                          <div className="text-[10px] uppercase tracking-wide text-amber-600">Qalan</div>
                          <div className="text-sm font-bold text-amber-700">{until} gün</div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <section className="relative overflow-hidden bg-ink-900 text-white">
        <div className="absolute inset-0 bg-grid opacity-50" />
        <div className="absolute -right-20 -top-24 h-80 w-80 animate-blob rounded-full bg-brand-500/25 blur-3xl" />
        <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-5 px-4 py-16 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg">
            <Icon name="trophy" className="h-7 w-7" />
          </span>
          <h2 className="text-3xl font-black sm:text-4xl">Müsabiqədə iştirak etməyə hazırsınız?</h2>
          <p className="max-w-xl text-sm text-slate-300">
            Xəritədən sahənizi seçin, gəlirliliyi hesablayın və müraciətinizi bir neçə addımda təqdim edin.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/apply" className="btn-primary px-6 py-3 text-base">
              Müraciətə başla
              <Icon name="arrow" className="h-4 w-4" />
            </Link>
            <Link to="/map" className="btn bg-white/10 px-6 py-3 text-base text-white ring-1 ring-white/20 hover:bg-white/20">
              Xəritəyə keç
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
