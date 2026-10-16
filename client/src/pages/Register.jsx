import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useSession } from '../session.jsx';
import Icon from '../components/Icon.jsx';
import MyGovLogo from '../components/MyGovLogo.jsx';

const EMPTY = { voen: '', name: '', company: '', email: '', phone: '', password: '', confirm: '', userType: 'sahibkar' };

const ACCOUNT_TYPES = [
  {
    key: 'sahibkar',
    label: 'Sahibkar',
    icon: 'users',
    desc: 'Torpaq icarəyə götürüb təsərrüfat qurmaq istəyirəm'
  },
  {
    key: 'investor',
    label: 'İnvestor',
    icon: 'coin',
    desc: 'Aqrar layihələrə investisiya qoymaq istəyirəm'
  }
];

const BENEFITS = [
  { icon: 'target', title: 'Torpaq seçimi', text: 'Xəritədən sərbəst sahələri seçin və onlayn müraciət göndərin.' },
  { icon: 'chart', title: 'Agro-ROI hesablaması', text: 'İnvestisiya, gəlirlilik və geri qaytarma müddətini anında görün.' },
  { icon: 'shield', title: 'Dövlət dəstəyi', text: 'Güzəştli icarə, subsidiya və vergi güzəştləri üçün müsabiqələrə qatılın.' }
];

const TYPE_LABEL = { sahibkar: 'Sahibkar', investor: 'İnvestor', user: 'Sadə istifadəçi' };

