import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';

const fmt = (n) => new Intl.NumberFormat('az-AZ', { maximumFractionDigits: 0 }).format(Math.round(n || 0));
const fmt1 = (n) => new Intl.NumberFormat('az-AZ', { maximumFractionDigits: 1 }).format(Number(n) || 0);

let econCache = null;
async function loadEconomics() {
  if (econCache) return econCache;
  econCache = await api.roiCrops();
  return econCache;
}

const DEFAULT_ADV = { yieldTonPerHa: 0, pricePerTon: 0, opexRatio: 35, subsidyPct: 0, horizonYears: 5 };

function computeRoi(crop, areaHa, adv) {
  if (!crop || !adv || !crop.costPerHa) return null;
  const ha = Number(areaHa);
  if (!ha || ha <= 0) return null;

  const opex = Math.max(0, Math.min(0.95, (Number(adv.opexRatio) || 0) / 100));
  const subsidy = Math.max(0, Math.min(90, Number(adv.subsidyPct) || 0));
  const horizon = Math.max(1, Math.min(20, Math.round(Number(adv.horizonYears) || 5)));
  const maturity = Number(crop.maturityYears) > 0 ? Number(crop.maturityYears) : 1;
  const yTon = Number(adv.yieldTonPerHa) > 0 ? Number(adv.yieldTonPerHa) : crop.yieldTonPerHa;
  const yPrice = Number(adv.pricePerTon) > 0 ? Number(adv.pricePerTon) : crop.pricePerTon;

  const capexGross = Math.round(crop.costPerHa * ha);
  const subsidyAmount = Math.round(capexGross * (subsidy / 100));
  const capex = capexGross - subsidyAmount;
  const annualRevenue = Math.round(yTon * yPrice * ha);
  const annualOpex = Math.round(annualRevenue * opex);
  const netProfit = annualRevenue - annualOpex;

  const flows = [];
  const cumulative = [-capex];
  let cum = -capex;
  for (let y = 1; y <= horizon; y += 1) {
    const ramp = Math.min(1, y / maturity);
    const net = Math.round(annualRevenue * ramp - annualOpex * ramp);
    flows.push(net);
    cum += net;
    cumulative.push(cum);
  }

  let paybackYears = null;
  for (let i = 1; i < cumulative.length; i += 1) {
    if (cumulative[i] >= 0) {
      const prev = cumulative[i - 1];
      const curr = cumulative[i];
      const frac = curr === prev ? 0 : -prev / (curr - prev);
      paybackYears = Number((i - 1 + frac).toFixed(1));
      break;
    }
  }
  if (paybackYears == null && netProfit > 0) paybackYears = Number((capex / netProfit).toFixed(1));

  const totalNet = cum + capex;
  const roiHorizon = capex > 0 ? Math.round(((totalNet - capex) / capex) * 100) : null;
  const irr = computeIrr(capex, flows);

  return {
    ha,
    horizon,
    maturity,
    yTon,
    yPrice,
    capexGross,
    subsidyAmount,
    capex,
    annualRevenue,
    annualOpex,
    netProfit,
    paybackYears,
    cumulative,
    roiHorizon,
    irr
  };
}

function npv(rate, capex, flows) {
  let value = -capex;
  for (let i = 0; i < flows.length; i += 1) value += flows[i] / (1 + rate) ** (i + 1);
  return value;
}

function computeIrr(capex, flows) {
  if (!capex || !flows.length) return null;
  let lo = -0.9;
  let hi = 5;
  let fLo = npv(lo, capex, flows);
  const fHi = npv(hi, capex, flows);
  if (fLo * fHi > 0) return null;
  for (let i = 0; i < 80; i += 1) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid, capex, flows);
    if (Math.abs(fMid) < 1) return Number((mid * 100).toFixed(1));
    if (fMid * fLo > 0) {
      lo = mid;
      fLo = fMid;
    } else {
      hi = mid;
    }
  }
  return Number((((lo + hi) / 2) * 100).toFixed(1));
}

