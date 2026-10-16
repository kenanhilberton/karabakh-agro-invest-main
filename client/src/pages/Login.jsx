import { useEffect, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { api } from '../api.js';
import { useSession } from '../session.jsx';
import MyGovLogo from '../components/MyGovLogo.jsx';

const ROLE_LABEL = { applicant: 'Sahibkar / İnvestor', operator: 'Nazirlik Operatoru', admin: 'Sistem Admini' };

export default function Login() {
  const { login, user } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({ voen: location.state?.voen || '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.demoAccounts().then(setAccounts).catch(() => {});
  }, []);

  useEffect(() => {
    if (user) {
      const dest = location.state?.from || (user.role === 'operator' || user.role === 'admin' ? '/admin' : '/map');
      navigate(dest, { replace: true });
    }
  }, [user, navigate, location.state]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const u = await login(form.voen, form.password);
      const dest = location.state?.from || (u.role === 'operator' || u.role === 'admin' ? '/admin' : '/map');
      navigate(dest, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-4 py-12 lg:grid-cols-2">
      <div className="card p-7">
        <h1 className="text-2xl font-black text-ink-900">Portalda daxil ol</h1>
        <p className="mt-1 text-sm text-slate-500">Dövlət xidmətləri ilə təhlükəsiz autentifikasiya.</p>

        <button
          type="button"
          onClick={() => navigate('/mygov', { state: { from: location.state?.from } })}
          className="mt-5 flex w-full items-center justify-center gap-2.5 rounded-lg border border-slate-200 bg-white px-4 py-3 font-semibold text-slate-800 shadow-sm transition hover:border-[#0d6efd] hover:bg-[#0d6efd]/5"
        >
          <MyGovLogo size="sm" />
          <span className="text-sm">ilə daxil ol</span>
        </button>

        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-slate-200" />
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            və ya VÖEN / FİN ilə
          </span>
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <form className="space-y-4" onSubmit={submit}>
          <div>
            <label className="label">VÖEN / FİN</label>
            <input
              className="input"
              value={form.voen}
              onChange={(e) => setForm((f) => ({ ...f, voen: e.target.value }))}
              placeholder="1234567890"
            />
          </div>
          <div>
            <label className="label">Şifrə</label>
            <input
              className="input"
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="demo123"
            />
          </div>
          {error && <p className="text-sm text-flag-red">{error}</p>}
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? 'Yoxlanılır…' : 'Daxil ol'}
          </button>
          <p className="text-center text-sm text-slate-500">
            Hesabınız yoxdur?{' '}
            <Link to="/register" className="font-semibold text-brand-700 hover:underline">
              Qeydiyyatdan keç
            </Link>
          </p>
        </form>
      </div>

      <div className="card p-7">
        <h2 className="text-sm font-bold text-ink-900">Demo hesablar</h2>
        <p className="mt-1 text-xs text-slate-500">Münsiflər üçün hazır rollar — üzərinə klikləyərək doldurun.</p>
        <div className="mt-4 space-y-2">
          {accounts.map((a) => (
            <button
              key={a.voen}
              onClick={() => setForm({ voen: a.voen, password: a.password })}
              className="flex w-full items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5 text-left transition hover:bg-brand-50"
            >
              <div>
                <div className="text-sm font-semibold text-ink-900">{a.name}</div>
                <div className="text-[11px] text-slate-500">{a.company}</div>
              </div>
              <div className="text-right">
                <div className="chip bg-white text-slate-600">{ROLE_LABEL[a.role] || a.role}</div>
                <div className="mt-1 font-mono text-[11px] text-slate-400">{a.voen}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
