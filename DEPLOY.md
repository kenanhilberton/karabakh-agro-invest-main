# Deployment — Vercel + Neon

Bu sənəd layihəni **Vercel** (frontend + serverless API) və **Neon** (PostgreSQL)
üzərində canlıya çıxarmaq üçün addımları göstərir.

> Layihə artıq buna uyğunlaşdırılıb:
> `vercel.json`, `api/[...path].js`, `DATABASE_URL` dəstəyi, `.vercelignore`.

---

## Arxitektura

```
Brauzer
  │
  ├── /            → Vercel CDN  (client/dist statik fayllar)
  ├── /api/v1/...  → Vercel Function (api/[...path].js)  → Express tətbiqi
  └── /api-docs    → Vercel Function (Swagger UI)
                                   │
                                   └── Neon PostgreSQL (DATABASE_URL, SSL)
```

Frontend və API **eyni domenin** altındadır — `client/src/api.js` nisbi
(`/api/v1`) yol istifadə edir, ona görə CORS problemi yoxdur.

---

## 1. Neon-da verilənlər bazası yarat

1. https://neon.tech → qeydiyyat → **New Project**
2. Region seç (Avropaya ən yaxını: `aws-eu-central-1` — Frankfurt)
3. **Connection string**-i kopyala. Bu belə görünür:

```
postgresql://neondb_owner:XXXX@ep-xxx-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require
```

> `?sslmode=require` hissəsi vacibdir — kod SSL-i avtomatik aktivləşdirir.

**Sxemi əl ilə yaratmaq lazım deyil.** Server ilk açılışda sxemi avtomatik
yaradır və baza boşdursa demo məlumatları (seed) yazır (`server/src/db/init.js`).

---

## 2. GitHub reposu yarat və kodu push et

Repo artıq `C:\Projects\karabakh-agro-invest` qovluğunda hazırdır (git init edilib).

```powershell
cd C:\Projects\karabakh-agro-invest

# GitHub-da boş repo yarat: https://github.com/new
# Adı: karabakh-agro-invest   (README/gitignore ƏLAVƏ ETMƏ)

git add -A
git commit -m "KarabakhAgroInvest: Vercel + Neon deployment"
git push -u origin main
```

> ⚠️ **Diqqət:** əvvəlki qovluq (`Desktop\Project1\karabakh-agro-invest`) sizin
> **ev qovluğunuzun** (`C:\Users\Alisov Kenan`) git reposunun içində idi və o repo
> GitHub-a qoşulub (`BlueGreen-Analytics`). Ona görə kod ayrıca təmiz repoya
> köçürüldü. Köhnə qovluqda `git add -A` **işlətməyin** — ev qovluğunuzdakı hər
> şey (Documents, AppData, `.env`, açarlar) GitHub-a düşə bilər.

---

## 3. Vercel-də import et

1. https://vercel.com → **Add New → Project**
2. GitHub reposunu seç (`karabakh-agro-invest`)
3. **Root Directory**-i dəyişmə (repo kökü qalsın) — `vercel.json` hər şeyi idarə edir
4. **Environment Variables** bölməsində bunları əlavə et:

| Ad | Dəyər | Vacib? |
|---|---|---|
| `DATABASE_URL` | Neon connection string | ✅ mütləq |
| `JWT_SECRET` | ən azı 32 simvolluq təsadüfi sətir | ✅ mütləq |
| `NODE_ENV` | `production` | ✅ |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob store açarı | ✅ sənəd yükləməsi üçün |
| `GROQ_API_KEY` | pulsuz açar (console.groq.com) | ⭐ tövsiyə |

> ❌ **`PG_MODE` TƏYİN ETMƏ!** Əgər `PG_MODE=memory` qoysanız, baza yaddaşda
> olacaq və **hər restartda bütün məlumat silinəcək**.

### Vercel Blob — sənəd yükləmələri

Serverless-də disk qalıcı deyil, ona görə yüklənən sənədlər **Vercel Blob**-da
saxlanılır. Quruluş (pulsuzdur):

1. Vercel layihəsi → **Storage** bölməsi → **Create Blob**
2. **Public** store yarat (ad məs. `kai-docs`) — `BLOB_READ_WRITE_TOKEN` avtomatik
   əməliyyat mühitinə yazılır
3. **Deploy** → yenidən build et

> Bu açar olmadıqda `/api/v1/upload` serverless-də `501` qaytarır. Lokalda
> (`npm run dev`, Docker) fayllar köhnədəki kimi `server/uploads/` qovluğuna yazılır.
>
> Hədlər: fayl başına **4 MB**, müraciət başına 5 fayl.
> İcazəli növlər: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, WEBP.

`JWT_SECRET` yaratmaq üçün:
```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

5. **Deploy** düyməsini bas.

---

## 4. Yoxlama

Deploy bitdikdən sonra:

| Yoxlama | URL |
|---|---|
| API sağlamlığı | `https://<layihə>.vercel.app/api/health` |
| Sayt | `https://<layihə>.vercel.app/` |
| Swagger UI | `https://<layihə>.vercel.app/api-docs` |
| OpenAPI spec | `https://<layihə>.vercel.app/api-docs.json` |

Demo hesablar (baza avtomatik seed olunur):

| Rol | İstifadəçi | Şifrə |
|---|---|---|
| Operator | `ADMIN00000` | `admin123` |
| Admin | `SYSADMIN000` | `root123` |
| Ərizəçi | `1234567890` (və ya MyGov FİN) | `demo123` |

---

## ⚠️ Məhdudiyyətlər (bilinməsi vacibdir)

### 1. Fayl yükləmə serverless-də işləmir
Vercel funksiyalarının diski **qalıcı deyil** və sorğu həddi **4,5 MB**-dır.
Buna görə `/api/v1/upload` serverless rejimdə **501** qaytarır.

Sənəd yükləmə xüsusiyyətini canlıda saxlamaq üçün obyekt anbarı lazımdır:
- **Vercel Blob** (`@vercel/blob`) — Vercel ilə ən asan inteqrasiya
- **Cloudinary** — pulsuz plan
- **AWS S3 / Supabase Storage**

> Lokal işləyəndə (Vercel olmadan) yükləmə normal işləyir — fayllar `uploads/` qovluğuna düşür.

### 2. Soyuq start
Vercel Hobby planında funksiya bir müddət işləməyəndə yuxuya keçir. İlk sorğu
~1–3 saniyə çəkə bilər (Neon-un özü də soyuq starta malikdir).

### 3. AI chatbot limiti
Açar (`GROQ_API_KEY` və s.) təyin olunmasa, pulsuz provayder işləyir, amma
~1 cavab / 30 saniyə limiti var. Təqdimat üçün pulsuz Groq açarı əlavə edin.

### 4. Yaddaş rejimi yalnız lokal üçündür
`PG_MODE=memory` (`pg-mem`) yalnız lokal demo üçündür — hər server restartında
bütün məlumat sıfırlanır. Canlıda **həmişə** Neon istifadə edin.

---

## Lokal inkişaf (dəyişməyib)

```powershell
cd C:\Projects\karabakh-agro-invest
npm run install:all     # ilk dəfə
npm run dev             # API :4000 + client :5173
```

Lokal `.env` faylı: `server/.env` (`PG_MODE=memory` ilə işləyir).
`DATABASE_URL` təyin etsəniz, real Postgres-ə qoşulacaq.
