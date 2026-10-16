import express from 'express';
import { v4 as uuid } from 'uuid';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import * as repo from '../db/repository.js';
import { insertNotification } from '../db/repository.js';
import { findUserById } from '../db/repository.js';

const router = express.Router();

// GET projects (public, filters)
router.get('/projects', async (req, res, next) => {
  try {
    const { district, purpose, status } = req.query;
    const projects = await repo.listInvestmentProjects({ district, purpose, status });
    // augment with completion pct
    const enriched = projects.map((p) => {
      const self = Number(p.selfFunded || 0);
      const total = Number(p.totalBudget || 0);
      const completion = total > 0 ? Math.round((self / total) * 100) : 0;
      const required = p.requiredInvestment ? Number(p.requiredInvestment) : Math.max(0, total - self);
      const remaining = Math.max(0, required - (p.raisedInvestment || 0));
      return { ...p, completionPct: completion, remainingInvestment: remaining };
    });
    res.json(enriched);
  } catch (e) { next(e); }
});

// GET offers submitted by the current investor
router.get('/my-offers', requireAuth, async (req, res, next) => {
  try {
    const offers = await repo.listOffersByInvestor(req.user.sub);
    const enriched = await Promise.all(offers.map(async (o) => {
      const project = await repo.getInvestmentProject(o.projectId);
      return {
        ...o,
        projectTitle: project?.title || '—',
        districtName: project?.districtName || project?.district || '—',
        requiredInvestment: project?.requiredInvestment ?? project?.remainingInvestment ?? null
      };
    }));
    res.json(enriched);
  } catch (e) { next(e); }
});

// GET single project
router.get('/projects/:id', async (req, res, next) => {
  try {
    const p = await repo.getInvestmentProject(req.params.id);
    if (!p) return res.status(404).json({ error: 'Layihə tapılmadı' });
    const self = Number(p.selfFunded || 0);
    const total = Number(p.totalBudget || 0);
    const completion = total > 0 ? Math.round((self / total) * 100) : 0;
    const required = p.requiredInvestment ? Number(p.requiredInvestment) : Math.max(0, total - self);
    const remaining = Math.max(0, required - (p.raisedInvestment || 0));
    res.json({ ...p, completionPct: completion, remainingInvestment: remaining });
  } catch (e) { next(e); }
});

// POST create project (auth: dövlət nümayəndəsi — operator/admin only)
router.post('/projects', requireAuth, async (req, res, next) => {
  try {
    const body = req.body || {};
    if (!body.title) return res.status(400).json({ error: 'Başlıq tələb olunur' });
    const user = await findUserById(req.user.sub);
    if (req.user.role !== 'admin' && req.user.role !== 'operator') {
      return res.status(403).json({ error: 'Yalnız dövlət (operator/admin) tərəfindən torpaq sahəsi irəli sürülə bilər' });
    }
    const ndviSeed = (body.district || '').length + (body.purpose || '').length;
    const ndviScore = Math.min(95, 60 + ((ndviSeed * 7) % 25));
    const ndviHealth = ndviScore >= 78 ? 'Yaxşı' : ndviScore >= 62 ? 'Orta' : 'Zəif';
    const reliefMap = { Kalbajar: 'Dağlıq', Lachin: 'Dağlıq', Shusha: 'Dağ ətəyi', Gubadli: 'Dağ ətəyi' };
    const relief = body.relief || reliefMap[body.district] || 'Düzənlik';
    
    // derive owner info - State owned land
    const project = await repo.insertInvestmentProject({
      id: uuid(),
      ownerId: req.user.sub,
      ownerVoen: '1000000000',
      ownerName: 'Azərbaycan Respublikası (Dövlət Torpaq Fondu)',
      ownerType: 'dovlet',
      landId: body.landId || null,
      landCode: body.landCode || null,
      district: body.district || null,
      districtName: body.districtName || null,
      purpose: body.purpose || null,
      purposeLabel: body.purposeLabel || null,
      title: body.title,
      description: body.description || null,
      totalBudget: 0,
      selfFunded: 0,
      requiredInvestment: 0,
      raisedInvestment: 0,
      areaHa: body.areaHa != null ? Number(body.areaHa) : null,
      equityOffered: body.equityOffered ?? null,
      profitShare: body.profitShare ?? null,
      fixedYield: body.fixedYield ?? null,
      model: body.model || 'co_fund',
      milestones: body.milestones || [],
      timelineMonths: body.timelineMonths ?? null,
      status: 'open',
      riskScore: Math.min(95, 50 + (ndviSeed % 20)),
      ndviScore,
      ndviHealth,
      relief,
      ownerNote: body.ownerNote ?? null
    });
    res.status(201).json(project);
  } catch (e) { next(e); }
});

