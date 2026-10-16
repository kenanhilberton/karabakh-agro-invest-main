import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useSession } from '../session.jsx';
import StageTracker from '../components/StageTracker.jsx';
import ScoreBadge from '../components/ScoreBadge.jsx';
import Icon from '../components/Icon.jsx';
import { STATUS_COLORS, STAGE_LABEL, STAGES, TECH_LABELS, VALUE_CHAIN_STEPS, IMPACT_METRICS } from '../constants.js';

const TABS = [
  { key: 'board', label: 'Kanban lövhəsi' },
  { key: 'apps', label: 'Müraciətlər' },
  { key: 'competitions', label: 'Müsabiqələr' },
  { key: 'users', label: 'İstifadəçilər' },
  { key: 'lands', label: 'Torpaqlar' },
  { key: 'ektis', label: 'EKTİS İnteqrasiya' }
];

export default function AdminDashboard() {
  const { user } = useSession();
  const [tab, setTab] = useState('apps');
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.landStats().then(setStats).catch(() => {});
  }, [tab]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-ink-900">Operator / Admin paneli</h1>
          <p className="text-sm text-slate-500">
            {user.name} · <span className="uppercase">{user.role}</span>
          </p>
        </div>
        <div className="flex gap-2">
          {stats && (
            <>
              <Stat label="Sahə" value={`${stats.totalHa.toLocaleString('az-AZ')} ha`} />
              <Stat label="Müraciət" value={stats.applications} />
            </>
          )}
        </div>
      </div>

      <div className="mt-6 flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition ${
              tab === t.key
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-ink-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === 'board' && <KanbanBoard />}
        {tab === 'apps' && <ApplicationsPanel />}
        {tab === 'competitions' && <CompetitionsPanel isAdmin={user.role === 'admin'} />}
        {tab === 'users' && <UsersPanel />}
        {tab === 'lands' && <LandsPanel isAdmin={user.role === 'admin'} />}
        {tab === 'ektis' && <EktisPanel />}
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="card px-4 py-2 text-right">
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-lg font-black text-ink-900">{value}</div>
    </div>
  );
}

const ROLE_LABEL = { applicant: 'Sahibkar', operator: 'Operator', admin: 'Admin' };
const USER_STATUS = {
  active: { label: 'Aktiv', cls: 'bg-brand-50 text-brand-700' },
  pending: { label: 'Təsdiq gözləyir', cls: 'bg-amber-50 text-amber-700' },
  rejected: { label: 'Rədd edilib', cls: 'bg-red-50 text-flag-red' }
};

