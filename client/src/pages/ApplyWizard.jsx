import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../api.js';
import { useSession } from '../session.jsx';
import MapView from '../components/MapView.jsx';
import ROICalculator from '../components/ROICalculator.jsx';
import AdvisorPanel from '../components/AdvisorPanel.jsx';
import StageTracker from '../components/StageTracker.jsx';
import Icon from '../components/Icon.jsx';
import { PROJECT_TECHNOLOGIES, VALUE_CHAIN_STEPS, IMPACT_METRICS } from '../constants.js';

const STEPS = [
  { label: 'Profil təsdiqi', icon: 'shield' },
  { label: 'Sahə seçimi', icon: 'map' },
  { label: 'Biznes plan', icon: 'chart' },
  { label: 'Təsdiq & QR', icon: 'check' }
];

const ROLE_LABEL = {
  applicant: 'Sahibkar / Fermer',
  operator: 'Aqrar operator',
  admin: 'Sistem administratoru'
};

function roleLabel(role) {
  return ROLE_LABEL[role] || role || '—';
}

function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const months = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avqust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'];
  const p2 = (n) => String(n).padStart(2, '0');
  const date = `${p2(now.getDate())} ${months[now.getMonth()]} ${now.getFullYear()}`;
  const time = `${p2(now.getHours())}:${p2(now.getMinutes())}:${p2(now.getSeconds())}`;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold tracking-normal text-white ring-1 ring-white/15">
      <Icon name="clock" className="h-3.5 w-3.5 text-brand-300" />
      <span className="tabular-nums">{date} · {time}</span>
    </span>
  );
}

