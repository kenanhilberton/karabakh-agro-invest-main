import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../api.js';
import { useSession } from '../session.jsx';
import Receipt from '../components/Receipt.jsx';
import Icon from '../components/Icon.jsx';
import FileUploadDropzone from '../components/FileUploadDropzone.jsx';
import { STAGES, STATUS_COLORS, TECH_LABELS, VALUE_CHAIN_STEPS, IMPACT_METRICS } from '../constants.js';

const STATUS_META = {
  submitted: { grad: 'from-slate-700 via-slate-800 to-ink-900', dot: 'bg-slate-400' },
  review: { grad: 'from-sky-600 via-sky-700 to-indigo-800', dot: 'bg-sky-400' },
  documents: { grad: 'from-amber-500 via-orange-600 to-orange-700', dot: 'bg-amber-400' },
  approved: { grad: 'from-brand-600 via-emerald-700 to-emerald-800', dot: 'bg-brand-300' },
  rejected: { grad: 'from-flag-red via-red-700 to-red-900', dot: 'bg-flag-red' }
};

const APPLICANT_HINT = {
  submitted: {
    title: 'Müraciətiniz növbəyə alındı',
    text: 'Operator komandası müraciətinizi nəzərdən keçirəcək. Nəticə barədə bildiriş göndəriləcək.'
  },
  review: {
    title: 'Müraciətə baxılır',
    text: 'Ekspertlər biznes planınızı və torpaq uyğunluğunu qiymətləndirir. Yardım üçün əlaqə saxlayın.'
  },
  documents: {
    title: 'Əlavə sənəd tələb olunur',
    text: 'Müraciəti tamamlamaq üçün aşağıdakı bölmədən əlavə sənədləri yükləyib göndərin.'
  },
  approved: {
    title: 'Təbriklər — müraciət təsdiqləndi!',
    text: 'Torpaq sahəsi sizə ayrıldı. Növbəti addımlar üçün operatorla əlaqə saxlayın.'
  },
  rejected: {
    title: 'Müraciət üzrə qərar: imtina',
    text: 'Təəssüf ki, müraciətiniz tələblərə uyğun qiymətləndirilmədi. Ətraflı məlumat üçün operatorla əlaqə saxlayın.'
  }
};

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('az-AZ', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function relTime(iso) {
  if (!iso) return '';
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return 'indicə';
  if (d < 3600) return `${Math.floor(d / 60)} dəq əvvəl`;
  if (d < 86400) return `${Math.floor(d / 3600)} saat əvvəl`;
  return `${Math.floor(d / 86400)} gün əvvəl`;
}

export default function Track() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { user } = useSession();
  const [input, setInput] = useState(code || '');
  const [app, setApp] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [mine, setMine] = useState([]);
  const [mineLoading, setMineLoading] = useState(false);
  const [mineError, setMineError] = useState('');

  useEffect(() => {
    if (code) load(code);
    else {
      setApp(null);
      setError('');
      setSearched(false);
    }
  }, [code]);

  useEffect(() => {
    if (!user) {
      setMine([]);
      return;
    }
    setMineLoading(true);
    setMineError('');
    api
      .applications()
      .then((list) => setMine(Array.isArray(list) ? list : []))
      .catch((e) => setMineError(e.message || 'Müraciətləri yükləmək mümkün olmadı'))
      .finally(() => setMineLoading(false));
  }, [user, code]);

  async function load(value) {
    setLoading(true);
    setError('');
    setSearched(true);
    try {
      const data = await api.track(value.trim());
      setApp(data);
    } catch (e) {
      setApp(null);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function submit(e) {
    e.preventDefault();
    const v = input.trim();
    if (v) navigate(`/track/${v}`);
  }

  return (
    <div>
      <section className="relative overflow-hidden bg-ink-900 text-white">
        <div className="absolute inset-0 bg-grid opacity-[0.15]" />
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-flag-blue/25 blur-3xl" />
        <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-brand-500/25 blur-3xl" />
        <div className="relative mx-auto max-w-5xl px-4 py-12">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-brand-300">
            <Icon name="compass" className="h-4 w-4" /> Canlı izləmə
          </div>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Müraciət izləmə</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">
            İzləmə kodunu daxil edin və ya QR kodu skan edin — müraciətinizin cari statusunu, tarixçəsini
            və maliyyə göstəricilərini anında görün.
          </p>

          <form onSubmit={submit} className="mt-6 flex max-w-xl gap-2">
            <div className="relative flex-1">
              <Icon
                name="search"
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              />
              <input
                className="input h-12 w-full border-transparent bg-white pl-10 font-medium"
                placeholder="KAI-2026-XXXXX"
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
            </div>
            <button className="btn-primary h-12 px-6" type="submit" disabled={loading}>
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Axtarılır
                </>
              ) : (
                <>
                  İzlə <Icon name="arrow" className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 pb-16 pt-8">
        {loading && <Skeleton />}

        {!loading && error && (
          <div className="card mx-auto max-w-lg p-8 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-50 text-flag-red">
              <Icon name="search" className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-lg font-black text-ink-900">Müraciət tapılmadı</h2>
            <p className="mt-1 text-sm text-slate-500">
              «{code || input}» koduna uyğun müraciət yoxdur. Kodu yoxlayın və yenidən cəhd edin.
            </p>
          </div>
        )}

        {!loading && app && (
          <>
            {user && (
              <MyApplications
                apps={mine}
                loading={mineLoading}
                error={mineError}
                current={app.trackingCode}
                compact
              />
            )}
            {!showReceipt && (
              <TrackResult
                app={app}
                onReceipt={() => setShowReceipt(true)}
                onDocumentsUpdated={setApp}
              />
            )}
            {showReceipt && (
              <div>
                <div className="no-print mb-3 flex justify-between">
                  <button className="btn-ghost" onClick={() => setShowReceipt(false)}>
                    <Icon name="arrow" className="h-4 w-4 rotate-180" /> Geri
                  </button>
                  <button className="btn-primary" onClick={() => window.print()}>
                    <Icon name="download" className="h-4 w-4" /> Çap et / PDF
                  </button>
                </div>
                <Receipt app={app} />
              </div>
            )}
          </>
        )}

        {!loading && !app && (
          user ? (
            <MyApplications apps={mine} loading={mineLoading} error={mineError} current={code || ''} />
          ) : (
            !searched && <EmptyState />
          )
        )}
      </div>
    </div>
  );
}

function TrackResult({ app, onReceipt, onDocumentsUpdated }) {
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const qrRef = useRef(null);

  const meta = STATUS_META[app.status] || STATUS_META.submitted;
  const hint = APPLICANT_HINT[app.status];
  const trackUrl = `${window.location.origin}/track/${app.trackingCode}`;
  const projectTechs = app.technologies || [];
  const projectChain = app.valueChain || [];
  const projectMetrics = IMPACT_METRICS.filter((m) => app[m.key] != null);
  const hasProject = projectTechs.length > 0 || projectChain.length > 0 || projectMetrics.length > 0;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(trackUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: 'KAI müraciət izləmə', url: trackUrl });
      } else {
        await navigator.clipboard.writeText(trackUrl);
        setShared(true);
        setTimeout(() => setShared(false), 1800);
      }
    } catch {
      /* cancelled */
    }
  };

  const downloadQr = () => {
    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([xml], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `muraciet-${app.trackingCode}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const investment = app.investmentAmount
    ? `${Number(app.investmentAmount).toLocaleString('az-AZ')} ₼`
    : '—';

  return (
    <div className="space-y-4">
      <div className="card overflow-hidden p-0">
        <div className={`relative overflow-hidden bg-gradient-to-br ${meta.grad} p-6 text-white`}>
          <div className="absolute inset-0 bg-grid opacity-20" />
          <div className="absolute -right-12 -top-14 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
          <div className="relative flex flex-wrap items-start justify-between gap-5">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">
                <Icon name="file" className="h-3.5 w-3.5" /> Müraciət qəbzi
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h2 className="font-mono text-3xl font-black tracking-tight">{app.trackingCode}</h2>
                <button
                  onClick={copy}
                  className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-white/25"
                >
                  <Icon name={copied ? 'check' : 'copy'} className="mr-1 inline h-3.5 w-3.5" />
                  {copied ? 'Kopyalandı' : 'Kodu kopyala'}
                </button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="chip bg-white/15 text-white ring-1 ring-white/20">
                  <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                  {app.statusLabel}
                </span>
                {app.competitionTitle && (
                  <span className="flex items-center gap-1.5 text-sm text-white/80">
                    <Icon name="trophy" className="h-4 w-4" /> {app.competitionTitle}
                  </span>
                )}
              </div>
              <div className="mt-2 text-xs text-white/60">Təqdim edilib: {fmtDate(app.createdAt)}</div>
            </div>

            <div className="shrink-0">
              <div ref={qrRef} className="rounded-2xl bg-white p-2.5 shadow-lg">
                <QRCodeSVG value={trackUrl} size={104} />
              </div>
              <button
                onClick={downloadQr}
                className="mt-2 w-full rounded-lg bg-white/10 py-1.5 text-[11px] font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/20"
              >
                <Icon name="download" className="mr-1 inline h-3.5 w-3.5" /> QR-i yüklə
              </button>
            </div>
          </div>

          <div className="relative mt-7">
            <ProgressRail status={app.status} timeline={app.timeline} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi icon="map" label="Rayon" value={app.districtName} />
        <Kpi icon="layers" label="Torpaq kodu" value={app.landCode} mono />
        <Kpi icon="target" label="Sahə" value={`${app.areaHa} ha`} />
        <Kpi icon="leaf" label="Təyinat" value={app.purposeLabel} />
        <Kpi icon="coin" label="İnvestisiya" value={investment} />
        <Kpi icon="trend" label="Geri qaytarma" value={app.roi ? `${app.roi.paybackYears} il` : '—'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <div className="card p-5">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand-600">
                <Icon name="sparkle" className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-ink-900">{hint?.title}</h3>
                <p className="text-xs text-slate-500">{hint?.text}</p>
              </div>
            </div>
          </div>

          {app.status === 'documents' && (
            <DocumentsPanel app={app} onUpdated={onDocumentsUpdated} />
          )}

          <div className="card p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink-900">Status tarixçəsi</h3>
              <span className="chip bg-slate-100 text-slate-600">{app.timeline?.length || 0} mərhələ</span>
            </div>
            <ol className="mt-4 space-y-4">
              {[...(app.timeline || [])].reverse().map((t, i, arr) => {
                const first = i === 0;
                const dot = STATUS_META[t.status]?.dot || 'bg-slate-400';
                let line = 'bg-slate-100';
                if (first) line = 'bg-transparent';
                return (
                  <li key={i} className="relative flex gap-4">
                    <div className="flex flex-col items-center">
                      <span
                        className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-white ring-4 ring-white ${dot} ${
                          first ? 'shadow-md' : ''
                        }`}
                      >
                        {first ? (
                          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-white" />
                        ) : (
                          <Icon name="check" className="h-4 w-4" strokeWidth={2.4} />
                        )}
                      </span>
                      {i < arr.length - 1 && <span className={`mt-1 w-0.5 flex-1 ${line}`} />}
                    </div>
                    <div className="pb-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-ink-900">{t.label}</span>
                        {first && <span className="chip bg-brand-50 text-[10px] text-brand-700">cari mərhələ</span>}
                      </div>
                      {t.note && <p className="mt-0.5 text-xs text-slate-500">{t.note}</p>}
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        <Icon name="clock" className="mr-1 inline h-3 w-3 align-[-1px]" />
                        {fmtDate(t.at)} · {relTime(t.at)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          {hasProject && (
            <div className="card p-5">
              <h3 className="flex items-center gap-2 text-sm font-bold text-ink-900">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-50 text-brand-600">
                  <Icon name="layers" className="h-4 w-4" />
                </span>
                Layihə profili
              </h3>

              {projectTechs.length > 0 && (
                <div className="mt-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Müasir texnologiyalar</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {projectTechs.map((k) => (
                      <span key={k} className="chip bg-brand-50 text-[11px] text-brand-700">
                        {TECH_LABELS[k] || k}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {projectChain.length > 0 && (
                <div className="mt-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Dəyər zənciri</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {VALUE_CHAIN_STEPS.map((v) => {
                      const on = projectChain.includes(v.key);
                      const cls = on
                        ? 'chip bg-brand-600 text-[11px] text-white'
                        : 'chip bg-slate-100 text-[11px] text-slate-400 line-through';
                      return (
                        <span key={v.key} className={cls}>
                          {v.label}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {projectMetrics.length > 0 && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {projectMetrics.map((m) => (
                    <div key={m.key} className="rounded-lg border border-slate-100 bg-slate-50/60 p-2.5">
                      <div className="text-[10px] uppercase tracking-wide text-slate-400">{m.label}</div>
                      <div className="text-sm font-bold text-ink-900">
                        {Number(app[m.key]).toLocaleString('az-AZ')}{' '}
                        <span className="text-[11px] font-medium text-slate-400">{m.unit}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4">
          {app.score && <ScoreCard score={app.score} />}

          {app.roi && (
            <div className="card p-5">
              <h3 className="flex items-center gap-2 text-sm font-bold text-ink-900">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-50 text-brand-600">
                  <Icon name="coin" className="h-4 w-4" />
                </span>
                Maliyyə proqnozu
              </h3>
              <div className="mt-4 space-y-3">
                <Gauge
                  label="Gözlənilən ROI (5 il)"
                  value={Math.min(app.roi.roi5y || 0, 100)}
                  max={100}
                  suffix={`${app.roi.roi5y}%`}
                  tone="bg-brand-500"
                />
                <Gauge
                  label="Geri qaytarma müddəti"
                  value={Math.max(0, 10 - (app.roi.paybackYears || 0))}
                  max={10}
                  suffix={`${app.roi.paybackYears} il`}
                  tone="bg-sky-500"
                />
                <Gauge
                  label="İlkin investisiya"
                  value={Math.min((app.roi.capex || 0) / 5000, 100)}
                  max={100}
                  suffix={`${Number(app.roi.capex || 0).toLocaleString('az-AZ')} ₼`}
                  tone="bg-violet-500"
                />
              </div>
            </div>
          )}

          <div className="card p-5">
            <h3 className="text-sm font-bold text-ink-900">Əməliyyatlar</h3>
            <div className="mt-3 space-y-2">
              <button className="btn-primary w-full" onClick={onReceipt}>
                <Icon name="file" className="h-4 w-4" /> Qəbz / PDF
              </button>
              <button className="btn-ghost w-full" onClick={copy}>
                <Icon name={copied ? 'check' : 'copy'} className="h-4 w-4" />
                {copied ? 'Link kopyalandı' : 'İzləmə linkini kopyala'}
              </button>
              <button className="btn-ghost w-full" onClick={share}>
                <Icon name="share" className="h-4 w-4" /> {shared ? 'Kopyalandı' : 'Paylaş'}
              </button>
              <Link to="/map" className="btn-ghost w-full">
                <Icon name="plus" className="h-4 w-4" /> Yeni müraciət
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DocumentsPanel({ app, onUpdated }) {
  const [pending, setPending] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const attached = app.files || [];

  if (!app.canManage) {
    return (
      <div className="card p-5 ring-1 ring-amber-200">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-amber-50 text-amber-600">
            <Icon name="upload" className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-ink-900">Əlavə sənəd tələb olunur</h3>
            <p className="text-xs text-slate-500">
              Sənəd əlavə etmək üçün müraciətin sahibi kimi daxil olun.
            </p>
          </div>
        </div>
        <Link to="/login" className="btn-primary mt-4 inline-flex">
          <Icon name="shield" className="h-4 w-4" /> Daxil ol
        </Link>
      </div>
    );
  }

  const send = async () => {
    if (!pending.length) {
      setError('Əvvəlcə ən azı bir sənəd seçin');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const updated = await api.addApplicationDocuments(app.trackingCode, pending);
      setPending([]);
      setSaved(true);
      onUpdated(updated);
    } catch (e) {
      setError(e.message || 'Sənədlər göndərilmədi');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card p-5 ring-1 ring-amber-200">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-amber-50 text-amber-600">
          <Icon name="upload" className="h-4 w-4" />
        </span>
        <div>
          <h3 className="text-sm font-bold text-ink-900">Əlavə sənəd tələb olunur</h3>
          <p className="text-xs text-slate-500">
            Operator əlavə sənəd istəyir. Faylları yükləyib göndərin.
          </p>
        </div>
      </div>

      {attached.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {attached.map((f) => (
            <li
              key={f.id}
              className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600"
            >
              <Icon name="file" className="h-3.5 w-3.5 text-brand-600" />
              <a
                href={f.path || f.url}
                target="_blank"
                rel="noreferrer"
                className="flex-1 truncate hover:text-brand-700 hover:underline"
              >
                {f.originalName || f.name}
              </a>
              <span className="chip bg-white text-[10px] text-slate-500">Yüklənib</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4">
        <FileUploadDropzone
          files={pending}
          onFilesChange={(files) => {
            setPending(files);
            setError('');
            setSaved(false);
          }}
          hint="PDF, DOCX, XLSX, JPG, PNG · max 10 MB"
        />
      </div>

      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-flag-red">{error}</p>}
      {saved && (
        <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">
          ✓ Sənədlər müraciətə əlavə olundu.
        </p>
      )}

      <button
        type="button"
        className="btn-primary mt-3 w-full"
        onClick={send}
        disabled={saving || pending.length === 0}
      >
        {saving ? 'Göndərilir…' : 'Sənədləri göndər'}
      </button>
    </div>
  );
}

function MyApplications({ apps, loading, error, current, compact }) {
  const navigate = useNavigate();
  const count = apps.length;

  return (
    <div className={`card overflow-hidden ${compact ? 'mb-4' : ''}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-4">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand-600">
            <Icon name="file" className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-ink-900">Müraciətlərim</h2>
            <p className="text-[11px] text-slate-400">
              {count} müraciət · kod daxil etmədən birbaşa seçin
            </p>
          </div>
        </div>
        <Link to="/map" className="btn-primary">
          <Icon name="plus" className="h-4 w-4" /> Yeni müraciət
        </Link>
      </div>

      {loading ? (
        <div className="p-6 text-center text-sm text-slate-400">Yüklənir…</div>
      ) : error ? (
        <div className="p-6 text-center text-sm text-flag-red">{error}</div>
      ) : count === 0 ? (
        <div className="p-8 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600">
            <Icon name="sparkle" className="h-6 w-6" />
          </div>
          <h3 className="mt-3 text-base font-bold text-ink-900">Hələ ki müraciətiniz yoxdur</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            Xəritədən sahə seçin və bir neçə addımda müraciət edin — yaratdığınız müraciətlər
            burada avtomatik görünəcək.
          </p>
          <Link to="/map" className="btn-primary mt-5 inline-flex">
            <Icon name="map" className="h-4 w-4" /> Xəritəyə bax
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {apps.map((a) => {
            const on = a.trackingCode === current;
            return (
              <li key={a.id}>
                <button
                  onClick={() => navigate(`/track/${a.trackingCode}`)}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-brand-50/50 ${
                    on ? 'bg-brand-50/70' : ''
                  }`}
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ink-900 text-white">
                    <Icon name="file" className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-xs font-bold text-ink-900">
                      {a.trackingCode}
                    </span>
                    <span className="block truncate text-[11px] text-slate-400">
                      {a.districtName} · {a.purposeLabel} · {a.areaHa} ha
                    </span>
                  </span>
                  <span className="hidden text-right sm:block">
                    <span className="block text-[11px] text-slate-400">{fmtDate(a.createdAt)}</span>
                    {a.score && (
                      <span className="block text-[11px] font-semibold text-brand-600">
                        Bal: {a.score.total}
                      </span>
                    )}
                  </span>
                  <span className={`chip ${STATUS_COLORS[a.status] || 'bg-slate-100 text-slate-600'}`}>
                    {a.statusLabel}
                  </span>
                  <Icon name="arrow" className="h-4 w-4 shrink-0 text-slate-300" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ProgressRail({ status, timeline = [] }) {
  const FLOW = STAGES.filter((s) => s.key !== 'rejected');
  const rejected = status === 'rejected';
  let idx = FLOW.findIndex((s) => s.key === status);
  if (idx < 0) {
    const reached = timeline
      .map((t) => FLOW.findIndex((s) => s.key === t.status))
      .filter((i) => i >= 0);
    idx = reached.length ? Math.max(...reached) : 0;
  }
  const pct = FLOW.length > 1 ? idx / (FLOW.length - 1) : 0;
  return (
    <div>
      <div className="relative">
        <div className="absolute left-4 right-4 top-4 h-0.5 rounded-full bg-white/25" />
        <div
          className={`absolute left-4 top-4 h-0.5 rounded-full transition-all duration-700 ${rejected ? 'bg-flag-red' : 'bg-white'}`}
          style={{ width: `calc((100% - 2rem) * ${pct})` }}
        />
        <ol className="relative flex justify-between">
          {FLOW.map((s, i) => {
            const done = i <= idx;
            const current = i === idx;
            let dot = 'bg-white/15 text-white/60 ring-1 ring-white/25';
            if (done) dot = rejected && current ? 'bg-flag-red text-white' : 'bg-white text-ink-900';
            let labelCls = 'text-white/55';
            if (done) labelCls = 'text-white';
            return (
              <li key={s.key} className="flex w-16 flex-col items-center gap-2 text-center">
                <span
                  className={`grid h-8 w-8 place-items-center rounded-full text-xs font-bold ${dot} ${
                    current ? 'ring-4 ring-white/25' : ''
                  }`}
                >
                  {i < idx ? <Icon name="check" className="h-4 w-4" strokeWidth={2.6} /> : i + 1}
                </span>
                <span className={`text-[11px] font-medium leading-tight ${labelCls}`}>{s.short}</span>
              </li>
            );
          })}
        </ol>
      </div>
      {rejected && (
        <div className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-flag-red/15 px-3 py-2 text-xs font-semibold text-white ring-1 ring-flag-red/40">
          <Icon name="x" className="h-4 w-4" />
          Müraciət üzrə qərar: İmtina
        </div>
      )}
    </div>
  );
}

function ScoreCard({ score }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score.total));
  const off = c * (1 - pct / 100);
  let stroke = '#ef3340';
  if (score.grade === 'A') stroke = '#059669';
  else if (score.grade === 'B') stroke = '#0ea5e9';
  else if (score.grade === 'C') stroke = '#f59e0b';

  const fmt = (n) => `${n}%`;
  return (
    <div className="card p-5">
      <h3 className="flex items-center gap-2 text-sm font-bold text-ink-900">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-amber-50 text-amber-600">
          <Icon name="award" className="h-4 w-4" />
        </span>
        Müraciət balı
      </h3>
      <div className="mt-3 flex items-center gap-4">
        <div className="relative grid h-[120px] w-[120px] shrink-0 place-items-center">
          <svg width="120" height="120" viewBox="0 0 130 130" className="-rotate-90">
            <circle cx="65" cy="65" r={r} stroke="#eef2f7" strokeWidth="10" fill="none" />
            <circle
              cx="65"
              cy="65"
              r={r}
              stroke={stroke}
              strokeWidth="10"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={off}
              style={{ transition: 'stroke-dashoffset 800ms ease' }}
            />
          </svg>
          <div className="absolute text-center">
            <div className="text-2xl font-black leading-none text-ink-900">{score.total}</div>
            <div className="text-[10px] uppercase tracking-wide text-slate-400">/ 100</div>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-sm text-slate-500">Qiymət</span>
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink-900 text-sm font-black text-white">
              {score.grade}
            </span>
          </div>
          <div className="mt-3 space-y-2">
            {Object.entries(score.breakdown || {}).map(([k, v]) => (
              <div key={k}>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="capitalize text-slate-500">{k}</span>
                  <span className="font-semibold text-ink-900">{fmt(v)}</span>
                </div>
                <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-ink-700" style={{ width: `${v}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({ icon, label, value, mono }) {
  let valueCls = 'truncate text-sm font-bold text-ink-900';
  if (mono) valueCls = 'truncate font-mono text-sm font-bold text-ink-900';
  return (
    <div className="card p-3.5">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        <Icon name={icon} className="h-3.5 w-3.5 text-brand-500" /> {label}
      </div>
      <div className={`mt-1.5 ${valueCls}`} title={value}>
        {value}
      </div>
    </div>
  );
}

function Gauge({ label, value, max, suffix = '', tone = 'bg-brand-500' }) {
  const width = Math.max(4, Math.min(100, (value / max) * 100));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-medium text-slate-500">{label}</span>
        <span className="whitespace-nowrap text-sm font-bold text-ink-900">{suffix}</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="card h-64 animate-pulse bg-slate-100" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card h-16 animate-pulse bg-slate-100" />
        ))}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <div className="card p-8 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-brand-50 text-brand-600">
          <Icon name="compass" className="h-8 w-8" />
        </div>
        <h2 className="mt-4 text-lg font-black text-ink-900">İzləmə kodunuz var?</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
          Yuxarıdakı sahəyə müraciət zamanı aldığınız <b>KAI-2026-XXXXX</b> kodunu daxil edin və ya
          qəbzdəki QR kodu telefonunuzla skan edin.
        </p>
        <div className="mx-auto mt-6 grid max-w-md grid-cols-3 gap-3 text-left">
          <Step n="1" icon="search" title="Kodu daxil et" />
          <Step n="2" icon="clock" title="Statusu gör" />
          <Step n="3" icon="file" title="Qəbzi yüklə" />
        </div>
      </div>
      <div className="card overflow-hidden p-0">
        <div className="relative overflow-hidden bg-ink-900 p-5 text-white">
          <div className="absolute inset-0 bg-grid opacity-20" />
          <div className="relative">
            <Icon name="qr" className="h-6 w-6 text-brand-300" />
            <h3 className="mt-2 text-base font-black">QR ilə sürətli izləmə</h3>
            <p className="mt-1 text-xs text-slate-300">
              Müraciət qəbzindəki QR kodu skan edin — bu səhifə avtomatik açılacaq.
            </p>
          </div>
        </div>
        <ul className="space-y-3 p-5 text-sm">
          <Tip icon="shield" text="Məlumatlar EKTİS ilə sinxronlaşdırılır" />
          <Tip icon="clock" text="Hər status dəyişikliyi burada əks olunur" />
          <Tip icon="share" text="Nəticəni asanlıqla paylaşın" />
        </ul>
      </div>
    </div>
  );
}

function Step({ n, icon, title }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-slate-100 text-[11px] font-bold text-slate-600">
          {n}
        </span>
        <Icon name={icon} className="h-4 w-4 text-brand-500" />
      </div>
      <div className="mt-1.5 text-xs font-semibold text-ink-900">{title}</div>
    </div>
  );
}

function Tip({ icon, text }) {
  return (
    <li className="flex items-center gap-2.5 text-slate-600">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">
        <Icon name={icon} className="h-4 w-4" />
      </span>
      <span className="text-xs">{text}</span>
    </li>
  );
}