// PUT update project (owner/admin)
router.put('/projects/:id', requireAuth, async (req, res, next) => {
  try {
    const existing = await repo.getInvestmentProject(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Layihə tapılmadı' });
    if (existing.ownerId !== req.user.sub && req.user.role !== 'admin' && req.user.role !== 'operator') {
      return res.status(403).json({ error: 'Yeniləmək üçün icazəniz yoxdur' });
    }
    const body = req.body || {};
    const updated = await repo.updateInvestmentProject(req.params.id, {
      title: body.title,
      description: body.description,
      totalBudget: body.totalBudget,
      selfFunded: body.selfFunded,
      requiredInvestment: body.requiredInvestment,
      raisedInvestment: body.raisedInvestment,
      equityOffered: body.equityOffered,
      profitShare: body.profitShare,
      fixedYield: body.fixedYield,
      model: body.model,
      milestones: body.milestones,
      status: body.status
    });
    res.json(updated);
  } catch (e) { next(e); }
});

// GET offers for project (project owner or admin only? investor list of own handled separately)
router.get('/projects/:id/offers', requireAuth, async (req, res, next) => {
  try {
    const project = await repo.getInvestmentProject(req.params.id);
    if (!project) return res.status(404).json({ error: 'Layihə tapılmadı' });
    if (project.ownerId !== req.user.sub && req.user.role !== 'admin' && req.user.role !== 'operator') {
      return res.status(403).json({ error: 'Təklifləri görmək üçün icazəniz yoxdur' });
    }
    const offers = await repo.listOffersByProject(req.params.id);
    res.json(offers);
  } catch (e) { next(e); }
});

// POST submit offer
router.post('/projects/:id/offers', requireAuth, async (req, res, next) => {
  try {
    const project = await repo.getInvestmentProject(req.params.id);
    if (!project) return res.status(404).json({ error: 'Layihə tapılmadı' });
    if (project.ownerId === req.user.sub) {
      return res.status(400).json({ error: 'Öz layihənizə təklif göndərə bilməzsiniz' });
    }
    const body = req.body || {};
    if (!body.amount || Number(body.amount) <= 0) return res.status(400).json({ error: 'Məbləğ müsbət olmalıdır' });
    const user = await findUserById(req.user.sub);
    const offer = await repo.insertOffer({
      id: uuid(),
      projectId: req.params.id,
      investorId: req.user.sub,
      investorVoen: req.user.voen,
      investorName: req.user.name,
      amount: body.amount,
      model: body.model || project.model,
      terms: body.terms || null,
      status: 'pending'
    });
    // notify project owner
    try {
      const owner = await findUserById(project.ownerId);
      // get owner's user id (uuid)
      if (project.ownerId) {
        await insertNotification({
          id: uuid(),
          userId: project.ownerId,
          type: 'investment_offer',
          title: 'Yeni investisiya təklifi',
          body: `${req.user.name} layihəniz üçün ${Number(body.amount).toLocaleString('az-AZ')} AZN təklif etdi`,
          link: `/investments/projects/${project.id}`,
          applicationId: null
        });
      }
    } catch (e) { console.error('notif err', e.message); }
    res.status(201).json(offer);
  } catch (e) { next(e); }
});

// PATCH respond to offer (accept/reject/counter)
router.patch('/offers/:id/:action', requireAuth, async (req, res, next) => {
  try {
    const action = req.params.action;
    const offer = await repo.getOffer(req.params.id);
    if (!offer) return res.status(404).json({ error: 'Təklif tapılmadı' });
    const project = await repo.getInvestmentProject(offer.projectId);
    if (!project) return res.status(404).json({ error: 'Layihə tapılmadı' });
    if (project.ownerId !== req.user.sub && req.user.role !== 'admin' && req.user.role !== 'operator') {
      return res.status(403).json({ error: 'Təkliflə bağlı qərar vermək üçün icazəniz yoxdur' });
    }
    const body = req.body || {};
    let newStatus = offer.status;
    if (action === 'accept') newStatus = 'accepted';
    else if (action === 'reject') newStatus = 'rejected';
    else if (action === 'counter') newStatus = 'countered';
    const updated = await repo.updateOfferStatus(offer.id, newStatus, body.terms);
    // notify investor
    try {
      if (offer.investorId) {
        const verb = action === 'accept' ? 'qəbul edildi' : action === 'reject' ? 'rədd edildi' : 'əks təklif göndərildi';
        await insertNotification({
          id: uuid(),
          userId: offer.investorId,
          type: 'investment_response',
          title: 'Təklifinizə cavab',
          body: `"${project.title}" layihəsi üzrə təklifiniz ${verb}.`,
          link: `/investments/projects/${project.id}`,
          applicationId: null
        });
      }
    } catch (e) { console.error('notif err', e.message); }
    // If accepted, raise raised_investment on project
    if (action === 'accept' || action === 'counter') {
      if (action === 'accept') {
        const newRaised = (Number(project.raisedInvestment || 0) + Number(offer.amount || 0));
        await repo.updateInvestmentProject(project.id, { raisedInvestment: newRaised });
      }
    }
    res.json(updated);
  } catch (e) { next(e); }
});

export default router;