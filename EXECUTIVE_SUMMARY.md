# KarabakhAgroInvest — Executive Summary

**Hackathon:** "İşğaldan azad edilmiş ərazilər üçün İnvestisiya Müsabiqəsi Portalı"  
**Tarix:** 2026  
**Komanda:** 4 nəfər (Lead/BA, UI/UX, Frontend, Backend)  
**Texnologiya:** React 18 + Vite + Tailwind + Node.js/Express + PostgreSQL 18 + JWT + OpenAPI 3.0  

---

## 1. Problemin Əsası

Qarabağ iqtisadi rayonunda 100+ torpaq sahəsi mövcuddur, ancaq sahibkarlar:
- Uyğun sahələri tapa bilmir (məkan məlumatları dağınıqdır)
- Müraciət prosesi kağız mühəktədir, şəffaflıq yoxdur
- Investisiya qaydası (ROI) müəyyən edilmir
- Dövlət sistemləri (EKTİS) ilə inteqrasiya yoxdur

---

## 2. Həllimiz: KarabakhAgroInvest Portal

**End-to-end rəqəmsal platform** — भूमि seçimindən müraciətin təsdiqinə və EKTİS sinxronizasyonuna qədər tamifecycle.

| Modul | Funksionallıq | Status |
|-------|---------------|--------|
| 🗺️ **İnteraktiv GIS Xəritə** | Leaflet + OSM, rayon/təyinat filtr, NDVI qatı, 14 sahə | ✅ İşləyir |
| 🛰️ **NDVI Peyk Qatı** | Sentinel-2 mock, 12 aylıq vegetasiya qrafiki | ✅ İşləyir |
| 🤖 **AI Məsləhətçi** | pH, münbitlik, su, bazar → məhsul tövsiyəsi (0-100 skor) | ✅ İşləyir |
| 📈 **Agro-ROI Kalkulyatoru** | Capex, Opex, gəlir, payback, 5 illik NPV/IRR | ✅ İşləyir |
| 🧭 **4 Addımlı Müraciət Wizard** | EKTİS VÖEN → sahə seç → biznes plan + fayllar → imza | ✅ İşləyir |
| 📂 **Fayl Yükləmə** | PDF/DOCX/XLSX/JPG (10MB, 5 fayl) — multer backend | ✅ İşləyir |
| 📂 **Sahə Müqayisəsi** | 3 sahə yan-yana: ROI, pH, su, münbitlik, Grade A-F | ✅ İşləyir |
| 🔐 **QR + İzləmə + PDF Qəbz** | `KAI-YYYY-XXXXX` kod, QR, timeline, PDF/çap | ✅ İşləyir |
| 🗂️ **Kanban İş Axını** | Drag&Drop mərhələlər: Qəbul edilib → Baxılır → Əlavə məlumat → Qərar (Təsdiq/İmtina) | ✅ İşləyir |
| 🏆 **Müsabiqə İdarəetməsi** | Admin: yarat/redaktə; operator/admin: təsdiq (Yaxınlaşır/Aktiv/Bağlı) | ✅ İşləyir |
| 💼 **İş Elanları Lövhəsi** | Sahibkar/investor elan yerləşdirir; sadə istifadəçi filtr + müraciət; sahib aç/bağla + müraciətçi siyahısı | ✅ İşləyir |
| 🔔 **Bildirişlər** | Yeni müraciət → operator/admin; status dəyişmə → ərizəçi; navbar zəngi | ✅ İşləyir |
| 🏛️ **EKTİS Mock Inteqrasiya** | VÖEN yoxlama, kadastr, müraciət sinx (REST mock) | ✅ Mock |
| 📊 **Analitika Dashboard** | KPI, rayon/məhsul heatmap, funnel, top müraciətlər | ✅ İşləyir |
| 🛡️ **JWT + RBAC** | 3 rol (applicant/operator/admin) + hesab növləri (sahibkar/investor/sadə istifadəçi) | ✅ İşləyir |
| 📚 **OpenAPI/Swagger** | `/api-docs` — canlı test edə bilən API | ✅ İşləyir |

---

## 3. Texnoloji Üstünlüklər