export default function ROICalculator({ crops: propCrops = [], purpose, areaHa, maxHa, onPurpose, onArea }) {
  const [econ, setEcon] = useState([]);
  const [adv, setAdv] = useState(DEFAULT_ADV);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    loadEconomics().then(setEcon).catch(() => {});
  }, []);

  const crops = econ.length ? econ : propCrops;
  const crop = useMemo(() => crops.find((c) => c.key === purpose) || null, [crops, purpose]);

  useEffect(() => {
    if (!crop) return;
    setAdv({ ...DEFAULT_ADV, yieldTonPerHa: crop.yieldTonPerHa, pricePerTon: crop.pricePerTon });
  }, [crop]);

  const result = useMemo(() => computeRoi(crop, areaHa, adv), [crop, areaHa, adv]);

  const setA = (k, v) => setAdv((a) => ({ ...a, [k]: v }));
  const areaMax = Math.max(1, Math.round(Number(maxHa) || 500));

  let roiTone = 'text-slate-500';
  if (result && result.roiHorizon > 0) roiTone = 'text-brand-700';
  else if (result && result.roiHorizon < 0) roiTone = 'text-flag-red';

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-brand-50 to-white px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <path d="M3 3v18h18" />
              <path d="m7 14 3-3 2 2 4-5" />
            </svg>
          </span>
          <h3 className="text-sm font-bold text-ink-900">Agro-ROI Kalkulyatoru</h3>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-brand-700">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500" />
          anında
        </span>
      </div>

      <div className="p-4">
        <label className="label">Məhsul / təyinat</label>
        <div className="flex flex-wrap gap-1.5">
          {crops.length === 0 && <span className="text-xs text-slate-400">Yüklənir…</span>}
          {crops.map((c) => {
            const active = c.key === purpose;
            let cls = 'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition';
            if (active) cls += ' border-brand-500 bg-brand-50 text-brand-700';
            else cls += ' border-slate-200 bg-white text-slate-600 hover:border-slate-300';
            return (
              <button key={c.key} type="button" onClick={() => onPurpose && onPurpose(c.key)} className={cls}>
                <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                {c.label}
              </button>
            );
          })}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <div className="flex items-center justify-between">
              <label className="label mb-0">Sahə (hektar)</label>
              <span className="text-xs font-bold text-ink-900">{areaHa || 0} ha</span>
            </div>
            <input
              type="range"
              min="1"
              max={areaMax}
              step="1"
              value={Number(areaHa) || 1}
              onChange={(e) => onArea && onArea(e.target.value)}
              className="mt-2 w-full accent-brand-600"
            />
            <input
              type="number"
              min="0"
              className="input mt-2"
              value={areaHa || ''}
              onChange={(e) => onArea && onArea(e.target.value)}
            />
          </div>

          <div className="rounded-xl bg-slate-50 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Nəticə kreditləşməsi</div>
            <div className={`mt-0.5 text-3xl font-black ${roiTone}`}>
              {result && result.roiHorizon != null ? `${result.roiHorizon}%` : '—'}
            </div>
            <div className="text-[11px] text-slate-500">
              {result ? `${result.horizon} il ərzində ümumi gəlirlilik` : 'məhsul və sahə seçin'}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowAdvanced((s) => !s)}
          className="mt-3 text-xs font-semibold text-brand-700 hover:text-brand-800"
        >
          {showAdvanced ? '− Qabaqcıl parametrləri gizlət' : '+ Qabaqcıl parametrlər (məhsuldarlıq, qiymət, xərc, subsidiya)'}
        </button>

        {showAdvanced && (
          <div className="mt-3 grid gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3 sm:grid-cols-2">
            <label className="block">
              <span className="label mb-1">Məhsuldarlıq (t/ha)</span>
              <input type="number" step="0.1" min="0" className="input" value={adv.yieldTonPerHa} onChange={(e) => setA('yieldTonPerHa', e.target.value)} />
            </label>
            <label className="block">
              <span className="label mb-1">Qiymət (₼/t)</span>
              <input type="number" step="10" min="0" className="input" value={adv.pricePerTon} onChange={(e) => setA('pricePerTon', e.target.value)} />
            </label>
            <label className="block">
              <span className="label mb-1">Əməliyyat xərci: {adv.opexRatio}%</span>
              <input type="range" min="5" max="60" step="1" className="mt-2 w-full accent-brand-600" value={adv.opexRatio} onChange={(e) => setA('opexRatio', e.target.value)} />
            </label>
            <label className="block">
              <span className="label mb-1">Dövlət subsidiyası: {adv.subsidyPct}%</span>
              <input type="range" min="0" max="50" step="1" className="mt-2 w-full accent-brand-600" value={adv.subsidyPct} onChange={(e) => setA('subsidyPct', e.target.value)} />
            </label>
            <label className="block sm:col-span-2">
              <span className="label mb-1">Planlaşdırma müddəti: {adv.horizonYears} il</span>
              <input type="range" min="1" max="10" step="1" className="mt-2 w-full accent-brand-600" value={adv.horizonYears} onChange={(e) => setA('horizonYears', e.target.value)} />
            </label>
          </div>
        )}

        {result && (
          <div className="mt-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Metric label="İlkin investisiya" value={`${fmt(result.capex)} ₼`} tone="blue" sub={result.subsidyAmount > 0 ? `subsidiya −${fmt(result.subsidyAmount)} ₼` : null} />
              <Metric label="İllik gəlir" value={`${fmt(result.annualRevenue)} ₼`} />
              <Metric label="İllik xalis mənfəət" value={`${fmt(result.netProfit)} ₼`} tone="green" />
              <Metric label="Özünü ödəmə" value={result.paybackYears ? `${fmt1(result.paybackYears)} il` : '—'} tone="amber" />
              <Metric label="IRR" value={result.irr != null ? `${result.irr}%` : '—'} tone="violet" />
              <Metric label="Tam məhsuldarlıq" value={`${result.maturity} il`} />
            </div>

            <div className="mt-4 rounded-xl border border-slate-100 p-3">
              <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
                <span className="font-semibold uppercase tracking-wide">Kumulyativ pul axını</span>
                <span>illər üzrə</span>
              </div>
              <CashflowChart cumulative={result.cumulative} />
            </div>

            <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
              {result.maturity > 1 && `${crop?.label} üçün ${result.maturity} il tam məhsuldarlığa çatma müddəti nəzərə alınıb. `}
              {result.paybackYears
                ? `İnvestisiya təqribən ${fmt1(result.paybackYears)} ilə özünü ödəyir və ${result.horizon} ildə ${result.roiHorizon}% gəlir verir.`
                : 'Bu parametrlərlə investisiya planlaşdırılan müddətdə özünü ödəmir — girdiləri yenidən nəzərdən keçirin.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, tone, sub }) {
  let accent = 'bg-slate-50';
  const valueTone = 'text-ink-900';
  if (tone === 'green') accent = 'bg-brand-50';
  else if (tone === 'blue') accent = 'bg-sky-50';
  else if (tone === 'amber') accent = 'bg-amber-50';
  else if (tone === 'violet') accent = 'bg-violet-50';
  return (
    <div className={`rounded-lg ${accent} p-2.5`}>
      <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`text-sm font-bold ${valueTone}`}>{value}</div>
      {sub && <div className="text-[10px] text-brand-600">{sub}</div>}
    </div>
  );
}

function CashflowChart({ cumulative }) {
  const W = 340;
  const H = 132;
  const padL = 6;
  const padR = 6;
  const padT = 16;
  const padB = 20;
  const values = cumulative.slice(1);
  const maxV = Math.max(0, ...cumulative);
  const minV = Math.min(0, ...cumulative);
  const range = maxV - minV || 1;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const barW = plotW / values.length;
  const yOf = (v) => padT + ((maxV - v) / range) * plotH;
  const zeroY = yOf(0);

  let firstPositive = -1;
  values.forEach((v, i) => {
    if (firstPositive < 0 && v >= 0) firstPositive = i;
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Kumulyativ pul axını diaqramı">
      <defs>
        <linearGradient id="roiPos" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
        <linearGradient id="roiNeg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fca5a5" />
          <stop offset="100%" stopColor="#ef3340" />
        </linearGradient>
      </defs>
      <line x1={padL} y1={zeroY} x2={W - padR} y2={zeroY} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3 3" />
      {values.map((v, i) => {
        const x = padL + i * barW + barW * 0.16;
        const w = barW * 0.68;
        const top = v >= 0 ? yOf(v) : zeroY;
        const h = Math.max(1.5, Math.abs(yOf(v) - zeroY));
        const fill = v >= 0 ? 'url(#roiPos)' : 'url(#roiNeg)';
        return (
          <g key={i}>
            <rect x={x} y={top} width={w} height={h} rx="2" fill={fill} />
            <text x={x + w / 2} y={H - 6} textAnchor="middle" fontSize="9" fill="#94a3b8">
              {i + 1}
            </text>
          </g>
        );
      })}
      {firstPositive >= 0 && (
        <text x={W - padR} y={10} textAnchor="end" fontSize="9" fontWeight="700" fill="#059669">
          Qaytarılma: {firstPositive + 1}-ci il
        </text>
      )}
    </svg>
  );
}