export default function Register() {
  const { user, register } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ ...EMPTY, voen: location.state?.voen || '' });
  const [verify, setVerify] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  useEffect(() => {
    if (user) navigate('/map', { replace: true });
  }, [user, navigate]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const activeType = ACCOUNT_TYPES.find((t) => t.key === form.userType) || ACCOUNT_TYPES[0];
  const TYPE_DESC = {
    sahibkar:
      'VÖEN/FİN ilə qeydiyyatdan keçin. Təsdiqdən sonra torpaq seçə və müraciət edə biləcəksiniz.',
    investor:
      'VÖEN/FİN ilə qeydiyyatdan keçin. Təsdiqdən sonra investisiya imkanlarını araşdıra biləcəksiniz.'
  };

  async function checkEktis() {
    const voen = form.voen.trim();
    if (voen.length < 7) {
      setError('VÖEN/FİN ən azı 7 simvol olmalıdır');
      return;
    }
    setVerifying(true);
    setError('');
    setVerify(null);
    try {
      const res = await api.ektisVerify(voen);
      setVerify(res);
      if (res.verified && !res.registered) {
        setForm((f) => ({ ...f, name: f.name || res.name || '', company: f.company || res.company || '' }));
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setVerifying(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!form.voen.trim() || !form.name.trim()) {
      setError('VÖEN/FİN və ad soyad tələb olunur');
      return;
    }
    if (form.password.length < 6) {
      setError('Şifrə ən azı 6 simvol olmalıdır');
      return;
    }
    if (form.password !== form.confirm) {
      setError('Şifrələr uyğun gəlmir');
      return;
    }
    if (form.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) {
      setError('E-poçt ünvanı düzgün deyil');
      return;
    }
    if (!agree) {
      setError('İstifadə şərtləri və məlumatların işlənməsinə razılıq tələb olunur');
      return;
    }
    setBusy(true);
    try {
      const res = await register({
        voen: form.voen.trim(),
        name: form.name.trim(),
        company: form.company.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        userType: form.userType,
        password: form.password
      });
      setDone(res);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (done) return <PendingScreen data={done} navigate={navigate} />;

  let verifyBox = null;
  if (verify) {
    if (verify.verified && verify.registered) {
      verifyBox = { cls: 'bg-amber-50 text-amber-700 ring-amber-200', icon: 'shield', text: `Bu VÖEN artıq portalda qeydiyyatdadır (${verify.name}). Daxil olmağı sınayın.` };
    } else if (verify.verified) {
      verifyBox = { cls: 'bg-brand-50 text-brand-700 ring-brand-200', icon: 'check', text: `✓ ${verify.name} — ${verify.company}. EKTİS reyestrində təsdiqləndi.` };
    } else {
      verifyBox = { cls: 'bg-slate-50 text-slate-600 ring-slate-200', icon: 'search', text: 'Bu VÖEN EKTİS reyestrində tapılmadı. Məlumatları əl ilə doldurub davam edə bilərsiniz.' };
    }
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 lg:grid-cols-[1.15fr_0.85fr]">
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-brand-700">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-brand-50">
            <Icon name={activeType.icon} className="h-3.5 w-3.5" />
          </span>
          {activeType.label} qeydiyyatı
        </div>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-ink-900">Hesab yaradın</h1>
        <p className="mt-1 text-sm text-slate-500">{TYPE_DESC[form.userType]}</p>

        <button
          type="button"
          onClick={() => navigate('/mygov', { state: { mode: 'register' } })}
          className="mt-5 flex w-full items-center justify-center gap-2.5 rounded-lg border border-slate-200 bg-white px-4 py-3 font-semibold text-slate-800 shadow-sm transition hover:border-[#0d6efd] hover:bg-[#0d6efd]/5"
        >
          <MyGovLogo size="sm" />
          <span className="text-sm">ilə qeydiyyatdan keç</span>
        </button>

        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-slate-200" />
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            və ya VÖEN / FİN ilə
          </span>
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <form className="card mt-6 p-6" onSubmit={submit}>
          <div className="space-y-4">
            <div>
              <label className="label">Hesab növü</label>
              <div className="grid gap-3 sm:grid-cols-2">
                {ACCOUNT_TYPES.map((t) => {
                  const on = form.userType === t.key;
                  const cls = on
                    ? 'border-brand-500 bg-brand-50/70 ring-2 ring-brand-500/30'
                    : 'border-slate-200 bg-white hover:border-brand-300 hover:bg-brand-50/30';
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => { set('userType', t.key); setVerify(null); setError(''); }}
                      aria-pressed={on}
                      className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition ${cls}`}
                    >
                      <span
                        className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${
                          on ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        <Icon name={t.icon} className="h-5 w-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 text-sm font-bold text-ink-900">
                          {t.label}
                          {on && <Icon name="check" className="h-3.5 w-3.5 text-brand-600" />}
                        </span>
                        <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">{t.desc}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="label">VÖEN / FİN</label>
              {form.userType === 'sahibkar' ? (
                <>
                  <div className="flex gap-2">
                    <input
                      className="input"
                      value={form.voen}
                      onChange={(e) => { set('voen', e.target.value); setVerify(null); }}
                      placeholder="2501234567"
                    />
                    <button
                      type="button"
                      className="btn-blue shrink-0"
                      onClick={checkEktis}
                      disabled={verifying}
                    >
                      {verifying ? 'Yoxlanılır…' : 'EKTİS-dən yoxla'}
                    </button>
                  </div>
                  {verifyBox && (
                    <div className={`mt-2 flex items-start gap-2 rounded-lg px-3 py-2 text-xs ring-1 ${verifyBox.cls}`}>
                      <Icon name={verifyBox.icon} className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>{verifyBox.text}</span>
                    </div>
                  )}
                  <p className="mt-1 text-[11px] text-slate-400">
                    Test üçün: 2501234567, 3009876543, 4107654321
                  </p>
                </>
              ) : (
                <>
                  <input
                    className="input"
                    value={form.voen}
                    onChange={(e) => set('voen', e.target.value)}
                    placeholder="Fərdi investor üçün FİN, şirkət üçün VÖEN"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    Fərdi investor FİN, hüquqi şəxs VÖEN yazır. Bu identifikator giriş üçün istifadə olunur.
                  </p>
                </>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Ad, Soyad</label>
                <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Rəşad Hüseynov" />
              </div>
              <div>
                <label className="label">Şirkət / Təsərrüfat</label>
                <input className="input" value={form.company} onChange={(e) => set('company', e.target.value)} placeholder="Qarabağ Bağçılıq MMC" />
              </div>
              <div>
                <label className="label">E-poçt</label>
                <input className="input" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="ad@example.az" />
              </div>
              <div>
                <label className="label">Telefon</label>
                <input className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+994 50 123 45 67" />
              </div>
              <div>
                <label className="label">Şifrə</label>
                <input className="input" type="password" value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="Ən azı 6 simvol" />
              </div>
              <div>
                <label className="label">Şifrə (təkrar)</label>
                <input className="input" type="password" value={form.confirm} onChange={(e) => set('confirm', e.target.value)} placeholder="Şifrəni təkrar yazın" />
              </div>
            </div>

            <label className="flex items-start gap-2 text-xs text-slate-600">
              <input type="checkbox" className="mt-0.5" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
              <span>
                İstifadə şərtlərini və şəxsi məlumatların EKTİS üzərindən yoxlanmasına razılığı qəbul edirəm.
              </span>
            </label>

            {error && (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-flag-red ring-1 ring-red-100">{error}</div>
            )}

            <button className="btn-primary w-full" disabled={busy}>
              {busy ? 'Qeydiyyat göndərilir…' : 'Qeydiyyatdan keç'}
            </button>

            <p className="text-center text-sm text-slate-500">
              Artıq hesabınız var?{' '}
              <Link to="/login" className="font-semibold text-brand-700 hover:underline">Daxil olun</Link>
            </p>
          </div>
        </form>
      </div>

      <aside className="space-y-4">
        <div className="card bg-gradient-to-br from-ink-900 to-ink-800 p-6 text-white">
          <h2 className="text-sm font-bold uppercase tracking-wide text-white/70">Necə işləyir</h2>
          <ol className="mt-4 space-y-4">
            <Step n="1" title="Qeydiyyat" text="VÖEN və əlaqə məlumatlarını təqdim edin." state="active" />
            <Step n="2" title="Operator təsdiqi" text="Məlumatlar EKTİS ilə tutuşdurulur və hesab təsdiqlənir." state="idle" />
            <Step n="3" title="Aktiv hesab" text="Daxil olub torpaq seçin və müraciət göndərin." state="idle" />
          </ol>
        </div>

        {BENEFITS.map((b) => (
          <div key={b.title} className="card flex gap-3 p-5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
              <Icon name={b.icon} className="h-5 w-5" />
            </span>
            <div>
              <div className="text-sm font-bold text-ink-900">{b.title}</div>
              <p className="mt-0.5 text-xs text-slate-500">{b.text}</p>
            </div>
          </div>
        ))}
      </aside>
    </div>
  );
}

function Step({ n, title, text, state }) {
  let dotCls = 'bg-white/10 text-white/60';
  if (state === 'active') dotCls = 'bg-brand-500 text-white';
  return (
    <li className="flex gap-3">
      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${dotCls}`}>{n}</span>
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <p className="text-xs text-white/60">{text}</p>
      </div>
    </li>
  );
}

function PendingScreen({ data, navigate }) {
  const user = data?.user || {};
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="card overflow-hidden">
        <div className="bg-gradient-to-br from-brand-600 to-brand-700 p-8 text-center text-white">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-white/20">
            <Icon name="check" className="h-8 w-8" />
          </div>
          <h1 className="mt-4 text-2xl font-black">Qeydiyyatınız qeydə alındı</h1>
          <p className="mt-1 text-sm text-white/80">{data?.message || 'Operator təsdiqindən sonra daxil ola biləcəksiniz.'}</p>
        </div>

        <div className="p-7">
          <div className="grid grid-cols-2 gap-3">
            <Info label="VÖEN / FİN" value={user.voen || '—'} />
            <Info label="Ad, Soyad" value={user.name || '—'} />
            <Info label="Hesab növü" value={TYPE_LABEL[user.userType] || 'Sahibkar'} />
            <Info label="Şirkət" value={user.company || '—'} />
            <Info label="Status" value="Təsdiq gözləyir" />
          </div>

          <div className="mt-6">
            <div className="label">Mərhələlər</div>
            <div className="mt-2 space-y-3">
              <TrackStep title="Qeydiyyat qeydə alındı" text="Məlumatlarınız sistemə daxil edildi." state="done" />
              <TrackStep title="Operator yoxlaması" text="VÖEN EKTİS üzərindən tutuşdurulur." state="active" />
              <TrackStep title="Hesab aktiv" text="Təsdiqdən sonra daxil ola biləcəksiniz." state="idle" />
            </div>
          </div>

          <div className="mt-7 flex flex-col gap-2 sm:flex-row">
            <button className="btn-primary flex-1" onClick={() => navigate('/login', { state: { voen: user.voen } })}>
              Daxil ol səhifəsinə keç
            </button>
            <button className="btn-ghost" onClick={() => navigate('/')}>Əsas səhifə</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-sm font-semibold text-ink-900">{value}</div>
    </div>
  );
}

function TrackStep({ title, text, state }) {
  let dot = 'bg-slate-200';
  let ring = 'ring-slate-100';
  if (state === 'done') { dot = 'bg-brand-500'; ring = 'ring-brand-100'; }
  if (state === 'active') { dot = 'bg-amber-400 animate-pulse'; ring = 'ring-amber-100'; }
  return (
    <div className={`flex items-start gap-3 rounded-xl p-3 ring-1 ${ring}`}>
      <span className={`mt-0.5 h-3 w-3 shrink-0 rounded-full ${dot}`} />
      <div>
        <div className="text-sm font-semibold text-ink-900">{title}</div>
        <p className="text-xs text-slate-500">{text}</p>
      </div>
    </div>
  );
}
