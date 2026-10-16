// Vercel Serverless Function — bütün `/api/**` sorğularını Express tətbiqinə ötürür.
//
// Vercel-in fayl-sistemi marşrutlaşdırmasından (`api/[...path].js`) istifadə edirik:
// beləliklə `/api/health`, `/api/v1/auth/login` və s. birbaşa bu funksiyaya düşür və
// `req.url` həqiqi yolu saxlayır.
//
// `/api-docs`, `/api-docs.json` və Swagger-in nisbi (`./swagger-ui-*`) asset-ləri isə
// `vercel.json` rewrite-ları ilə buraya yönləndirilir. Həmin rewrite ya orijinal yolu
// saxlayır, ya da yolu dəyişir — aşağıdaki normallaşdırma hər iki halı dəstəkləyir.
import app, { boot } from '../server/src/index.js';

// Bazanın hazırlanması (sxem + seed) hər instansda bir dəfə icra olunur.
let bootPromise = null;
function ensureReady() {
  if (!bootPromise) {
    bootPromise = boot().catch((err) => {
      bootPromise = null; // növbəti sorğuda yenidən cəhd et
      throw err;
    });
  }
  return bootPromise;
}

export default async function handler(req, res) {
  try {
    await ensureReady();
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: `Verilənlər bazasına qoşulmaq alınmadı: ${err.message}` }));
    return;
  }

  const raw = req.url || '/';
  const qs = raw.includes('?') ? raw.slice(raw.indexOf('?')) : '';
  let p = raw.split('?')[0];

  if (p === '/api/__docs' || p === '/api/__docs/') {
    p = '/api-docs'; // Swagger səhifəsi (yönləndirməsiz)
  } else if (p.startsWith('/api/__docs/')) {
    p = '/api-docs/' + p.slice('/api/__docs/'.length); // Swagger asset-ləri
  } else if (p === '/api/__docsjson') {
    p = '/api-docs.json'; // OpenAPI spec
  } else if (p.startsWith('/api/__asset/')) {
    p = '/' + p.slice('/api/__asset/'.length); // kökdəki `./swagger-ui-*` faylları
  }

  req.url = p + qs;
  return app(req, res);
}
