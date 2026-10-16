import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useSession } from '../session.jsx';

const CROP_LABELS = {
    uzum: 'Üzümçülük', pambiq: 'Pambıqçılıq', heyvandarliq: 'Heyvandarlıq',
    istixana: 'İstixana', findiq: 'Fındıqçılıq'
};
const MODEL_LABEL = {
    equity: 'Pay (Equity) qarşılığında',
    profit_share: 'Mənfəət bölgüsü',
    fixed_yield: 'Sabit gəlirli',
    co_fund: 'Birgə finansman'
};

function fmt(n) { return (n != null ? Number(n).toLocaleString('az-AZ') : '—'); }
const RELIEF_LABELS = { Dagliq: 'Dağlıq', 'Dag eteyi': 'Dağ ətəyi', Duzenlik: 'Düzənlik' };
function reliefLabel(v) { return RELIEF_LABELS[v] || v || 'Düzənlik'; }

export default function Investments() {
    const [projects, setProjects] = useState([]);
    const [meta, setMeta] = useState(null);
    const [loading, setLoading] = useState(true);
    const [district, setDistrict] = useState('');
    const [purpose, setPurpose] = useState('');
    const [minCompletion, setMinCompletion] = useState(0);
    const [tab, setTab] = useState('market');
    const [myOffers, setMyOffers] = useState([]);
    const [error, setError] = useState('');
    const { user } = useSession();
    const navigate = useNavigate();

    async function load() {
        setLoading(true); setError('');
        try {
            const params = {};
            if (district) params.district = district;
            if (purpose) params.purpose = purpose;
            const [p, m] = await Promise.all([api.investmentProjects(params), api.meta()]);
            setProjects(Array.isArray(p) ? p : []);
            setMeta(m || null);
        } catch (e) { setError(e.message); }
        finally { setLoading(false); }
    }
    useEffect(() => { load(); /* eslint-disable-next-line */ }, [district, purpose]);

    useEffect(() => {
        if (user && tab === 'mine') {
            api.myInvestmentOffers().then(setMyOffers).catch(() => setMyOffers([]));
        }
    }, [user, tab]);

    function goMap(p) {
        if (p.landId) navigate(`/map?sel=${encodeURIComponent(p.landId)}`);
        else if (p.landCode) navigate(`/map?q=${encodeURIComponent(p.landCode)}`);
        else navigate('/map');
    }

    const filtered = projects;

    return (
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
            <header className="rounded-2xl bg-gradient-to-br from-brand-600 to-indigo-700 text-white p-8 shadow-md">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                    <div>
                        <div className="text-xs uppercase tracking-widest opacity-80">Qarabağ Aqro-Birgəİnvest</div>
                        <h1 className="text-3xl md:text-4xl font-extrabold mt-2">Dövlət Torpaq Sahələri və İnvestisiya</h1>
                        <p className="mt-2 opacity-90 max-w-2xl">
                            Torpaq sahələri artıq sahibkarlar tərəfindən deyil, dövlət tərəfindən irəli sürülür və
                            relyefinə görə (düzənlik, dağ ətəyi, dağlıq) fərqləndirilir. İnvestorlar həmin dövlət
                            sahələrinə təklif göndərir; NDVI, AI risk və EKTİS təsdiqləri şəffaflığı təmin edir.
                        </p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        {user && (user.role === 'admin' || user.role === 'operator') && (
                            <button onClick={() => navigate('/investments/new')} className="btn-primary bg-white text-brand-700 hover:bg-slate-100">
                                + Dövlət sahəsi irəli sür
                            </button>
                        )}
                        <Link to="/map" className="btn-ghost bg-transparent text-white ring-1 ring-white/40 hover:bg-white/15">Xəritədə bax</Link>
                    </div>
                </div>
            </header>

            {user && (
                <div className="flex gap-2">
                    <button onClick={() => setTab('market')}
                        className={tab === 'market' ? 'btn-primary' : 'btn-ghost'}>Bazar</button>
                    <button onClick={() => setTab('mine')}
                        className={tab === 'mine' ? 'btn-primary' : 'btn-ghost'}>Mənim təkliflərim ({myOffers.length})</button>
                </div>
            )}

            <section className="card p-4 flex flex-wrap gap-3 items-end">
                <div>
                    <label className="text-xs text-slate-500 block mb-1">Rayon</label>
                    <select value={district} onChange={(e) => setDistrict(e.target.value)} className="input">
                        <option value="">Hamısı</option>
                        {(meta?.districts || []).map((d) => <option key={d.key} value={d.key}>{d.name}</option>)}
                        {!meta?.districts && <option value="Fuzuli">Füzuli</option>}
                    </select>
                </div>
                <div>
                    <label className="text-xs text-slate-500 block mb-1">Təyinat</label>
                    <select value={purpose} onChange={(e) => setPurpose(e.target.value)} className="input">
                        <option value="">Hamısı</option>
                        {Object.entries(CROP_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                </div>
                <button onClick={load} className="btn-ghost">Yenilə</button>
            </section>

            {error && <div className="text-red-600 text-sm">{error}</div>}
            {loading && <div className="text-slate-500">Yüklənir…</div>}

            {!loading && filtered.length === 0 && (
                <div className="card p-8 text-center text-slate-500">
                    Uyğun dövlət torpaq layihəsi tapılmadı.
                </div>
            )}

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filtered.map((p) => (
                    <div key={p.id} className="card hover:shadow-lg transition flex flex-col">
                        <Link to={`/investments/${p.id}`} className="block flex-1">
                        <div className="p-5 space-y-3">
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <div className="text-xs text-slate-400">{p.districtName || p.district} · {CROP_LABELS[p.purpose] || p.purposeLabel || p.purpose}</div>
                                    <h3 className="font-bold text-ink-900 leading-tight">{p.title}</h3>
                                </div>
                                <span className="text-[10px] uppercase tracking-wide px-2 py-1 rounded-full bg-brand-50 text-brand-700 border border-brand-200">
                                    {MODEL_LABEL[p.model] || p.model}
                                </span>
                            </div>

                            <div className="flex flex-wrap gap-2 text-[11px]">
                                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                                    🏛 Dövlət torpağı
                                </span>
                                <span className="px-2 py-0.5 rounded-full bg-lime-50 text-lime-700 border border-lime-200">
                                    ⛰ Relyef: {reliefLabel(p.relief)}
                                </span>
                                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    🤖 AI risk: {p.riskScore ?? '—'}/100
                                </span>
                                <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                                    🛰 NDVI: {p.ndviScore ?? '—'} ({p.ndviHealth || '—'})
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <div className="rounded-lg bg-brand-50 p-2">
                                    <div className="text-[10px] text-brand-600">Sahib</div>
                                    <div className="font-bold text-xs text-brand-800">Dövlət (Torpaq Fondu)</div>
                                </div>
                                <div className="rounded-lg bg-slate-50 p-2">
                                    <div className="text-[10px] text-slate-400">Sahə / kod</div>
                                    <div className="font-bold text-xs">
                                        {p.areaHa ? `${p.areaHa} ha` : '—'} · <span className="font-mono">{p.landCode || '—'}</span>
                                    </div>
                                </div>
                            </div>

                            {p.ownerNote && (
                                <div className="text-[11px] rounded bg-amber-50 border border-amber-200 px-2 py-1 text-amber-800 line-clamp-2">
                                    Dövlət qeydi: {p.ownerNote}
                                </div>
                            )}

                            {p.equityOffered != null && (
                                <div className="text-xs text-slate-600">
                                    Təklif olunan pay: <span className="font-semibold text-brand-700">{p.equityOffered}%</span>
                                    {p.profitShare != null && <> · Mənfəət payı: <span className="font-semibold">{p.profitShare}%</span></>}
                                    {p.fixedYield != null && <> · Sabit gəlir: <span className="font-semibold">{p.fixedYield}%</span></>}
                                </div>
                            )}

                            <div className="flex items-center gap-2 text-[11px] text-slate-400 pt-1 border-t border-slate-100">
                                <span>🛰 NDVI yoxlanılıb</span>
                                <span>·</span>
                                <span>✅ EKTİS təsdiqi</span>
                                <span>·</span>
                                <span>🤖 AI skor</span>
                            </div>
                        </div>
                        </Link>
                        <div className="px-5 pb-4">
                            <button
                                onClick={() => goMap(p)}
                                className="btn-ghost text-xs w-full"
                                title="Torpaq sahəsini xəritədə göstər"
                            >
                                🗺 Xəritədə göstər
                            </button>
                        </div>
                    </div>
                ))}
{tab === 'mine' && user && (
    <section className="card p-5">
        <h2 className="font-bold text-ink-900 mb-3">Mənim investisiya təkliflərim</h2>
        {myOffers.length === 0 ? (
            <p className="text-slate-500 text-sm">Hələ təklif göndərməmisiniz.</p>
        ) : (
            <div className="space-y-3">
                {myOffers.map((o) => (
                    <div key={o.id} className="border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div>
                            <div className="font-semibold">{o.projectTitle}</div>
                            <div className="text-sm text-slate-600">
                                {o.amount?.toLocaleString('az-AZ')} AZN · {o.model} · {o.districtName} · {o.status}
                            </div>
                            {o.terms && <div className="text-xs text-slate-500 mt-1">“{o.terms}”</div>}
                        </div>
                        <Link to={`/investments/${o.projectId}`} className="btn-ghost text-xs">Layihəyə bax</Link>
                    </div>
                ))}
            </div>
        )}
    </section>
)}
            </div>
        </div>
    );
}