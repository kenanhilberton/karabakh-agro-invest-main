// Vercel Serverless Function — bütün `/api/**` sorğularını Express tətbiqinə ötürür.
//
// Vercel-in fayl-sistemi marşrutlaşdırmasından (`api/[...path].js`) istifadə edirik:
// beləliklə `/api/health`, `/api/v1/auth/login` və s. birbaşa bu funksiyaya düşür və
// `req.url` həqiqi yolu saxlayır.
//
// QEYD: bu preset-də `[...path]` catch-all yalnız BİR seqment tutur, ona görə
// `vercel.json`-dəki rewrite çoxseqmentli yolları `?__rest=` ilə ötürür və biz
// aşağıda orijinal yolu bərpa edirik.
//
// `/api-docs`, `/api-docs.json` və Swagger-in nisbi (`./swagger-ui-*`) asset-ləri isə
// `vercel.json` rewrite-ları ilə buraya yönləndirilir.
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

// Rewrite ilə gələn `?__rest=v1/lands` hissəsini orijinal yola çevirir.
function restorePath(raw) {
  const qIndex = raw.indexOf('?');
  const rawPath = qIndex === -1 ? raw : raw.slice(0, qIndex);
  const params = new URLSearchParams(qIndex === -1 ? '' : raw.slice(qIndex + 1));

  const rest = params.get('__rest');
  if (!rest) return { path: rawPath, search: params, restored: false };

  params.delete('__rest');
  params.delete('path'); // Vercel-in dinamik marşrut parametri
  return {
    path: rawPath + '/' + decodeURIComponent(rest),
    search: params,
    restored: true
  };
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
  const { path: rawPath, search, restored } = restorePath(raw);
  const qs = search.toString();
  const query = qs ? `?${qs}` : '';

  let p = rawPath;

  if (p === '/api/__docs' || p === '/api/__docs/') {
    p = '/api-docs'; // Swagger səhifəsi (yönləndirməsiz)
  } else if (p.startsWith('/api/__docs/')) {
    p = '/api-docs/' + p.slice('/api/__docs/'.length); // Swagger asset-ləri
  } else if (p === '/api/__docsjson') {
    p = '/api-docs.json'; // OpenAPI spec
  } else if (p.startsWith('/api/__asset/')) {
    p = '/' + p.slice('/api/__asset/'.length); // kökdəki `./swagger-ui-*` faylları
  }

  req.url = p + query;
  return app(req, res);
}
