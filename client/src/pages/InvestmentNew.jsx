import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useSession } from '../session.jsx';

const CROP_LABELS = { uzum: 'Üzümçülük', pambiq: 'Pambıqçılıq', heyvandarliq: 'Heyvandarlıq', istixana: 'İstixana', findiq: 'Fındıqçılıq' };
const MODEL_LABEL = { equity: 'Pay (Equity) qarşılığı', profit_share: 'Mənfəət bölgüsü', fixed_yield: 'Sabit gəlir', co_fund: 'Birgə finansman' };

export default function InvestmentNew() {
    const { user } = useSession();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [meta, setMeta] = useState(null);
    const [form, setForm] = useState({
        landId: '', title: '', description: '', district: '', purpose: 'pambiq',
        ownerNote: '', areaHa: '', relief: 'Düzənlik', landCode: '',
        model: 'equity', equityOffered: '', profitShare: '', fixedYield: '',
        timelineMonths: '24', milestones: ''
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        api.meta().then(setMeta).catch(() => {});
        if (!user) navigate('/login');
    }, [user, navigate]);

    useEffect(() => {
        const landId = searchParams.get('landId');
        const district = searchParams.get('district');
        const purpose = searchParams.get('purpose');
        const areaHa = searchParams.get('areaHa');
        const landCode = searchParams.get('landCode');
        const relief = searchParams.get('relief');
        setForm((f) => ({
            ...f,
            landId: landId || f.landId,
            district: district || f.district,
            purpose: purpose || f.purpose,
            areaHa: areaHa || f.areaHa,
            relief: relief || f.relief,
            landCode: landCode || f.landCode,
            title: f.title || (landCode ? `${landCode} dövlət torpaq sahəsi` : f.title),
            description: f.description || (landCode ? `Dövlət torpaq sahəsi: ${landCode}. Relyef: ${relief || 'Düzənlik'}. Həmin sahə üzrə investisiya tələbi.` : f.description)
        }));
    }, [searchParams]);

    function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

    async function submit(e) {
        e.preventDefault();
        setError('');
        if (!form.title.trim()) { setError('Başlıq tələb olunur'); return; }
        const milestones = (form.milestones || '').split('\n').map((l) => l.trim()).filter(Boolean)
            .map((label) => ({ label, done: false }));

        setSubmitting(true);
        try {
            const metaDist = (meta?.districts || []).find((d) => d.key === form.district)?.name;
            const created = await api.createInvestmentProject({
                landId: form.landId || null,
                landCode: form.landCode || null,
                title: form.title.trim(),
                description: form.description.trim(),
                ownerNote: form.ownerNote.trim(),
                district: form.district || null,
                districtName: metaDist || form.district || null,
                purpose: form.purpose || null,
                purposeLabel: CROP_LABELS[form.purpose] || form.purpose,
                relief: form.relief,
                areaHa: form.areaHa ? Number(form.areaHa) : null,
                model: form.model,
                equityOffered: form.equityOffered ? Number(form.equityOffered) : null,
                profitShare: form.profitShare ? Number(form.profitShare) : null,
                fixedYield: form.fixedYield ? Number(form.fixedYield) : null,
                timelineMonths: form.timelineMonths ? Number(form.timelineMonths) : null,
                milestones
            });
            navigate(`/investments/${created.id}`);
        } catch (e) { setError(e.message); }
        finally { setSubmitting(false); }
    }

    if (!user) return null;

    if (user.role !== 'admin' && user.role !== 'operator') {
        return (
            <div className="max-w-3xl mx-auto px-4 py-16 text-center">
                <h1 className="text-2xl font-extrabold text-ink-900">İcazə yoxdur</h1>
                <p className="mt-2 text-slate-500">Torpaq sahələri artıq sahibkarlar tərəfindən deyil, dövlət (operator/admin) tərəfindən irəli sürülür. İnvestorlar göndərilən dövlət sahələrinə təklif verə bilər.</p>
                <Link to="/investments" className="btn-primary mt-4 inline-block">Bazara qayıt</Link>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
            <h1 className="text-2xl font-extrabold text-ink-900">Dövlət torpaq sahəsini irəli sür</h1>
            <p className="text-sm text-slate-500">
                Torpaq sahələri artıq sahibkar tərəfindən deyil, dövlət tərəfindən irəli sürülür. Sahənin relyefi
                (düzənlik, dağ ətəyi, dağlıq) qeyd olunur və xəritədə göstərilir.
            </p>
            <form onSubmit={submit} className="card p-6 space-y-4">
                <div>
                    <label className="text-xs text-slate-500 block mb-1">Layihə başlığı *</label>
                    <input value={form.title} onChange={(e) => set('title', e.target.value)} className="input w-full"
                        placeholder="Məs: Füzulidə 20 ha intensiv badam bağı + damcı suvarma" required />
                </div>
                <div>
                    <label className="text-xs text-slate-500 block mb-1">Təsvir</label>
                    <textarea value={form.description} onChange={(e) => set('description', e.target.value)} className="input w-full" rows={4}
                        placeholder="Dövlət sahəsinin cari vəziyyəti, relyefi, suvarma imkanları və investisiya tələbi…" />
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                        <label className="text-xs text-slate-500 block mb-1">Rayon</label>
                        <select value={form.district} onChange={(e) => set('district', e.target.value)} className="input w-full">
                            <option value="">Seçin</option>
                            {(meta?.districts || []).map((d) => <option key={d.key} value={d.key}>{d.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-slate-500 block mb-1">Təyinat (məhsul)</label>
                        <select value={form.purpose} onChange={(e) => set('purpose', e.target.value)} className="input w-full">
                            {Object.entries(CROP_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                    </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                        <label className="text-xs text-slate-500 block mb-1">Relyef növü</label>
                        <select value={form.relief} onChange={(e) => set('relief', e.target.value)} className="input w-full">
                            <option value="Düzənlik">Düzənlik</option>
                            <option value="Dağ ətəyi">Dağ ətəyi</option>
                            <option value="Dağlıq">Dağlıq</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-slate-500 block mb-1">Sahə (ha) *</label>
                        <input type="number" min="1" value={form.areaHa} onChange={(e) => set('areaHa', e.target.value)} className="input w-full" required />
                    </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                        <label className="text-xs text-slate-500 block mb-1">Dövlət tərəfindən təklif olunan sahə kodu</label>
                        <input value={form.landCode} onChange={(e) => set('landCode', e.target.value)} className="input w-full" placeholder="Məs: FUZ-0500" />
                    </div>
                    <div>
                        <label className="text-xs text-slate-500 block mb-1">Status</label>
                        <input value="Açığdır — dövlət torpağı" disabled className="input w-full bg-slate-50" />
                    </div>
                </div>

                <div>
                    <label className="text-xs text-slate-500 block mb-1">Əməkdaşlıq modeli</label>
                    <select value={form.model} onChange={(e) => set('model', e.target.value)} className="input w-full">
                        {Object.entries(MODEL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                </div>

                <div className="grid sm:grid-cols-3 gap-3">
                    <div>
                        <label className="text-xs text-slate-500 block mb-1">Təklif olunan pay (%)</label>
                        <input type="number" min="0" max="100" value={form.equityOffered} onChange={(e) => set('equityOffered', e.target.value)} className="input w-full" />
                    </div>
                    <div>
                        <label className="text-xs text-slate-500 block mb-1">Mənfəət payı (%)</label>
                        <input type="number" min="0" max="100" value={form.profitShare} onChange={(e) => set('profitShare', e.target.value)} className="input w-full" />
                    </div>
                    <div>
                        <label className="text-xs text-slate-500 block mb-1">Sabit gəlir (%/il)</label>
                        <input type="number" min="0" max="100" value={form.fixedYield} onChange={(e) => set('fixedYield', e.target.value)} className="input w-full" />
                    </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                        <label className="text-xs text-slate-500 block mb-1">Müddət (ay)</label>
                        <input type="number" min="1" value={form.timelineMonths} onChange={(e) => set('timelineMonths', e.target.value)} className="input w-full" />
                    </div>
                    <div className="text-xs text-slate-400 self-end pb-2">
                        Mərhələlər plan kimi əlavə olunur
                    </div>
                </div>

                <div>
                    <label className="text-xs text-slate-500 block mb-1">
                        Mərhələlər (iş planı — hər sətirdə bir mərhələ)
                    </label>
                    <textarea value={form.milestones} onChange={(e) => set('milestones', e.target.value)} className="input w-full" rows={5}
                        placeholder={"Torpaq icarəsi və EKTİS qeydiyyatı\nQuyu qazılması və elektrik xətti\nDamcı suvarma sistemi\nSertifikatlı tinglər və əkin\nMəhsul yığımı və soyuducu anbar"} />
                </div>

                <div>
                    <label className="text-xs text-slate-500 block mb-1">Fərdi qeydlər və əlavə şərtlər</label>
                    <textarea value={form.ownerNote} onChange={(e) => set('ownerNote', e.target.value)}
                        className="input w-full" rows={3} placeholder="Məs: yalnız Cəbrayıl rayonu üstünlük; investor rüblük audit hesabatı verməlidir..." />
                </div>

                {error && <div className="text-red-600 text-sm">{error}</div>}

                <div className="flex gap-2">
                    <button disabled={submitting} className="btn-primary">{submitting ? 'Yaradılır…' : 'Layihəni dərc et'}</button>
                    <Link to="/investments" className="btn-ghost">Ləğv et</Link>
                </div>
            </form>
        </div>
    );
}
