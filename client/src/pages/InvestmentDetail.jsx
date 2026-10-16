import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useSession } from '../session.jsx';

const CROP_LABELS = { uzum: 'Üzümçülük', pambiq: 'Pambıqçılıq', heyvandarliq: 'Heyvandarlıq', istixana: 'İstixana', findiq: 'Fındıqçılıq' };
const MODEL_LABEL = { equity: 'Pay (Equity)', profit_share: 'Mənfəət bölgüsü', fixed_yield: 'Sabit gəlir', co_fund: 'Birgə finansman' };
const RELIEF_LABELS = { Dagliq: 'Dağlıq', 'Dag eteyi': 'Dağ ətəyi', Duzenlik: 'Düzənlik' };

function fmt(n) { return (n != null ? Number(n).toLocaleString('az-AZ') : '—'); }
function reliefLabel(v) { return RELIEF_LABELS[v] || v || 'Düzənlik'; }

export default function InvestmentDetail() {
    const { id } = useParams();
    const { user } = useSession();
    const navigate = useNavigate();
    const [project, setProject] = useState(null);
    const [offers, setOffers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [offerAmount, setOfferAmount] = useState('');
    const [offerTerms, setOfferTerms] = useState('');
    const [offerModel, setOfferModel] = useState('equity');
    const [submitting, setSubmitting] = useState(false);
    const [submitMsg, setSubmitMsg] = useState('');

    async function load() {
        setLoading(true); setError('');
        try {
            const p = await api.investmentProject(id);
            setProject(p);
            setOfferModel(p.model || 'equity');
            try { setOffers(await api.investmentOffers(id) || []); } catch { /* not allowed */ }
        } catch (e) { setError(e.message); }
        finally { setLoading(false); }
    }
    useEffect(() => { load(); }, [id]);

    async function submitOffer(e) {
        e.preventDefault();
        if (!user) { navigate('/login'); return; }
        setSubmitting(true); setSubmitMsg('');
        try {
            await api.submitInvestmentOffer(id, { amount: Number(offerAmount), model: offerModel, terms: offerTerms });
            setSubmitMsg('Təklifiniz uğurla göndərildi! Dövlət nümayəndəsi təklifi panelində görəcək.');
            setOfferAmount(''); setOfferTerms('');
            load();
        } catch (e) { setSubmitMsg(e.message); }
        finally { setSubmitting(false); }
    }

    async function respond(offerId, action) {
        try {
            await api.respondInvestmentOffer(offerId, action);
            load();
        } catch (e) { alert(e.message); }
    }

    if (loading) return <div className="max-w-4xl mx-auto px-4 py-8 text-slate-500">Yüklənir…</div>;
    if (error) return <div className="max-w-4xl mx-auto px-4 py-8 text-red-600">{error}</div>;
    if (!project) return null;

    const canManage = !!user && (user.role === 'admin' || user.role === 'operator');
    const acceptedOffer = offers.find((o) => o.status === 'accepted');

    // Jump to the map and highlight this project's land plot.
    function showOnMap() {
        if (project.landId) navigate(`/map?sel=${encodeURIComponent(project.landId)}`);
        else if (project.landCode) navigate(`/map?q=${encodeURIComponent(project.landCode)}`);
        else navigate('/map');
    }

    function printAgreement() {
        const selected = acceptedOffer || (offers[0] || null);
        const html = '<!doctype html><html lang="az"><head><meta charset="utf-8"/><title>Aqro-Investisiya Raziashmasi</title>'
            + '<style>body{font-family:system-ui,Arial,sans-serif;padding:32px;color:#0f172a}h1{color:#1d4ed8}table{width:100%;border-collapse:collapse;margin:12px 0}td,th{border:1px solid #cbd5e1;padding:8px;font-size:13px}.muted{color:#64748b;font-size:12px}.stamp{margin-top:40px;display:flex;justify-content:space-between}.sig{border-top:1px solid #0f172a;width:40%;padding-top:6px;font-size:12px}</style></head><body>'
            + '<h1>Aqro-Investisiya Raziashmasi (Dovlet torpagi)</h1>'
            + '<p class="muted">Layihe: ' + project.title + ' (' + project.id + ')</p>'
            + '<table><tr><th>Sahe</th><th>Deyer</th></tr>'
            + '<tr><td>Rayon / Teyinat</td><td>' + (project.districtName || project.district || '') + ' / ' + (CROP_LABELS[project.purpose] || project.purposeLabel || '') + '</td></tr>'
            + '<tr><td>Relyef</td><td>' + reliefLabel(project.relief) + '</td></tr>'
            + '<tr><td>Torpaq statusu</td><td>Dovlet torpagi (Torpaq Fondu)</td></tr>'
            + (project.ownerNote ? '<tr><td>Dovlet qeydi</td><td>' + project.ownerNote + '</td></tr>' : '')
            + '<tr><td>Emekdashliq modeli</td><td>' + (MODEL_LABEL[project.model] || project.model) + '</td></tr>'
            + '<tr><td>Pay / menfeet / sabit gelir</td><td>' + (project.equityOffered ?? '') + '% / ' + (project.profitShare ?? '') + '% / ' + (project.fixedYield ?? '') + '%</td></tr>'
            + '<tr><td>Muddet</td><td>' + (project.timelineMonths ?? '') + ' ay</td></tr>'
            + '<tr><td>AI risk skoru</td><td>' + (project.riskScore ?? '') + '/100</td></tr>'
            + '<tr><td>NDVI indeksi</td><td>' + (project.ndviScore ?? '') + ' (' + (project.ndviHealth || '') + ')</td></tr>'
            + '</table>'
            + '<h3>Investor terefi</h3>'
            + (selected
                ? '<table><tr><td>Investor</td><td>' + selected.investorName + ' (' + selected.investorVoen + ')</td></tr>'
                  + '<tr><td>Teklif olunan meblegh</td><td>' + fmt(selected.amount) + ' AZN</td></tr>'
                  + '<tr><td>Status</td><td>' + selected.status + '</td></tr>'
                  + (selected.terms ? '<tr><td>Sertler</td><td>' + selected.terms + '</td></tr>' : '')
                  + '</table>'
                : '<p class="muted">Hele investor teklifi qebul edilmeyib.</p>')
            + '<h3>Merheleler</h3>'
            + '<ul>' + (project.milestones || []).map((m) => '<li>' + (m.done ? 'OK ' : '') + (m.label || m.text || '') + '</li>').join('') + '</ul>'
            + '<div class="stamp"><div class="sig">Dovlet (Torpaq Fondu)</div><div class="sig">Investor' + (selected ? ': ' + selected.investorName : '') + '</div></div>'
            + '<p class="muted" style="margin-top:20px">Bu sened portal terefinden ilkin emekdashliq protokolu kimi yaradilmishdir. Qanuni quvvesi real muqavile ile tesdiqlenir.</p>'
            + '</body></html>';
        const w = window.open('', '_blank', 'width=900,height=700');
        if (!w) return;
        w.document.write(html);
        w.document.close();
        w.focus();
        setTimeout(() => w.print(), 300);
    }

    return (
        <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
            <div className="flex items-center gap-2 text-sm text-slate-500">
                <Link to="/investments" className="hover:text-brand-700">İnvestisiya Bazarı</Link>
                <span>/</span>
                <span className="text-slate-700 truncate">{project.title}</span>
            </div>

            <header className="card p-6">
                <div className="flex flex-col md:flex-row md:justify-between gap-4">
                    <div>
                        <div className="text-xs uppercase tracking-widest text-slate-400">
                            {project.districtName || project.district} · {CROP_LABELS[project.purpose] || project.purposeLabel} · {MODEL_LABEL[project.model]}
                        </div>
                        <h1 className="text-2xl md:text-3xl font-extrabold text-ink-900 mt-1">{project.title}</h1>
                        <p className="text-slate-600 mt-2 max-w-2xl">{project.description || '—'}</p>
                        {project.ownerNote && (
                            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                                <b>Dövlətin xüsusi qeydi:</b> {project.ownerNote}
                            </div>
                        )}
                        <div className="text-xs text-slate-400 mt-2">
                            Sahib: Dövlət (Torpaq Fondu) · Relyef: {reliefLabel(project.relief)} · Sahə: {project.areaHa ? `${project.areaHa} ha` : '—'} · Sahə kodu: {project.landCode || '—'}
                        </div>
                    </div>
                    <div className="text-right space-y-1">
                        <div className="text-[10px] uppercase text-slate-400">Torpaq statusu</div>
                        <div className="text-2xl font-black text-brand-600">Dövlət torpağı</div>
                        <div className="text-xs text-slate-500">Relyef: {reliefLabel(project.relief)}</div>
                    </div>
                </div>

                <div className="grid sm:grid-cols-3 gap-3 mt-5 text-sm">
                    <div className="rounded-lg bg-brand-50 p-3">
                        <div className="text-[10px] text-brand-600">Sahib</div>
                        <div className="font-bold text-brand-800">Dövlət (Torpaq Fondu)</div>
                    </div>
                    <div className="rounded-lg bg-lime-50 p-3">
                        <div className="text-[10px] text-lime-700">Relyef</div>
                        <div className="font-bold text-lime-800">{reliefLabel(project.relief)}</div>
                    </div>
                    <button
                        type="button"
                        onClick={showOnMap}
                        title="Xəritədə göstər"
                        className="rounded-lg bg-slate-50 p-3 text-left transition hover:bg-brand-50 hover:ring-1 hover:ring-brand-200"
                    >
                        <div className="text-[10px] text-slate-400">Sahə kodu · 🗺 göstər</div>
                        <div className="font-bold font-mono text-xs">{project.landCode || '—'}</div>
                    </button>
                </div>

                {(project.equityOffered != null || project.profitShare != null || project.fixedYield != null) && (
                    <div className="mt-4 text-sm text-slate-600 flex flex-wrap gap-3">
                        {project.equityOffered != null && <span>Pay təklifi: <b className="text-brand-700">{project.equityOffered}%</b></span>}
                        {project.profitShare != null && <span>Mənfəət payı: <b>{project.profitShare}%</b></span>}
                        {project.fixedYield != null && <span>Sabit gəlir: <b>{project.fixedYield}%/il</b></span>}
                        {project.timelineMonths && <span>Müddət: <b>{project.timelineMonths} ay</b></span>}
                    </div>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs">
                        AI risk: {project.riskScore ?? '—'}/100
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs">
                        NDVI: {project.ndviScore ?? '—'} ({project.ndviHealth || '—'})
                    </span>
                    <button onClick={showOnMap} className="btn-primary text-xs">
                        🗺 Xəritədə göstər
                    </button>
                    {canManage && (
                        <button onClick={printAgreement} className="btn-ghost text-xs">Raziashma PDF</button>
                    )}
                </div>
            </header>

            <div className="grid md:grid-cols-2 gap-6">
                <section className="card p-5">
                    <h2 className="font-bold text-ink-900 mb-3">Mərhələlər (iş planı)</h2>
                    {(!project.milestones || project.milestones.length === 0) ? (
                        <p className="text-slate-500 text-sm">Mərhələ məlumatı daxil edilməyib.</p>
                    ) : (
                        <ul className="space-y-2">
                            {project.milestones.map((m, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm">
                                    <span className={m.done ? 'text-emerald-500' : 'text-slate-300'}>{m.done ? '✓' : '○'}</span>
                                    <span className={m.done ? 'text-slate-700' : 'text-slate-500'}>{m.label || m.text || JSON.stringify(m)}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                    <div className="mt-4 text-xs text-slate-400 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                        <span>EKTİS təsdiqi</span><span>·</span><span>NDVI peyk məlumatı</span><span>·</span><span>AI investor skoru</span>
                    </div>
                </section>

                {!canManage && user && (
                    <section className="card p-5">
                        <h2 className="font-bold text-ink-900 mb-3">İnvestisiya Təklifi Göndər</h2>
                        <form onSubmit={submitOffer} className="space-y-3">
                            <div>
                                <label className="text-xs text-slate-500 block mb-1">Təklif etdiyim məbləğ (AZN)</label>
                                <input type="number" min="0" value={offerAmount} onChange={(e) => setOfferAmount(e.target.value)}
                                    className="input w-full" placeholder="Məs: 250000" required />
                            </div>
                            <div>
                                <label className="text-xs text-slate-500 block mb-1">Əməkdaşlıq modeli</label>
                                <select value={offerModel} onChange={(e) => setOfferModel(e.target.value)} className="input w-full">
                                    {Object.entries(MODEL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-slate-500 block mb-1">Şərtlər / Qeyd</label>
                                <textarea value={offerTerms} onChange={(e) => setOfferTerms(e.target.value)}
                                    className="input w-full" rows={3} placeholder="Məs: 30% pay, rüblük audit hesabatı, 3 illik müddət..." />
                            </div>
                            <button disabled={submitting} className="btn-primary w-full">{submitting ? 'Göndərilir…' : 'Təklif göndər'}</button>
                            {submitMsg && <div className="text-sm">{submitMsg}</div>}
                        </form>
                    </section>
                )}

                {!user && (
                    <section className="card p-5 text-center">
                        <p className="text-slate-600">Təklif vermək üçün daxil olmalısınız.</p>
                        <Link to="/login" className="btn-primary mt-3 inline-block">Daxil ol</Link>
                    </section>
                )}
            </div>

            {canManage && (
                <section className="card p-5">
                    <h2 className="font-bold text-ink-900 mb-3">Dövlət sahəsinə gələn təkliflər ({offers.length})</h2>
                    {offers.length === 0 ? (
                        <p className="text-slate-500 text-sm">Hələlik təklif yoxdur.</p>
                    ) : (
                        <div className="space-y-3">
                            {offers.map((o) => (
                                <div key={o.id} className="border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                    <div>
                                        <div className="font-semibold">{o.investorName} <span className="text-xs text-slate-400">({o.investorVoen})</span></div>
                                        <div className="text-sm text-slate-600">
                                            {fmt(o.amount)} AZN · {MODEL_LABEL[o.model]} · {o.status}
                                        </div>
                                        {o.terms && <div className="text-xs text-slate-500 mt-1">“{o.terms}”</div>}
                                    </div>
                                    <div className="flex gap-2">
                                        {o.status === 'pending' && (
                                            <>
                                                <button onClick={() => respond(o.id, 'accept')} className="btn-primary">Qəbul et</button>
                                                <button onClick={() => respond(o.id, 'counter')} className="btn-ghost">Əks təklif</button>
                                                <button onClick={() => respond(o.id, 'reject')} className="btn-ghost text-red-600">Rədd et</button>
                                            </>
                                        )}
                                        {o.status !== 'pending' && (
                                            <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">{o.status}</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            )}
        </div>
    );
}