function UsersPanel() {
  const [data, setData] = useState({ total: 0, pending: 0, users: [] });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => {
    load();
  }, [statusFilter]);

  function load() {
    setLoading(true);
    api
      .users(statusFilter || undefined)
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  async function setStatus(id, status) {
    setBusy(id);
    try {
      await api.setUserStatus(id, status);
    } catch (e) {
      alert(e.message || 'Əməliyyat alınmadı');
    } finally {
      setBusy('');
      load();
    }
  }

  const filters = [
    { key: '', label: 'Hamısı' },
    { key: 'pending', label: 'Təsdiq gözləyən' },
    { key: 'active', label: 'Aktiv' },
    { key: 'rejected', label: 'Rədd edilən' }
  ];

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-3">
        <div className="flex flex-wrap items-center gap-1">
          {filters.map((f) => {
            const on = statusFilter === f.key;
            const cls = on ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200';
            return (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${cls}`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          {data.pending > 0 && (
            <span className="chip bg-amber-50 text-amber-700">{data.pending} təsdiq gözləyir</span>
          )}
          <button className="btn-ghost" onClick={load}>Yenilə</button>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-sm text-slate-400">Yüklənir…</div>
      ) : data.users.length === 0 ? (
        <div className="p-8 text-center text-sm text-slate-400">İstifadəçi yoxdur.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">İstifadəçi</th>
                <th className="px-3 py-2">VÖEN / FİN</th>
                <th className="px-3 py-2">Əlaqə</th>
                <th className="px-3 py-2">Rol</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Əməliyyat</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((u) => {
                const meta = USER_STATUS[u.status] || USER_STATUS.active;
                return (
                  <tr key={u.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">
                      <div className="font-semibold text-ink-900">{u.name}</div>
                      <div className="text-[11px] text-slate-400">{u.company || '—'}</div>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{u.voen}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">
                      <div>{u.email || '—'}</div>
                      <div>{u.phone || ''}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div>{ROLE_LABEL[u.role] || u.role}</div>
                      {u.role === 'applicant' && (
                        <span
                          className={`chip text-[10px] ${
                            u.userType === 'investor' ? 'bg-violet-50 text-violet-700' : 'bg-sky-50 text-sky-700'
                          }`}
                        >
                          {u.userType === 'investor' ? 'İnvestor' : 'Sahibkar'}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`chip ${meta.cls}`}>{meta.label}</span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-2">
                        {u.status !== 'active' && (
                          <button
                            className="rounded-md bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100 disabled:opacity-50"
                            disabled={busy === u.id}
                            onClick={() => setStatus(u.id, 'active')}
                          >
                            Təsdiqlə
                          </button>
                        )}
                        {u.status !== 'rejected' && (
                          <button
                            className="rounded-md bg-red-50 px-2.5 py-1 text-xs font-semibold text-flag-red hover:bg-red-100 disabled:opacity-50"
                            disabled={busy === u.id}
                            onClick={() => setStatus(u.id, 'rejected')}
                          >
                            İmtina
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const COMP_STATUS = {
  upcoming: { label: 'Yaxınlaşır', cls: 'bg-amber-50 text-amber-700' },
  active: { label: 'Aktiv', cls: 'bg-brand-50 text-brand-700' },
  closed: { label: 'Bağlı', cls: 'bg-slate-100 text-slate-600' }
};

const splitLines = (s) => String(s || '').split('\n').map((x) => x.trim()).filter(Boolean);
const toDateInput = (iso) => (iso ? String(iso).slice(0, 10) : '');

const EMPTY_COMP = {
  code: '',
  title: '',
  short: '',
  description: '',
  status: 'upcoming',
  startDate: '',
  endDate: '',
  totalBudget: '',
  categories: [],
  incentives: '',
  eligibility: '',
  stages: '',
  currentStage: ''
};

function CompetitionsPanel({ isAdmin }) {
  const [list, setList] = useState([]);
  const [crops, setCrops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(EMPTY_COMP);
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');

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
    api.meta().then((m) => setCrops(m.crops || [])).catch(() => {});
  }, [load]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function reset() {
    setForm(EMPTY_COMP);
    setEditingId(null);
    setMsg('');
  }

  function edit(c) {
    setEditingId(c.id);
    setMsg('');
    setForm({
      code: c.code || '',
      title: c.title || '',
      short: c.short || '',
      description: c.description || '',
      status: c.status || 'upcoming',
      startDate: toDateInput(c.startDate),
      endDate: toDateInput(c.endDate),
      totalBudget: c.totalBudget != null ? String(c.totalBudget) : '',
      categories: [...(c.categories || [])],
      incentives: (c.incentives || []).join('\n'),
      eligibility: (c.eligibility || []).join('\n'),
      stages: (c.stages || []).join('\n'),
      currentStage: c.currentStage != null ? String(c.currentStage) : ''
    });
  }

  function toggleCategory(key) {
    setForm((f) => {
      const has = f.categories.includes(key);
      return { ...f, categories: has ? f.categories.filter((k) => k !== key) : [...f.categories, key] };
    });
  }

  async function save() {
    setMsg('');
    setError('');
    const payload = {
      code: form.code || undefined,
      title: form.title,
      short: form.short,
      description: form.description,
      status: form.status,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      totalBudget: form.totalBudget === '' ? null : Number(form.totalBudget),
      categories: form.categories,
      incentives: splitLines(form.incentives),
      eligibility: splitLines(form.eligibility),
      stages: splitLines(form.stages),
      currentStage: form.currentStage === '' ? null : Number(form.currentStage)
    };
    setBusy('save');
    try {
      if (editingId) await api.updateCompetition(editingId, payload);
      else await api.addCompetition(payload);
      setMsg(editingId ? 'Müsabiqə yeniləndi ✓' : 'Yeni müsabiqə yaradıldı ✓');
      reset();
      load();
    } catch (e) {
      setError(e.message || 'Yadda saxlanıla bilmədi');
    } finally {
      setBusy('');
    }
  }

  async function changeStatus(id, status) {
    setBusy(id);
    try {
      await api.setCompetitionStatus(id, status);
      load();
    } catch (e) {
      alert(e.message || 'Status dəyişdirilə bilmədi');
    } finally {
      setBusy('');
    }
  }

  async function changeStage(id, currentStage) {
    setBusy(id);
    try {
      await api.setCompetitionStage(id, currentStage);
      setMsg('Cari mərhələ yeniləndi ✓');
      load();
    } catch (e) {
      alert(e.message || 'Mərhələ dəyişdirilə bilmədi');
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-flag-red">{error}</div>
        )}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 p-3">
            <h3 className="text-sm font-bold text-ink-900">Müsabiqələr ({list.length})</h3>
            <button className="btn-ghost" onClick={load}>Yenilə</button>
          </div>
          {loading ? (
            <div className="p-8 text-center text-sm text-slate-400">Yüklənir…</div>
          ) : list.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">Müsabiqə yoxdur.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Kod</th>
                    <th className="px-3 py-2">Başlıq</th>
                    <th className="px-3 py-2">Tarixlər</th>
                    <th className="px-3 py-2">Büdcə</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Cari mərhələ</th>
                    <th className="px-3 py-2 text-right">Əməliyyat</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((c) => {
                    const st = COMP_STATUS[c.status] || COMP_STATUS.upcoming;
                    return (
                      <tr key={c.id} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-mono text-xs">{c.code}</td>
                        <td className="px-3 py-2">
                          <div className="font-semibold text-ink-900">{c.title}</div>
                          <div className="text-[11px] text-slate-400">{c.applicationsCount} müraciət</div>
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-500">
                          <div>{toDateInput(c.startDate) || '—'}</div>
                          <div>{toDateInput(c.endDate) || '—'}</div>
                        </td>
                        <td className="px-3 py-2 text-xs">{c.totalBudget != null ? `${Number(c.totalBudget).toLocaleString('az-AZ')} ₼` : '—'}</td>
                        <td className="px-3 py-2">
                          <span className={`chip ${st.cls}`}>{st.label}</span>
                        </td>
                        <td className="px-3 py-2">
                          <select
                            className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[11px]"
                            value={c.currentStage ?? ''}
                            disabled={busy === c.id}
                            onChange={(e) => changeStage(c.id, e.target.value === '' ? null : Number(e.target.value))}
                          >
                            <option value="">Avto</option>
                            {(c.stages || []).map((s, i) => (
                              <option key={i} value={i}>{i + 1}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-1.5">
                            {c.status !== 'active' && (
                              <button
                                className="rounded-md bg-brand-50 px-2 py-1 text-[11px] font-semibold text-brand-700 hover:bg-brand-100 disabled:opacity-50"
                                disabled={busy === c.id}
                                onClick={() => changeStatus(c.id, 'active')}
                              >
                                Aktiv et
                              </button>
                            )}
                            {c.status === 'active' && (
                              <button
                                className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-200 disabled:opacity-50"
                                disabled={busy === c.id}
                                onClick={() => changeStatus(c.id, 'closed')}
                              >
                                Bağla
                              </button>
                            )}
                            {isAdmin && (
                              <button
                                className="rounded-md bg-sky-50 px-2 py-1 text-[11px] font-semibold text-flag-blue hover:bg-sky-100"
                                onClick={() => edit(c)}
                              >
                                Redaktə
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {isAdmin ? (
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-ink-900">
              {editingId ? 'Müsabiqəni redaktə et' : 'Yeni müsabiqə'}
            </h3>
            {editingId && (
              <button className="text-xs text-slate-500 hover:text-ink-900" onClick={reset}>Ləğv et</button>
            )}
          </div>
          <div className="mt-3 space-y-3">
            <div>
              <label className="label">Başlıq</label>
              <input className="input" value={form.title} onChange={(e) => set('title', e.target.value)} />
            </div>
            <div>
              <label className="label">Qısa ad</label>
              <input className="input" value={form.short} onChange={(e) => set('short', e.target.value)} />
            </div>
            <div>
              <label className="label">Təsvir</label>
              <textarea className="input min-h-[72px]" value={form.description} onChange={(e) => set('description', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Başlama</label>
                <input type="date" className="input" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
              </div>
              <div>
                <label className="label">Bitmə</label>
                <input type="date" className="input" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} />
              </div>
              <div>
                <label className="label">Büdcə (₼)</label>
                <input type="number" className="input" value={form.totalBudget} onChange={(e) => set('totalBudget', e.target.value)} />
              </div>
              <div>
                <label className="label">Status</label>
                <select className="input" value={form.status} onChange={(e) => set('status', e.target.value)}>
                  <option value="upcoming">Yaxınlaşır</option>
                  <option value="active">Aktiv</option>
                  <option value="closed">Bağlı</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label">Kateqoriyalar</label>
              <div className="flex flex-wrap gap-1.5">
                {crops.map((c) => {
                  const on = form.categories.includes(c.key);
                  let chipCls = 'bg-slate-100 text-slate-600 hover:bg-slate-200';
                  if (on) chipCls = 'bg-brand-600 text-white';
                  return (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => toggleCategory(c.key)}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${chipCls}`}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="label">Güzəşt və dəstəklər (hər sətir bir bənd)</label>
              <textarea className="input min-h-[64px]" value={form.incentives} onChange={(e) => set('incentives', e.target.value)} />
            </div>
            <div>
              <label className="label">İştirak şərtləri</label>
              <textarea className="input min-h-[64px]" value={form.eligibility} onChange={(e) => set('eligibility', e.target.value)} />
            </div>
            <div>
              <label className="label">Mərhələlər</label>
              <textarea className="input min-h-[64px]" value={form.stages} onChange={(e) => set('stages', e.target.value)} />
            </div>
            <div>
              <label className="label">Cari mərhələ (əl ilə təyin)</label>
              <select className="input" value={form.currentStage} onChange={(e) => set('currentStage', e.target.value)}>
                <option value="">Avtomatik (tarixə görə)</option>
                {splitLines(form.stages).map((s, i) => (
                  <option key={i} value={i}>{i + 1}. {s}</option>
                ))}
              </select>
            </div>
            <button className="btn-primary w-full" onClick={save} disabled={busy === 'save'}>
              {busy === 'save' ? 'Yadda saxlanılır…' : editingId ? 'Yenilə' : 'Yarat'}
            </button>
            {msg && <p className="text-xs text-brand-700">{msg}</p>}
          </div>
        </div>
      ) : (
        <div className="card grid place-items-center p-6 text-center text-sm text-slate-400">
          Müsabiqə yaratmaq/redaktə etmək yalnız admin roluna aiddir. Statusu isə operator və admin dəyişə bilər.
        </div>
      )}
    </div>
  );
}

