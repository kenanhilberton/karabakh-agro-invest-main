import { CROP_ECONOMICS } from '../data/seed.js';

// Agro-investment simulator.
// Models initial capex (net of subsidy), a maturity ramp for perennials,
// annual revenue/opex, cumulative cash-flow, payback, horizon ROI and IRR.

const DEFAULT_OPEX = 0.35;
const DEFAULT_HORIZON = 5;

function npv(rate, capex, flows) {
  let value = -capex;
  for (let i = 0; i < flows.length; i += 1) {
    value += flows[i] / (1 + rate) ** (i + 1);
  }
  return value;
}

function computeIrr(capex, flows) {
  if (!capex || !flows.length) return null;
  let lo = -0.9;
  let hi = 5;
  let fLo = npv(lo, capex, flows);
  const fHi = npv(hi, capex, flows);
  if (fLo * fHi > 0) return null;
  for (let i = 0; i < 100; i += 1) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid, capex, flows);
    if (Math.abs(fMid) < 1) return mid;
    if (fMid * fLo > 0) {
      lo = mid;
      fLo = fMid;
    } else {
      hi = mid;
    }
  }
  return (lo + hi) / 2;
}

export function simulateRoi(input = {}) {
  const {
    purpose,
    areaHa,
    opexRatio = DEFAULT_OPEX,
    horizonYears = DEFAULT_HORIZON,
    yieldTonPerHa,
    pricePerTon,
    subsidyPct = 0,
    maturityYears
  } = input;

  const eco = CROP_ECONOMICS[purpose];
  const ha = Number(areaHa);
  if (!eco || !ha || ha <= 0) return null;

  const horizon = Math.max(1, Math.min(20, Math.round(Number(horizonYears) || DEFAULT_HORIZON)));
  const opex = Math.max(0, Math.min(0.95, Number(opexRatio)));
  const subsidy = Math.max(0, Math.min(90, Number(subsidyPct) || 0));
  const yTon = Number(yieldTonPerHa) > 0 ? Number(yieldTonPerHa) : eco.yieldTonPerHa;
  const yPrice = Number(pricePerTon) > 0 ? Number(pricePerTon) : eco.pricePerTon;
  const maturity = Number(maturityYears) > 0 ? Number(maturityYears) : eco.maturityYears || 1;

  const capexGross = Math.round(eco.costPerHa * ha);
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
  if (paybackYears == null && netProfit > 0) {
    paybackYears = Number((capex / netProfit).toFixed(1));
  }

  const totalNet = cum + capex;
  const roiHorizon = capex > 0 ? Math.round(((totalNet - capex) / capex) * 100) : null;
  const irr = computeIrr(capex, flows);

  return {
    purpose,
    areaHa: ha,
    maturityYears: maturity,
    horizonYears: horizon,
    opexRatio: opex,
    subsidyPct: subsidy,
    yieldTonPerHa: yTon,
    pricePerTon: yPrice,
    capexGross,
    subsidyAmount,
    capex,
    annualRevenue,
    annualOpex,
    netProfit,
    paybackYears,
    flows,
    cumulative,
    roi5y: roiHorizon,
    roiHorizon,
    irr: irr != null ? Number((irr * 100).toFixed(1)) : null,
    currency: 'AZN'
  };
}