export default function ApplyWizard() {
  const { user } = useSession();
  const { landId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [meta, setMeta] = useState({ crops: [] });
  const [lands, setLands] = useState([]);

  const [verify, setVerify] = useState(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [land, setLand] = useState(null);
  const [plan, setPlan] = useState({
    purpose: '',
    areaHa: '',
    company: '',
    investmentAmount: '',
    businessPlan: '',
    technologies: [],
    valueChain: [],
    arableAreaHa: '',
    permanentJobs: '',
    seasonalJobs: '',
    annualOutputTons: '',
    files: []
  });
  const [signature, setSignature] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.meta().then(setMeta).catch(() => {});
    api.lands({ status: 'available' }).then(setLands).catch(() => {});
  }, []);

  useEffect(() => {
    if (landId) {
      // A recommended crop can be passed from the map ("«X» ilə müraciətə keç").
      const requested = (searchParams.get('purpose') || '').trim();
      api
        .land(landId)
        .then((l) => {
          setLand(l);
          setPlan((p) => ({ ...p, purpose: requested || l.purpose, areaHa: l.areaHa }));
          setStep(1);
        })
        .catch((e) => setError(e.message || 'Torpaq sahəsini yükləmək mümkün olmadı'));
    }
  }, [landId]);

  const loadVerify = useCallback(() => {
    if (!user?.voen) return;
    setVerifyLoading(true);
    setVerifyError('');
    api
      .ektisVerify(user.voen)
      .then(setVerify)
      .catch((e) => setVerifyError(e.message || 'EKTİS yoxlaması alınmadı'))
      .finally(() => setVerifyLoading(false));
  }, [user?.voen]);

  useEffect(() => {
    loadVerify();
  }, [loadVerify]);

  const canNext = useMemo(() => {
    if (step === 0) return !!verify?.verified;
    if (step === 1) return !!land;
    if (step === 2) return plan.purpose && Number(plan.areaHa) > 0;
    if (step === 3) return agreed && signature.trim().length >= 3;
    return false;
  }, [step, verify, land, plan, agreed, signature]);

  const selectLand = (l) => {
    setLand(l);
    if (l) setPlan((p) => ({ ...p, purpose: l.purpose, areaHa: l.areaHa }));
  };

  async function submit() {
    setSubmitting(true);
    setError('');
    try {
      const app = await api.createApplication({
        landId: land.id,
        purpose: plan.purpose,
        areaHa: Number(plan.areaHa),
        company: plan.company || user.company,
        investmentAmount: Number(plan.investmentAmount) || undefined,
        businessPlan: plan.businessPlan,
        technologies: plan.technologies,
        valueChain: plan.valueChain,
        arableAreaHa: plan.arableAreaHa === '' ? undefined : Number(plan.arableAreaHa),
        permanentJobs: plan.permanentJobs === '' ? undefined : Number(plan.permanentJobs),
        seasonalJobs: plan.seasonalJobs === '' ? undefined : Number(plan.seasonalJobs),
        annualOutputTons: plan.annualOutputTons === '' ? undefined : Number(plan.annualOutputTons),
        files: plan.files
      });
      setResult(app);
      api.ektisSync(app.id).catch(() => {});
      setStep(4);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!user) {
    return (
      <div className="relative overflow-hidden bg-ink-900 text-white">
        <div className="absolute inset-0 bg-grid opacity-[0.15]" />
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-brand-500/30 blur-3xl" />
        <div className="relative mx-auto max-w-lg px-4 py-24 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/20">
            <Icon name="shield" className="h-7 w-7 text-brand-300" />
          </div>
          <h1 className="mt-5 text-2xl font-black">Müraciət üçün daxil olun</h1>
          <p className="mt-2 text-sm text-slate-300">
            Elektron müraciət VÖEN/FİN əsaslı profil təsdiqi tələb edir.
          </p>
          <Link to="/login" className="btn-primary mt-6">
            Daxil ol <Icon name="arrow" className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  let hint = '';
  if (!canNext && step < 4) {
    if (step === 0) hint = verifyError ? 'EKTİS yoxlaması alınmadı — yenidən cəhd edin' : 'EKTİS təsdiqi tamamlanana qədər gözləyin';
    else if (step === 1) hint = 'Davam etmək üçün xəritədən sahə seçin';
    else if (step === 2) hint = 'Məhsul təyinatı və sahəni göstərin';
    else if (step === 3) hint = 'İmzanı yazın və şərtlərlə razılaşın';
  }

  const isLast = step === 3;

  return (
    <div>
      <div className="relative overflow-hidden bg-ink-900 text-white">
        <div className="absolute inset-0 bg-grid opacity-[0.15]" />
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-brand-500/30 blur-3xl" />
        <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-flag-blue/20 blur-3xl" />
        <div className="relative mx-auto max-w-5xl px-4 py-8">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-brand-300">
            <span className="inline-flex items-center gap-2">
              <Icon name="sparkle" className="h-4 w-4" /> KAI · elektron müraciət
            </span>
            <LiveClock />
          </div>
          <h1 className="mt-2 text-3xl font-black tracking-tight">İnvestisiya müraciəti</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-300">
            4 sadə addımda profil təsdiqi, torpaq seçimi, biznes plan və rəqəmsal imza — hamısı bir
            axında.
          </p>
          <Stepper step={step} />
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 pb-28 pt-8">
        {error && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-flag-red">
            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-flag-red/10 text-xs">
              !
            </span>
            <span>{error}</span>
          </div>
        )}

        <div className="card p-6">
          {step === 0 && (
            <StepProfile
              user={user}
              verify={verify}
              loading={verifyLoading}
              error={verifyError}
              onRetry={loadVerify}
            />
          )}
          {step === 1 && <StepLand lands={lands} land={land} setLand={selectLand} />}
          {step === 2 && <StepPlan plan={plan} setPlan={setPlan} crops={meta.crops} land={land} />}
          {step === 3 && (
            <StepSign
              user={user}
              land={land}
              plan={plan}
              signature={signature}
              setSignature={setSignature}
              agreed={agreed}
              setAgreed={setAgreed}
            />
          )}
          {step === 4 && result && <StepSuccess result={result} />}
        </div>
      </div>

      {step < 4 && (
        <div className="sticky bottom-0 z-20 border-t border-slate-200 bg-white/85 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
            <button
              className="btn-ghost"
              disabled={step === 0}
              onClick={() => setStep((s) => s - 1)}
            >
              <Icon name="arrow" className="h-4 w-4 rotate-180" /> Geri
            </button>

            <div className="hidden min-w-0 flex-1 text-center text-xs text-slate-400 sm:block">
              {hint}
            </div>

            <div className="flex items-center gap-3">
              <span className="hidden text-xs font-semibold text-slate-500 sm:inline">
                Addım {step + 1} / {STEPS.length}
              </span>
              {isLast ? (
                <button
                  className="btn-primary"
                  disabled={!canNext || submitting}
                  onClick={submit}
                >
                  {submitting ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                      Göndərilir…
                    </>
                  ) : (
                    <>
                      Müraciəti göndər <Icon name="check" className="h-4 w-4" />
                    </>
                  )}
                </button>
              ) : (
                <button className="btn-primary" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
                  İrəli <Icon name="arrow" className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stepper({ step }) {
  const total = STEPS.length;
  const pct = (Math.min(step, total) / total) * 100;
  return (
    <div className="mt-6">
      <div className="flex items-start justify-between gap-1">
        {STEPS.map((s, i) => {
          const done = i < step;
          const active = i === step;
          let circle = 'bg-white/10 text-white/60 ring-1 ring-white/20';
          if (done) circle = 'bg-brand-500 text-white';
          else if (active) circle = 'bg-white text-ink-900 ring-4 ring-white/20';
          let label = 'text-white/50';
          if (done || active) label = 'text-white';
          return (
            <div key={s.label} className="flex flex-1 flex-col items-center text-center">
              <div className={`grid h-9 w-9 place-items-center rounded-full transition ${circle}`}>
                {done ? <Icon name="check" className="h-4 w-4" /> : <Icon name={s.icon} className="h-4 w-4" />}
              </div>
              <span className={`mt-1.5 hidden text-[11px] font-medium sm:block ${label}`}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/15">
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function StepProfile({ user, verify, loading, error, onRetry }) {
  const verified = !!verify?.verified;
  const required = verify && verify.verified === false;

  return (
    <Section
      step={1}
      icon="shield"
      title="Profil təsdiqi"
      subtitle="Məlumatlarınız EKTİS — Elektron Kənd Təsərrüfatı İnformasiya Sistemi üzərindən avtomatik yoxlanılır."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Info icon="users" label="Ad, Soyad" value={user.name} />
        <Info icon="file" label="VÖEN / FİN" value={user.voen} />
        <Info icon="building" label="Şirkət" value={user.company || '—'} />
        <Info icon="shield" label="Rol" value={roleLabel(user.role)} />
      </div>

      {verified ? (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-600 text-white">
            <Icon name="check" className="h-5 w-5" />
          </span>
          <div>
            <div className="text-sm font-bold text-brand-800">Profil uğurla təsdiqləndi</div>
            <div className="mt-0.5 text-xs text-brand-700">
              EKTİS kateqoriyası: <b>{verify.category}</b> · Vergi statusu: <b>{verify.taxStatus}</b>
            </div>
          </div>
        </div>
      ) : error ? (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-flag-red text-white">
            <Icon name="x" className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <div className="text-sm font-bold text-flag-red">EKTİS yoxlaması alınmadı</div>
            <div className="mt-0.5 text-xs text-red-700">{error}</div>
            <button className="btn-ghost mt-2 text-xs" onClick={onRetry}>
              <Icon name="arrow" className="h-3.5 w-3.5" /> Yenidən cəhd et
            </button>
          </div>
        </div>
      ) : required ? (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-500 text-white">
            <Icon name="shield" className="h-5 w-5" />
          </span>
          <div>
            <div className="text-sm font-bold text-amber-800">EKTİS reyestrində tapılmadı</div>
            <div className="mt-0.5 text-xs text-amber-700">
              VÖEN/FİN üzrə fermer statusu təsdiqlənmədi. Məlumatları yoxlayın və ya operatorla əlaqə saxlayın.
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-500">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          </span>
          <div>
            <div className="text-sm font-bold text-amber-800">
              {loading ? 'EKTİS yoxlaması aparılır…' : 'EKTİS yoxlaması gözlənilir…'}
            </div>
            <div className="mt-0.5 text-xs text-amber-700">Bu addım adətən bir neçə saniyə çəkir.</div>
          </div>
        </div>
      )}
    </Section>
  );
}

function StepLand({ lands, land, setLand }) {
  return (
    <Section
      step={2}
      icon="map"
      title="Torpaq sahəsinin seçimi"
      subtitle="Xəritədən mövcud (boş) torpaq sahəsini seçin — sahə xüsusiyyətləri sağda göstərilir."
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="card h-[460px] overflow-hidden p-0">
          <MapView lands={lands} selectedId={land?.id} onSelect={setLand} />
        </div>
        <div>
          {land ? (
            <div className="card overflow-hidden p-0">
              <div className="relative overflow-hidden bg-ink-900 p-4 text-white">
                <div className="absolute inset-0 bg-grid opacity-30" />
                <div className="relative">
                  <div className="flex items-center justify-between gap-2">
                    <span className="chip bg-white/10 text-brand-200">Seçilmiş sahə</span>
                    <span className="font-mono text-[11px] text-slate-300">{land.code}</span>
                  </div>
                  <h3 className="mt-2 text-xl font-black leading-tight">{land.districtName}</h3>
                  <p className="text-sm text-slate-300">{land.purposeLabel}</p>
                </div>
              </div>
              <div className="space-y-3 p-4">
                <Gauge label="Sahə" value={land.areaHa} max={Math.max(land.areaHa, 50)} suffix=" ha" tone="bg-brand-500" />
                <Gauge label="Münbitlik indeksi" value={land.fertility} max={100} suffix="/100" tone={fertilityTone(land.fertility)} />
                <Gauge label="Torpaq pH" value={land.ph} max={14} decimals={1} tone="bg-amber-500" />
                <Gauge label="Su mənbəyinə" value={land.waterKm} max={30} suffix=" km" tone="bg-sky-500" invert />
                <button className="btn-ghost mt-1 w-full" onClick={() => setLand(null)}>
                  Başqa sahə seç
                </button>
              </div>
            </div>
          ) : (
            <div className="card p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-ink-900">Mövcud sahələr</h3>
                <span className="chip bg-slate-100 text-slate-600">{lands.length}</span>
              </div>
              {lands.length === 0 ? (
                <p className="mt-3 text-sm text-slate-400">Hazırda boş sahə yoxdur.</p>
              ) : (
                <ul className="mt-2 max-h-[380px] space-y-1.5 overflow-auto pr-1">
                  {lands.map((l) => (
                    <li key={l.id}>
                      <button
                        onClick={() => setLand(l)}
                        className="flex w-full items-center gap-2.5 rounded-lg border border-slate-100 p-2 text-left transition hover:border-brand-200 hover:bg-brand-50/60"
                      >
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: l.color }} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-semibold text-ink-900">{l.districtName}</span>
                          <span className="block truncate text-[11px] text-slate-400">
                            {l.code} · {l.purposeLabel}
                          </span>
                        </span>
                        <span className="text-xs font-bold text-ink-900">{l.areaHa} ha</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </Section>
  );
}

function toggleIn(list, key) {
  return list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
}

function StepPlan({ plan, setPlan, crops, land }) {
  const set = (k, v) => setPlan((p) => ({ ...p, [k]: v }));
  const toggleTech = (key) => set('technologies', toggleIn(plan.technologies, key));
  const toggleChain = (key) => set('valueChain', toggleIn(plan.valueChain, key));
  return (
    <Section
      step={3}
      icon="chart"
      title="Biznes plan və investisiya"
      subtitle="Layihənizin maliyyə modelini ROI kalkulyatoru ilə qiymətləndirin və qısa biznes planı təsvir edin."
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Şirkət adı">
              <input
                className="input"
                value={plan.company}
                onChange={(e) => set('company', e.target.value)}
                placeholder="Şirkət adı"
              />
            </Field>
            <Field label="İnvestisiya həcmi (₼)" hint="Boş buraxsanız ROI üzrə hesablanır">
              <input
                type="number"
                className="input"
                value={plan.investmentAmount}
                onChange={(e) => set('investmentAmount', e.target.value)}
                placeholder="avtomatik"
              />
            </Field>
          </div>

          <Field label="Biznes planın qısa təsviri">
            <textarea
              className="input h-36 resize-none"
              value={plan.businessPlan}
              onChange={(e) => set('businessPlan', e.target.value)}
              placeholder="İstehsal həcmi, texnologiya, gözlənilən məşğulluq…"
            />
          </Field>

          <div className="card p-4">
            <div className="flex items-center gap-2">
              <Icon name="sparkle" className="h-4 w-4 text-brand-600" />
              <h3 className="text-sm font-bold text-ink-900">Müasir texnologiyalar</h3>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">Layihədə istifadə olunacaq texnologiyaları seçin.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {PROJECT_TECHNOLOGIES.map((t) => {
                const active = plan.technologies.includes(t.key);
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => toggleTech(t.key)}
                    aria-pressed={active}
                    className={`chip border ${active ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-500'}`}
                  >
                    <Icon name={t.icon} className="h-3.5 w-3.5" />
                    {t.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-5 flex items-center gap-2">
              <Icon name="layers" className="h-4 w-4 text-brand-600" />
              <h3 className="text-sm font-bold text-ink-900">Dəyər zənciri mərhələləri</h3>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">Layihənin əhatə etdiyi mərhələləri işarələyin.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {VALUE_CHAIN_STEPS.map((v, i) => {
                const active = plan.valueChain.includes(v.key);
                return (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => toggleChain(v.key)}
                    aria-pressed={active}
                    className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition ${active ? 'border-brand-300 bg-brand-50/70' : 'border-slate-200 bg-white hover:border-brand-200'}`}
                  >
                    <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${active ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      {active ? <Icon name="check" className="h-3.5 w-3.5" /> : i + 1}
                    </span>
                    <Icon name={v.icon} className="h-4 w-4 text-slate-400" />
                    <span className="text-xs font-semibold text-ink-900">{v.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="card p-4">
            <div className="flex items-center gap-2">
              <Icon name="target" className="h-4 w-4 text-brand-600" />
              <h3 className="text-sm font-bold text-ink-900">Layihə göstəriciləri</h3>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">Proqnozlaşdırılan təsir göstəricilərini qeyd edin.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {IMPACT_METRICS.map((m) => (
                <Field key={m.key} label={`${m.label} (${m.unit})`}>
                  <input
                    type="number"
                    min="0"
                    className="input"
                    value={plan[m.key]}
                    onChange={(e) => set(m.key, e.target.value)}
                    placeholder="0"
                  />
                </Field>
              ))}
            </div>
          </div>

          <Field label="Əlavə sənədlər">
            <FileUploadDropzone
              files={plan.files}
              onFilesChange={(files) => set('files', files)}
            />
          </Field>
        </div>

        <div className="space-y-4">
          <ROICalculator
            crops={crops}
            purpose={plan.purpose}
            areaHa={plan.areaHa}
            maxHa={land?.areaHa}
            onPurpose={(p) => set('purpose', p)}
            onArea={(a) => set('areaHa', a)}
          />
          {land && <AdvisorPanel land={land} onPickCrop={(p) => set('purpose', p)} />}
        </div>
      </div>
    </Section>
  );
}

function StepSign({ user, land, plan, signature, setSignature, agreed, setAgreed }) {
  let investment = 'ROI üzrə';
  if (plan.investmentAmount) investment = `${plan.investmentAmount} ₼`;
  return (
    <Section
      step={4}
      icon="check"
      title="Rəqəmsal imza və təsdiq"
      subtitle="Göndərməzdən əvvəl məlumatları yoxlayın və rəqəmsal imza ilə təsdiqləyin."
    >
      <div className="grid gap-2 sm:grid-cols-2">
        <Info icon="users" label="Müraciət edən" value={`${user.name} (${user.voen})`} />
        <Info icon="map" label="Sahə" value={`${land?.districtName || '—'} · ${plan.areaHa} ha`} />
        <Info icon="leaf" label="Təyinat" value={land?.purposeLabel || plan.purpose} />
        <Info icon="coin" label="İnvestisiya" value={investment} />
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 p-4">
        <label className="label">Rəqəmsal imza</label>
        <input
          className="input font-semibold"
          placeholder="Ad Soyad yazaraq təsdiq edin"
          value={signature}
          onChange={(e) => setSignature(e.target.value)}
        />
        <p className="mt-1.5 text-[11px] text-slate-400">
          Adınızı yazmaqla müraciətin hüquqi qüvvəyə minməsini təsdiqləyirsiniz.
        </p>
      </div>

      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4 transition hover:border-brand-200 hover:bg-brand-50/40">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-brand-600"
        />
        <span className="text-sm text-slate-600">
          Təqdim etdiyim məlumatların doğruluğunu təsdiqləyir və investisiya müsabiqəsi şərtləri ilə
          razıyam.
        </span>
      </label>
    </Section>
  );
}

function StepSuccess({ result }) {
  const [copied, setCopied] = useState(false);
  const qrRef = useRef(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result.trackingCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
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
    a.download = `muraciet-${result.trackingCode}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="relative overflow-hidden text-center">
      <div className="absolute left-1/2 top-0 h-40 w-40 -translate-x-1/2 rounded-full bg-brand-400/20 blur-3xl" />
      <div className="relative">
        <div className="mx-auto grid h-16 w-16 animate-glow place-items-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg">
          <Icon name="check" className="h-8 w-8" strokeWidth={2.4} />
        </div>
        <h2 className="mt-4 text-2xl font-black text-ink-900">Müraciət qeydə alındı!</h2>
        <p className="mt-1 text-sm text-slate-500">
          Zəhmət olmasa izləmə kodunu və QR kodu saxlayın.
        </p>

        <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row sm:justify-center">
          <div>
            <div ref={qrRef} className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
              <QRCodeSVG value={`${window.location.origin}/track/${result.trackingCode}`} size={150} />
            </div>
            <button onClick={downloadQr} className="btn-ghost mt-2 w-full text-xs">
              <Icon name="download" className="h-4 w-4" /> QR-i yüklə
            </button>
          </div>
          <div className="w-full max-w-xs text-left">
            <div className="text-xs uppercase tracking-wide text-slate-400">İzləmə kodu</div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="font-mono text-2xl font-black tracking-tight text-ink-900">
                {result.trackingCode}
              </span>
              <button
                onClick={copy}
                className="chip bg-slate-100 text-slate-600 transition hover:bg-slate-200"
                title="Kopyala"
              >
                <Icon name={copied ? 'check' : 'copy'} className="h-3.5 w-3.5" />
                {copied ? 'Kopyalandı' : 'Kopyala'}
              </button>
            </div>
            <div className="mt-4">
              <StageTracker status={result.status} timeline={result.timeline} />
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to={`/track/${result.trackingCode}`} className="btn-primary">
            <Icon name="compass" className="h-4 w-4" /> Müraciətimi izlə
          </Link>
          <Link to="/map" className="btn-ghost">
            Yeni müraciət
          </Link>
        </div>
      </div>
    </div>
  );
}

function Section({ step, icon, title, subtitle, children }) {
  return (
    <div>
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-md">
          <Icon name={icon} className="h-5 w-5" />
        </span>
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wide text-brand-600">
            Addım {step} / {STEPS.length}
          </div>
          <h2 className="text-lg font-black text-ink-900">{title}</h2>
          {subtitle && <p className="mt-0.5 max-w-2xl text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      {label && <label className="label">{label}</label>}
      {children}
      {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

function Info({ icon, label, value }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
      {icon && (
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-brand-600 ring-1 ring-slate-100">
          <Icon name={icon} className="h-4 w-4" />
        </span>
      )}
      <div className="min-w-0">
        <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
        <div className="truncate text-sm font-semibold text-ink-900">{value}</div>
      </div>
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

function FileUploadDropzone({ files, onFilesChange }) {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const handleUpload = async (fileList) => {
    const accepted = [];
    for (const file of fileList) {
      if (file.size > 10 * 1024 * 1024) {
        setUploadError(`${file.name}: fayl həcmi 10 MB-dan böyük ola bilməz`);
        continue;
      }
      accepted.push(file);
    }
    if (!accepted.length) return;
    setUploading(true);
    setUploadError('');
    try {
      const data = await api.upload(accepted);
      onFilesChange([...files, ...data.files]);
    } catch (e) {
      setUploadError(e.message || 'Yükləmə alınmadı');
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (id) => {
    onFilesChange(files.filter((f) => f.id !== id));
  };

  return (
    <div className="space-y-3">
      <label
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${
          dragActive ? 'border-brand-400 bg-brand-50/60' : 'border-slate-200 bg-slate-50/60 hover:border-brand-300 hover:bg-brand-50/40'
        } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          handleUpload(Array.from(e.dataTransfer.files));
        }}
      >
        <input
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            const list = Array.from(e.target.files);
            if (list.length) handleUpload(list);
            e.target.value = '';
          }}
        />
        <div className="flex flex-col items-center gap-2">
          {uploading ? (
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          ) : (
            <Icon name="upload" className="h-8 w-8 text-slate-400" />
          )}
          <span className="text-sm font-medium text-ink-900">
            {uploading ? 'Fayllar yüklənir…' : 'Faylları buraya sürükləyin və ya klikləyin'}
          </span>
          <span className="text-xs text-slate-400">PDF, DOCX, XLSX, JPG, PNG · max 10 MB · 5 fayl</span>
        </div>
      </label>

      {uploadError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-flag-red">{uploadError}</p>
      )}

      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600">
              <Icon name="file" className="h-3.5 w-3.5 text-brand-600" />
              <a
                href={f.path || f.url}
                target="_blank"
                rel="noreferrer"
                className="flex-1 truncate hover:text-brand-700 hover:underline"
              >
                {f.originalName || f.name}
              </a>
              <span className="text-[10px] text-slate-400">{((f.size || 0) / 1024).toFixed(1)} KB</span>
              <button
                onClick={() => removeFile(f.id)}
                className="text-slate-400 transition hover:text-flag-red"
                title="Sil"
              >
                <Icon name="trash" className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function fertilityTone(v) {
  if (v >= 75) return 'bg-brand-500';
  if (v >= 55) return 'bg-lime-500';
  if (v >= 40) return 'bg-amber-500';
  return 'bg-orange-500';
}