function ApplicationsPanel() {
  const [apps, setApps] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');

  useEffect(() => {
    refresh();
  }, []);

  function refresh() {
    setLoading(true);
    setError('');
    api
      .applications()
      .then((list) => {
        setApps(list);
        setSelected((cur) => (cur ? list.find((a) => a.id === cur.id) || null : null));
      })
      .catch((e) => setError(e.message || 'Müraciətləri yükləmək mümkün olmadı'))
      .finally(() => setLoading(false));
  }

  async function changeStatus(id, status) {
    try {
      await api.updateStatus(id, status, `Status operator tərəfindən "${STAGE_LABEL[status]}" olaraq dəyişdirildi`);
      refresh();
    } catch (e) {
      alert(e.message || 'Status dəyişdirilə bilmədi');
    }
  }

  async function syncEktis(id) {
    try {
      const res = await api.ektisSync(id);
      alert(`EKTİS sinxronizasiyası uğurlu: ${res.ektisReference}`);
    } catch (e) {
      alert(e.message || 'EKTİS sinxronizasiyası alınmadı');
    }
  }

  const safe = (s) => (s || '').toLowerCase();
  const filtered = apps.filter(
    (a) =>
      !filter ||
      safe(a.trackingCode).includes(safe(filter)) ||
      safe(a.applicantName).includes(safe(filter)) ||
      safe(a.districtName).includes(safe(filter))
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 p-3">
          <input
            className="input max-w-xs"
            placeholder="Kod, ad və ya rayon üzrə axtar"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <button className="btn-ghost" onClick={refresh}>Yenilə</button>
        </div>
        {error ? (
          <div className="p-8 text-center text-sm text-flag-red">
            {error}
            <button className="btn-ghost mt-3 block mx-auto" onClick={refresh}>Yenidən cəhd et</button>
          </div>
        ) : loading ? (
          <div className="p-8 text-center text-sm text-slate-400">Yüklənir…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">Müraciət yoxdur. Wizard vasitəsilə yaradın.</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Kod</th>
                <th className="px-3 py-2">Müraciət edən</th>
                <th className="px-3 py-2">Rayon</th>
                <th className="px-3 py-2">Sahə</th>
                <th className="px-3 py-2">Bal</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr
                  key={a.id}
                  onClick={() => setSelected(a)}
                  className={`cursor-pointer border-t border-slate-100 hover:bg-brand-50/40 ${
                    selected?.id === a.id ? 'bg-brand-50/60' : ''
                  }`}
                >
                  <td className="px-3 py-2 font-mono text-xs">{a.trackingCode}</td>
                  <td className="px-3 py-2">
                    <div className="font-semibold">{a.applicantName}</div>
                    <div className="text-[11px] text-slate-400">{a.company}</div>
                  </td>
                  <td className="px-3 py-2">{a.districtName}</td>
                  <td className="px-3 py-2">{a.areaHa} ha</td>
                  <td className="px-3 py-2">
                    <ScoreBadge score={a.score} size="sm" />
                  </td>
                  <td className="px-3 py-2">
                    <span className={`chip ${STATUS_COLORS[a.status] || 'bg-slate-100 text-slate-600'}`}>
                      {a.statusLabel}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div>
        {selected ? (
          <div className="card p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-ink-900">{selected.trackingCode}</span>
                <ScoreBadge score={selected.score} size="sm" />
              </div>
              <Link to={`/track/${selected.trackingCode}`} className="text-xs text-brand-600 hover:underline">
                ictimai səhifə →
              </Link>
            </div>
            <div className="mt-3">
              <StageTracker status={selected.status} timeline={selected.timeline} />
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <Row label="Müraciət edən" value={selected.applicantName} />
              <Row label="Şirkət" value={selected.company || '—'} />
              <Row label="Rayon" value={selected.districtName} />
              <Row label="Təyinat" value={selected.purposeLabel} />
              <Row label="Sahə" value={`${selected.areaHa} ha`} />
              <Row
                label="İnvestisiya"
                value={selected.investmentAmount ? `${Number(selected.investmentAmount).toLocaleString('az-AZ')} ₼` : '—'}
              />
            </dl>

            {((selected.technologies || []).length > 0 ||
              (selected.valueChain || []).length > 0 ||
              IMPACT_METRICS.some((m) => selected[m.key] != null)) && (
              <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                <div className="label">Layihə profili</div>
                {(selected.technologies || []).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {selected.technologies.map((k) => (
                      <span key={k} className="chip bg-brand-50 text-[11px] text-brand-700">
                        {TECH_LABELS[k] || k}
                      </span>
                    ))}
                  </div>
                )}
                {(selected.valueChain || []).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {VALUE_CHAIN_STEPS.filter((v) => selected.valueChain.includes(v.key)).map((v) => (
                      <span key={v.key} className="chip bg-sky-50 text-[11px] text-sky-700">
                        {v.label}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {IMPACT_METRICS.filter((m) => selected[m.key] != null).map((m) => (
                    <div key={m.key} className="rounded-lg bg-white p-2">
                      <div className="text-[10px] uppercase tracking-wide text-slate-400">{m.label}</div>
                      <div className="text-xs font-bold text-ink-900">
                        {Number(selected[m.key]).toLocaleString('az-AZ')}{' '}
                        <span className="text-[10px] font-medium text-slate-400">{m.unit}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
              <div className="label">Əlavə sənədlər ({(selected.files || []).length})</div>
              {(selected.files || []).length === 0 ? (
                <p className="mt-2 text-xs text-slate-400">Sənəd yüklənməyib.</p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {(selected.files || []).map((f) => {
                    const href = f.url || f.path;
                    const name = f.originalName || f.name || f.id;
                    return (
                      <li
                        key={f.id || href}
                        className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-1.5 text-xs text-slate-600"
                      >
                        <Icon name="file" className="h-3.5 w-3.5 shrink-0 text-brand-600" />
                        <a
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 truncate hover:text-brand-700 hover:underline"
                          title={name}
                        >
                          {name}
                        </a>
                        {f.size != null && (
                          <span className="shrink-0 text-[10px] text-slate-400">
                            {(f.size / 1024).toFixed(1)} KB
                          </span>
                        )}
                        <a
                          href={href}
                          download={name}
                          className="shrink-0 text-slate-400 transition hover:text-brand-700"
                          title="Yüklə"
                        >
                          <Icon name="download" className="h-4 w-4" />
                        </a>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="mt-5">
              <div className="label">Statusu dəyiş</div>
              <div className="flex flex-wrap gap-2">
                {(selected.nextActions || []).length === 0 && (
                  <span className="text-xs text-slate-400">Son mərhələ — əlavə əməliyyat yoxdur.</span>
                )}
                {(selected.nextActions || []).map((s) => (
                  <button
                    key={s}
                    className={`btn ${
                      s === 'approved'
                        ? 'bg-brand-600 text-white hover:bg-brand-700'
                        : s === 'rejected'
                        ? 'bg-flag-red text-white hover:bg-red-600'
                        : s === 'documents'
                        ? 'bg-amber-500 text-white hover:bg-amber-600'
                        : 'bg-flag-blue text-white hover:bg-sky-600'
                    }`}
                    onClick={() => changeStatus(selected.id, s)}
                  >
                    {STAGE_LABEL[s]}
                  </button>
                ))}
              </div>
            </div>

            <button className="btn-ghost mt-3 w-full" onClick={() => syncEktis(selected.id)}>
              EKTİS-ə sinxronlaşdır
            </button>

            <div className="mt-4 border-t border-slate-100 pt-3">
              <div className="label">Status tarixçəsi</div>
              <ul className="space-y-2 text-xs">
                {[...selected.timeline].reverse().map((t, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span className="font-medium text-ink-900">{t.label}</span>
                    <span className="text-slate-400">{new Date(t.at).toLocaleString('az-AZ')}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="card grid h-48 place-items-center p-4 text-center text-sm text-slate-400">
            Detallar üçün müraciət seçin
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-sm font-semibold text-ink-900">{value}</div>
    </div>
  );
}

const EMPTY_LAND = { district: 'Fuzuli', purpose: 'pambiq', areaHa: 40, ph: 7, fertility: 75, waterKm: 2, sunDays: 250, status: 'available' };

function LandsPanel({ isAdmin }) {
  const [lands, setLands] = useState([]);
  const [meta, setMeta] = useState({ districts: [], crops: [] });
  const [form, setForm] = useState(EMPTY_LAND);
  const [editingId, setEditingId] = useState(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const load = () =>
    api.lands().then(setLands).catch((e) => setError(e.message || 'Torpaqları yükləmək mümkün olmadı'));

  useEffect(() => {
    load();
    api.meta().then(setMeta).catch(() => {});
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function reset() {
    setForm(EMPTY_LAND);
    setEditingId(null);
    setMsg('');
  }

  function edit(l) {
    setEditingId(l.id);
    setMsg('');
    setForm({
      district: l.district,
      purpose: l.purpose,
      areaHa: l.areaHa,
      ph: l.ph ?? 7,
      fertility: l.fertility ?? 70,
      waterKm: l.waterKm ?? 2,
      sunDays: l.sunDays ?? 250,
      status: l.status || 'available'
    });
  }

  async function save() {
    setError('');
    try {
      if (editingId) {
        await api.updateLand(editingId, form);
        setMsg('Torpaq sahəsi yeniləndi ✓');
      } else {
        await api.addLand(form);
        setMsg('Yeni torpaq sahəsi əlavə edildi ✓');
      }
      reset();
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-flag-red lg:col-span-2">{error}</div>
      )}
      <div className="card overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Kod</th>
              <th className="px-3 py-2">Rayon</th>
              <th className="px-3 py-2">Təyinat</th>
              <th className="px-3 py-2">Sahə</th>
              <th className="px-3 py-2">Status</th>
              {isAdmin && <th className="px-3 py-2 text-right">Əməliyyat</th>}
            </tr>
          </thead>
          <tbody>
            {lands.map((l) => (
              <tr key={l.id} className={`border-t border-slate-100 ${editingId === l.id ? 'bg-brand-50/50' : ''}`}>
                <td className="px-3 py-2 font-mono text-xs">{l.code}</td>
                <td className="px-3 py-2">{l.districtName}</td>
                <td className="px-3 py-2">
                  <span className="chip text-white" style={{ backgroundColor: l.color }}>{l.purposeLabel}</span>
                </td>
                <td className="px-3 py-2">{l.areaHa} ha</td>
                <td className="px-3 py-2">
                  <span className={`chip ${STATUS_COLORS[l.status] || 'bg-slate-100 text-slate-600'}`}>{l.status}</span>
                </td>
                {isAdmin && (
                  <td className="px-3 py-2 text-right">
                    <button
                      className="rounded-md bg-sky-50 px-2 py-1 text-[11px] font-semibold text-flag-blue hover:bg-sky-100"
                      onClick={() => edit(l)}
                    >
                      Redaktə
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {lands.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 6 : 5} className="p-8 text-center text-sm text-slate-400">Torpaq sahəsi yoxdur.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isAdmin ? (
      <div className="card p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-ink-900">
            {editingId ? 'Torpaq sahəsini redaktə et' : 'Yeni torpaq sahəsi (admin)'}
          </h3>
          {editingId && (
            <button className="text-xs text-slate-500 hover:text-ink-900" onClick={reset}>Ləğv et</button>
          )}
        </div>
        <div className="mt-3 space-y-3">
          <div>
            <label className="label">Rayon</label>
            <select className="input" value={form.district} onChange={(e) => set('district', e.target.value)}>
              {meta.districts.map((d) => <option key={d.key} value={d.key}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Təyinat</label>
            <select className="input" value={form.purpose} onChange={(e) => set('purpose', e.target.value)}>
              {meta.crops.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Sahə (ha)</label>
              <input type="number" className="input" value={form.areaHa} onChange={(e) => set('areaHa', e.target.value)} />
            </div>
            <div>
              <label className="label">pH</label>
              <input type="number" step="0.1" className="input" value={form.ph} onChange={(e) => set('ph', e.target.value)} />
            </div>
            <div>
              <label className="label">Münbitlik</label>
              <input type="number" className="input" value={form.fertility} onChange={(e) => set('fertility', e.target.value)} />
            </div>
            <div>
              <label className="label">Su (km)</label>
              <input type="number" step="0.1" className="input" value={form.waterKm} onChange={(e) => set('waterKm', e.target.value)} />
            </div>
            <div>
              <label className="label">Günəş (gün)</label>
              <input type="number" className="input" value={form.sunDays} onChange={(e) => set('sunDays', e.target.value)} />
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={(e) => set('status', e.target.value)}>
                <option value="available">Mövcuddur</option>
                <option value="reserved">Rezerv edilib</option>
                <option value="allocated">Ayrılıb</option>
              </select>
            </div>
          </div>
          <button className="btn-primary w-full" onClick={save}>
            {editingId ? 'Yenilə' : 'Əlavə et'}
          </button>
          {msg && <p className="text-xs text-brand-700">{msg}</p>}
        </div>
      </div>
      ) : (
        <div className="card grid place-items-center p-6 text-center text-sm text-slate-400">
          Torpaq sahəsi əlavə etmək/redaktə etmək yalnız admin roluna aiddir.
        </div>
      )}
    </div>
  );
}

function EktisPanel() {
  const [status, setStatus] = useState(null);
  const [statusError, setStatusError] = useState('');
  const [voen, setVoen] = useState('');
  const [verify, setVerify] = useState(null);
  const [checkError, setCheckError] = useState('');
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    api
      .ektisStatus()
      .then(setStatus)
      .catch((e) => setStatusError(e.message || 'İnteqrasiya statusu alınmadı'));
  }, []);

  async function check() {
    if (!voen) return;
    setChecking(true);
    setCheckError('');
    setVerify(null);
    try {
      setVerify(await api.ektisVerify(voen));
    } catch (e) {
      setCheckError(e.message || 'Yoxlama alınmadı');
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="card p-5">
        <h3 className="text-sm font-bold text-ink-900">İnteqrasiya statusu</h3>
        {status ? (
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${status.online ? 'bg-brand-500' : 'bg-flag-red'}`} />
              <span className="font-semibold">{status.online ? 'Onlayn' : 'Oflayn'}</span>
              <span className="text-slate-400">· {status.latencyMs} ms</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {status.services.map((s) => (
                <span key={s} className="chip bg-sky-50 font-mono text-sky-700">{s}</span>
              ))}
            </div>
            <p className="text-xs text-slate-400">Yoxlanılıb: {new Date(status.checkedAt).toLocaleString('az-AZ')}</p>
          </div>
        ) : statusError ? (
          <p className="mt-3 text-sm text-flag-red">{statusError}</p>
        ) : (
          <p className="mt-3 text-sm text-slate-400">Yüklənir…</p>
        )}
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-bold text-ink-900">Fermer statusunun yoxlanması (VÖEN)</h3>
        <div className="mt-3 flex gap-2">
          <input className="input" placeholder="1234567890" value={voen} onChange={(e) => setVoen(e.target.value)} />
          <button className="btn-blue" onClick={check} disabled={checking}>
            {checking ? 'Yoxlanılır…' : 'Yoxla'}
          </button>
        </div>
        {checkError && <p className="mt-3 text-sm text-flag-red">{checkError}</p>}
        {verify && (
          <div className={`mt-3 rounded-lg p-3 text-sm ${verify.verified ? 'bg-brand-50 text-brand-700' : 'bg-red-50 text-flag-red'}`}>
            {verify.verified ? (
              <>
                <div className="font-semibold">✓ {verify.name} — {verify.company}</div>
                <div className="text-xs">{verify.category} · Vergi: {verify.taxStatus}</div>
              </>
            ) : (
              verify.message
            )}
          </div>
        )}
      </div>

      <div className="card p-5 lg:col-span-2">
        <h3 className="text-sm font-bold text-ink-900">EKTİS REST API (mock)</h3>
        <p className="mt-1 text-sm text-slate-500">
          Dövlət mərkəzi sistemləri ilə mübadiləni simulyasiya edən endpoint-lər.
        </p>
        <div className="mt-3 space-y-2 font-mono text-xs">
          <Endpoint method="GET" path="/api/v1/ektis/lands" desc="Kadastr məlumatlarının çəkilməsi" />
          <Endpoint method="POST" path="/api/v1/ektis/applications/sync" desc="Müraciətin sinxronizasiyası" />
          <Endpoint method="GET" path="/api/v1/ektis/farmer/verify/{voen}" desc="Fermer statusunun yoxlanması" />
          <Endpoint method="GET" path="/api/v1/ektis/status" desc="İnteqrasiya statusu" />
        </div>
        <a href="/api-docs" target="_blank" rel="noreferrer" className="btn-blue mt-4">
          Swagger / OpenAPI interfeysini aç
        </a>
      </div>
    </div>
  );
}

function Endpoint({ method, path, desc }) {
  const color = method === 'GET' ? 'bg-sky-50 text-sky-700' : 'bg-brand-50 text-brand-700';
  return (
    <div className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2">
      <span className={`chip ${color}`}>{method}</span>
      <span className="text-ink-900">{path}</span>
      <span className="ml-auto text-[11px] text-slate-400">{desc}</span>
    </div>
  );
}

const STAGE_SHORT = Object.fromEntries(STAGES.map((s) => [s.key, s.short]));

function KanbanBoard() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dragId, setDragId] = useState(null);
  const [overCol, setOverCol] = useState(null);

  useEffect(() => {
    refresh();
  }, []);

  function refresh() {
    setLoading(true);
    setError('');
    api
      .applications()
      .then(setApps)
      .catch((e) => setError(e.message || 'Müraciətləri yükləmək mümkün olmadı'))
      .finally(() => setLoading(false));
  }

  async function move(id, status) {
    const app = apps.find((a) => a.id === id);
    if (!app || app.status === status) return;
    setApps((list) => list.map((a) => (a.id === id ? { ...a, status } : a)));
    try {
      await api.updateStatus(id, status, `Kanban: "${STAGE_LABEL[status]}" mərhələsinə köçürüldü`);
    } catch (e) {
      alert(e.message || 'Mərhələ dəyişdirilə bilmədi');
    } finally {
      refresh();
    }
  }

  const cols = STAGES.map((s) => ({ ...s, items: apps.filter((a) => a.status === s.key) }));

  if (loading) {
    return <div className="card p-8 text-center text-sm text-slate-400">Yüklənir…</div>;
  }

  if (error) {
    return (
      <div className="card p-8 text-center text-sm text-flag-red">
        {error}
        <button className="btn-ghost mt-3 block mx-auto" onClick={refresh}>Yenidən cəhd et</button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm text-slate-500">
          Kartları sürüşdürərək və ya düymələrlə müraciətin mərhələsini dəyişin.
        </p>
        <button className="btn-ghost" onClick={refresh}>Yenilə</button>
      </div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {cols.map((col) => (
          <div
            key={col.key}
            onDragOver={(e) => {
              e.preventDefault();
              setOverCol(col.key);
            }}
            onDragLeave={() => setOverCol((c) => (c === col.key ? null : c))}
            onDrop={() => {
              if (dragId) move(dragId, col.key);
              setDragId(null);
              setOverCol(null);
            }}
            className={`rounded-2xl border p-3 transition ${
              overCol === col.key ? 'border-brand-400 bg-brand-50/60' : 'border-slate-200 bg-slate-50/50'
            }`}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{col.short}</span>
              <span className="chip bg-white text-slate-600">{col.items.length}</span>
            </div>
            <div className="space-y-2">
              {col.items.map((a) => (
                <div
                  key={a.id}
                  draggable
                  onDragStart={() => setDragId(a.id)}
                  onDragEnd={() => setDragId(null)}
                  className={`rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200 ${
                    dragId === a.id ? 'opacity-50' : 'cursor-grab active:cursor-grabbing'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-slate-400">{a.trackingCode}</span>
                    <ScoreBadge score={a.score} size="sm" />
                  </div>
                  <div className="mt-1 text-sm font-semibold text-ink-900">{a.applicantName}</div>
                  <div className="text-[11px] text-slate-500">
                    {a.districtName} · {a.areaHa} ha
                  </div>
                  {(a.nextActions || []).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(a.nextActions || []).map((s) => (
                        <button
                          key={s}
                          onClick={() => move(a.id, s)}
                          className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-brand-100 hover:text-brand-700"
                        >
                          → {STAGE_SHORT[s]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {col.items.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-[11px] text-slate-400">
                  Kart yoxdur
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
