import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../api.js';
import { useSession } from '../session.jsx';
import MyGovLogo from '../components/MyGovLogo.jsx';
import Icon from '../components/Icon.jsx';

// Short-lived QR session id (falls back when crypto.randomUUID is unavailable).
const newSession = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `s-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const T = {
  az: {
    headline: 'mygov sisteminə daxil olmaq üçün «mygov ID»-dən istifadə edirsiniz.',
    mobile: 'mygov mobil tətbiqi ilə giriş edin!',
    steps: ['Tətbiqi açın.', 'Tətbiqdə «QR skan» düyməsini sıxın.', 'QR kodu skan edərək daxil olun.'],
    note: 'Tətbiqiniz yoxdursa, kamera ilə skan edin və tətbiqi yükləyin.',
    other: 'Digər üsullar',
    otherClose: 'Digər üsulları bağla',
    finTitle: 'FİN ilə daxil ol',
    finHint: 'mygov ID hesabınıza bağlı FİN-i (VÖEN) daxil edin.',
    finPlaceholder: 'FİN daxil edin',
    submit: 'Daxil ol',
    busy: 'Yoxlanılır…',
    back: 'Giriş səhifəsinə qayıt',
    validity: 'QR kodun etibarlılıq müddəti',
    refresh: 'Yenilə',
    demo: 'Demo: mygov ID simulyasiyası',
    demoHint: 'Test FİN-lərindən birini seçin:'
  },
  en: {
    headline: 'To sign in to the mygov system you use «mygov ID».',
    mobile: 'Sign in with the mygov mobile app!',
    steps: ['Open the app.', 'Tap the «Scan QR» button in the app.', 'Scan the QR code to sign in.'],
    note: "Don't have the app? Scan with your camera and download the app.",
    other: 'Other methods',
    otherClose: 'Hide other methods',
    finTitle: 'Sign in with FİN',
    finHint: 'Enter the FİN (VÖEN) linked to your mygov ID account.',
    finPlaceholder: 'Enter FİN',
    submit: 'Sign in',
    busy: 'Checking…',
    back: 'Back to sign-in page',
    validity: 'QR code is valid for',
    refresh: 'Refresh',
    demo: 'Demo: mygov ID simulation',
    demoHint: 'Pick one of the test FİNs:'
  }
};

export default function MyGovLogin() {
  const { loginWithMyGov, user } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  // Opened from the registration page ("MyGov ilə qeydiyyatdan keç").
  const isRegister = location.state?.mode === 'register';

  const [lang, setLang] = useState('az');
  const [other, setOther] = useState(isRegister);
  const [fin, setFin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [session, setSession] = useState(newSession);
  const [seconds, setSeconds] = useState(120);
  const t = T[lang];

  useEffect(() => {
    api.demoAccounts().then(setAccounts).catch(() => {});
  }, []);

  // Already signed in? Skip the IdP screen.
  useEffect(() => {
    if (user) {
      const dest =
        location.state?.from || (user.role === 'operator' || user.role === 'admin' ? '/admin' : '/map');
      navigate(dest, { replace: true });
    }
  }, [user, navigate, location.state]);

  // QR validity countdown; auto-refresh the session when it expires.
  useEffect(() => {
    const id = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          setSession(newSession());
          return 120;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const qrValue = useMemo(() => `https://mygovid.gov.az/auth?session=${session}`, [session]);
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');

  function refresh() {
    setSession(newSession());
    setSeconds(120);
  }

  async function submit(e) {
    e.preventDefault();
    if (!fin.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const u = await loginWithMyGov(fin.trim());
      const dest =
        location.state?.from || (u.role === 'operator' || u.role === 'admin' ? '/admin' : '/map');
      navigate(dest, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f0f4fa]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3.5">
          <MyGovLogo />
          <div className="flex items-center gap-2 text-sm font-bold">
            <button
              type="button"
              onClick={() => setLang('az')}
              className={lang === 'az' ? 'text-[#0d6efd]' : 'text-slate-400 hover:text-slate-600'}
            >
              AZ
            </button>
            <span className="text-slate-300">|</span>
            <button
              type="button"
              onClick={() => setLang('en')}
              className={lang === 'en' ? 'text-[#0d6efd]' : 'text-slate-400 hover:text-slate-600'}
            >
              ENG
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-8 sm:py-12">
        <h1 className="mx-auto max-w-2xl text-center text-base font-semibold text-slate-700 sm:text-lg">
          {t.headline}
        </h1>

        <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 sm:p-8">
          <div className="grid items-center gap-8 md:grid-cols-[minmax(0,240px)_1fr]">
            {/* QR + other methods */}
            <div className="flex flex-col items-center">
              <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                <QRCodeSVG value={qrValue} size={196} level="M" />
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs font-medium text-slate-500">
                <Icon name="clock" className="h-3.5 w-3.5" />
                <span className="tabular-nums">
                  {t.validity}: {mm}:{ss}
                </span>
                <button type="button" onClick={refresh} className="font-semibold text-[#0d6efd] hover:underline">
                  {t.refresh}
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOther((v) => !v);
                  setError('');
                }}
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-[#0d6efd] hover:text-[#0d6efd]"
              >
                <Icon name="qr" className="h-4 w-4" />
                {other ? t.otherClose : t.other}
              </button>
            </div>

            {/* Instructions */}
            <div>
              <h2 className="text-base font-bold text-slate-900">{t.mobile}</h2>
              <ol className="mt-4 space-y-3">
                {t.steps.map((s, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-slate-600">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#0d6efd]/10 text-[11px] font-bold text-[#0d6efd]">
                      {i + 1}
                    </span>
                    <span className="pt-0.5">{s}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-5 rounded-lg bg-slate-50 px-3.5 py-2.5 text-xs leading-relaxed text-slate-500 ring-1 ring-slate-100">
                {t.note}
              </p>
            </div>
          </div>

          {/* Other methods → FİN sign-in */}
          {other && (
            <div className="mt-7 border-t border-slate-100 pt-6">
              <div className="mx-auto max-w-md">
                <h3 className="text-sm font-bold text-slate-900">
                  {isRegister ? 'FİN ilə qeydiyyat' : t.finTitle}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  {isRegister
                    ? 'mygov ID hesabınıza bağlı FİN-i daxil edin. Hesab hələ yoxdursa, qeydiyyat formasına keçəcəksiniz.'
                    : t.finHint}
                </p>
                <form onSubmit={submit} className="mt-3 flex gap-2">
                  <input
                    className="input"
                    value={fin}
                    onChange={(e) => setFin(e.target.value)}
                    placeholder={t.finPlaceholder}
                    autoFocus
                  />
                  <button className="btn-blue shrink-0" disabled={busy}>
                    {busy ? t.busy : isRegister ? 'Davam et' : t.submit}
                  </button>
                </form>
                {error && <p className="mt-2 text-sm text-flag-red">{error}</p>}
                {isRegister && (
                  <button
                    type="button"
                    onClick={() => navigate('/register', { state: { voen: fin.trim() } })}
                    className="btn-primary mt-3 w-full"
                  >
                    {error ? 'Bu FİN ilə qeydiyyatdan keç' : 'Qeydiyyat formasına keç'}
                  </button>
                )}
                {accounts.length > 0 && (
                  <div className="mt-4">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      {t.demoHint}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {accounts.map((a) => (
                        <button
                          key={a.voen}
                          type="button"
                          onClick={() => {
                            setFin(a.voen);
                            setError('');
                          }}
                          className="chip bg-slate-100 text-slate-600 transition hover:bg-slate-200"
                        >
                          {a.voen} · {a.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="mt-5 flex items-center justify-center gap-2 text-xs text-slate-400">
          <Icon name="shield" className="h-3.5 w-3.5" />
          <span>{t.demo}</span>
        </div>
        <div className="mt-3 text-center">
          <Link
            to={isRegister ? '/register' : '/login'}
            className="text-sm font-semibold text-slate-500 hover:text-[#0d6efd]"
          >
            ← {isRegister ? 'Qeydiyyat səhifəsinə qayıt' : t.back}
          </Link>
        </div>
      </main>
    </div>
  );
}
