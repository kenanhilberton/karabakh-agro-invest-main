import { Router } from 'express';
import {
  listLands,
  listApplications,
  activeCompetition,
  APPLICATION_STAGES,
  PROJECT_TECHNOLOGIES,
  VALUE_CHAIN_STEPS
} from '../data/store.js';

const router = Router();

router.get('/overview', async (_req, res) => {
  try {
    const lands = await listLands();
    const apps = await listApplications();

    const byDistrictMap = {};
    for (const l of lands) {
      const d = (byDistrictMap[l.district] ||= {
        district: l.district,
        districtName: l.districtName,
        ha: 0,
        plots: 0,
        applications: 0,
        investment: 0
      });
      d.ha += l.areaHa;
      d.plots += 1;
    }
    const byPurposeMap = {};
    for (const l of lands) {
      const p = (byPurposeMap[l.purpose] ||= {
        purpose: l.purpose,
        label: l.purposeLabel,
        color: l.color,
        ha: 0,
        plots: 0
      });
      p.ha += l.areaHa;
      p.plots += 1;
    }
    for (const a of apps) {
      const d = byDistrictMap[a.district];
      if (d) {
        d.applications += 1;
        d.investment += a.investmentAmount || 0;
      }
    }

    const funnel = APPLICATION_STAGES.map((s) => ({
      key: s.key,
      label: s.label,
      value: apps.filter((a) => a.status === s.key).length
    }));

    const totalInvestment = apps.reduce((s, a) => s + (a.investmentAmount || 0), 0);
    const approved = apps.filter((a) => a.status === 'approved');
    const rejected = apps.filter((a) => a.status === 'rejected');

    // Project impact aggregates (declared by applicants)
    const arableAreaHa = apps.reduce((s, a) => s + (a.arableAreaHa || 0), 0);
    const permanentJobs = apps.reduce((s, a) => s + (a.permanentJobs || 0), 0);
    const seasonalJobs = apps.reduce((s, a) => s + (a.seasonalJobs || 0), 0);
    const annualOutputTons = apps.reduce((s, a) => s + (a.annualOutputTons || 0), 0);

    const byTechnology = PROJECT_TECHNOLOGIES.map((t) => ({
      key: t.key,
      label: t.label,
      count: apps.filter((a) => (a.technologies || []).includes(t.key)).length
    }));
    const byValueChain = VALUE_CHAIN_STEPS.map((v) => ({
      key: v.key,
      label: v.label,
      count: apps.filter((a) => (a.valueChain || []).includes(v.key)).length
    }));
    const paybacks = apps.map((a) => a.roi?.paybackYears).filter((x) => x);
    const avgPayback = paybacks.length ? Number((paybacks.reduce((s, x) => s + x, 0) / paybacks.length).toFixed(1)) : null;

    const topApplications = [...apps]
      .sort((a, b) => (b.score?.total || 0) - (a.score?.total || 0))
      .slice(0, 5)
      .map((a) => ({
        trackingCode: a.trackingCode,
        applicantName: a.applicantName,
        company: a.company,
        districtName: a.districtName,
        investmentAmount: a.investmentAmount,
        score: a.score?.total || null,
        grade: a.score?.grade || null
      }));

    const comp = await activeCompetition();

    res.json({
      generatedAt: new Date().toISOString(),
      kpi: {
        totalPlots: lands.length,
        totalHa: Math.round(lands.reduce((s, l) => s + l.areaHa, 0)),
        availableHa: Math.round(lands.filter((l) => l.status === 'available').reduce((s, l) => s + l.areaHa, 0)),
        applications: apps.length,
        approved: approved.length,
        rejected: rejected.length,
        totalInvestment: Math.round(totalInvestment),
        avgPaybackYears: avgPayback,
        arableAreaHa: Math.round(arableAreaHa),
        permanentJobs,
        seasonalJobs,
        totalJobs: permanentJobs + seasonalJobs,
        annualOutputTons: Math.round(annualOutputTons),
        currency: 'AZN'
      },
      competition: comp
        ? { title: comp.title, endDate: comp.endDate, daysLeft: Math.max(0, Math.ceil((new Date(comp.endDate) - Date.now()) / 86400000)) }
        : null,
      byDistrict: Object.values(byDistrictMap).sort((a, b) => b.ha - a.ha),
      byPurpose: Object.values(byPurposeMap).sort((a, b) => b.ha - a.ha),
      byTechnology,
      byValueChain,
      funnel,
      topApplications
    });
  } catch (e) {
    console.error('Analytics error:', e);
    res.status(500).json({ error: 'Analitika məlumatı hazırlana bilmədi' });
  }
});

export default router;