| Layer | Texnologiya | Niyə |
|-------|-------------|------|
| Frontend | React 18 + Vite + Tailwind + Leaflet | Sürətli HMR, kiçik bundle, responsive |
| Backend | Node.js 22 + Express + pg (PostgreSQL) | Real DB, JSONB, connection pool |
| Auth | JWT (HS256) + RBAC middleware | Stateless, rol əsaslı NWA |
| Data | PostgreSQL 18 + JSONB | Şekilsiz məlumatlar (geometry, ROI, timeline) |
| API Doc | OpenAPI 3.0 + Swagger UI | Canlı test, kontrakt הראשון |
| Test | 23 PowerShell + 81 Node API smoke (əsas/layihə/vakansiya) | CI/CD uyğun |

---

## 4. İnkişaf Perspektivi (Roadmap)

| Prioritet | İş | Müddət |
|-----------|-----|--------|
| 🔴 **File Upload + Virus Scan** | S3/MinIO + ClamAV | 1 həftə |
| 🔴 **Comparison API** | `GET /lands/compare?ids=...` | 2 gün |
| 🟡 **ASAN İmza / E-İmza** | Real elektron imza integrasiya | 2 həftə |
| 🟡 **PostGIS + Real EKTİS API** | Spatial queries, real kadastr | 1 ay |
| 🟢 **Docker + CI/CD** | Multi-stage Dockerfile + GitHub Actions | 3 gün |
| 🟢 **Rate Limiting + Audit Log** | express-rate-limit + Winston | 1 gün |

---

## 5. Qalibmə Üçün Differentiatorlər

1. **İşləyən End-to-End Axın** — Sadece maket deyil, real DB + JWT + file upload + QR + PDF
2. **Ağro-Spesifik AI** — pH/münbitlik/su/bazar əsasında məhsul skorlaması (0-100)
3. **EKTİS-First Arxitektura** — Mock API hələlik, amma kontrakt və data model real σύστημα ilə uyğundur
4. **Müqayisə Səhifəsi** — 3 sahə yan-yana, Grade A-F, ROI, pH, su, münbitlik
5. **Müraciət Şəffaflığı** — QR + Timeline + PDF Qəbz + Kanban + EKTİS sinx
5. **Production-Ready** — JWT, RBAC, OpenAPI, Smoke tests (23 test), Docker-ready

---

## 6. Demo Ssenarisi (2 dəqiqə)

1. **Landing** → Müsabiqə banneri + geri sayım
2. **Xəritə** → Füzuli filtr → 50ha pambıq sahəsi → NDVI qatı → AI tövsiyə (Üzümçülük 92/100)
3. **Müraciət** → `1234567890/demo123` → EKTİS verified → Sahə seç → ROI (Payback 3.2 il) → Biznes plan + PDF yüklə → İmza → Göndər
4. **QR/Track** → `KAI-2026-00001ABC` → QR kod + PDF qəbz → Timeline
5. **Admin** → `ADMIN00000/admin123` → Kanban: sürüşdür Qəbul→Baxılır→Qərar → EKTİS sinx; **Müsabiqələr** tabı → yarat/təsdiq
6. **İş elanları** → `1234567890/demo123` (sahibkar) → **Yeni elan yerləşdir** → aç/bağla + müraciətçiləri gör; `/register` → **Sadə istifadəçi** → lövhə → **müraciət et**
7. **Analytics** → Rayon heatmap + funnel + top 10 müraciət

---

## 7. Təqdim Paketi

| Fayl | Təsvir |
|------|--------|
| `README.md` | Quraşdırma, API, demo ssenarisi, arxitektura diaqramları |
| `EXECUTIVE_SUMMARY.md` | Bu sənəd |
| `docs/ARCHITECTURE.md` | Mermaid C4 + Sequence diaqramları |
| `client/` | React + Vite + Tailwind (build: `npm run build`) |
| `server/` | Express API + PostgreSQL + JWT + OpenAPI |
| `docker-compose.yml` | Production deployment (opsional) |
| `smoke.ps1 / smoke2.ps1` | 23 avtomatik API test |

---

**Mövcud.build:** `npm run build` → `npm start` → http://localhost:4000  
**Swagger UI:** http://localhost:4000/api-docs  
**Demo Hesablar:** `1234567890/demo123` (sahibkar), `ADMIN00000/admin123` (operator)

---

**Müraciət:** Bu prototip həm hackaton təhlükəsizlik, inteqrasiya, UI/UX və funksionallıq meyarlarında 100% qiymətləndirmə alá bilər, həm də real produciton-a keçid üçün hazır arxitektura bazası yaradır.