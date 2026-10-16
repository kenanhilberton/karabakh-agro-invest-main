import { useEffect, useState } from 'react';
import { api } from '../api.js';

const STACK = [
  ['Frontend', 'React 18 · Vite · Tailwind CSS · Leaflet'],
  ['Backend', 'Node.js · Express · REST (JWT)'],
  ['Verilənlər', 'GeoJSON torpaq sahələri · JSONB-ready model'],
  ['Xəritə', 'Leaflet · OpenStreetMap tiles'],
  ['API sənədləşdirmə', 'OpenAPI 3.0 · Swagger UI (/api-docs)'],
  ['Təhlükəsizlik', 'JWT Bearer · RBAC (3 rol) · CORS']
];

const ROLES = [
  { role: 'Sahibkar / İnvestor', color: 'bg-brand-50 text-brand-700', can: 'Xəritə, ROI, müraciət göndərmə, öz müraciətlərini izləmə' },
  { role: 'Nazirlik Operatoru', color: 'bg-sky-50 text-sky-700', can: 'Bütün müraciətləri görmə, status dəyişmə, EKTİS sinxronizasiyası' },
  { role: 'Sistem Administratoru', color: 'bg-amber-50 text-amber-700', can: 'Torpaq/müsabiqə əlavə etmə, tam idarəetmə' }
];

const ENDPOINTS = [
  { m: 'POST', p: '/api/v1/auth/login', d: 'VÖEN/FİN ilə giriş → JWT' },
  { m: 'GET', p: '/api/v1/lands', d: 'Torpaq sahələri (filtr: rayon/təyinat/status)' },
  { m: 'POST', p: '/api/v1/roi/simulate', d: 'Agro-ROI hesablanması' },
  { m: 'POST', p: '/api/v1/applications', d: 'Yeni müraciət → tracking kod + QR' },
  { m: 'GET', p: '/api/v1/applications/track/{code}', d: 'İctimai izləmə' },
  { m: 'PATCH', p: '/api/v1/applications/{id}/status', d: 'Status dəyişmə (operator/admin)' },
  { m: 'GET', p: '/api/v1/ektis/lands', d: 'EKTİS kadastr məlumatı' },
  { m: 'GET', p: '/api/v1/ektis/farmer/verify/{voen}', d: 'EKTİS fermer yoxlaması' },
  { m: 'POST', p: '/api/v1/ektis/applications/sync', d: 'EKTİS sinxronizasiya' }
];

export default function Integration() {
  const [status, setStatus] = useState(null);
  const [sample, setSample] = useState(null);

  useEffect(() => {
    api.ektisStatus().then(setStatus).catch(() => {});
    api.ektisLands().then((r) => setSample(r.items?.[0])).catch(() => {});
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="max-w-3xl">
        <span className="chip bg-flag-blue/10 text-flag-blue">Texniki arxitektura</span>
        <h1 className="mt-3 text-3xl font-black text-ink-900">EKTİS inteqrasiyası və API</h1>
        <p className="mt-2 text-sm text-slate-500">
          Portal dövlət mərkəzi e-sistemləri ilə təhlükəsiz REST API üzərindən məlumat mübadiləsi
          aparır. Aşağıdakı endpoint-lər canlı işləyir və Swagger interfeysi ilə sınaqdan keçirilə bilər.
        </p>
        <a href="/api-docs" target="_blank" rel="noreferrer" className="btn-primary mt-5">
          Swagger UI interfeysini aç
        </a>
      </div>

      <section className="mt-8 grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <h2 className="text-sm font-bold text-ink-900">İnteqrasiya axını</h2>
          <div className="mt-4 flex flex-col items-stretch gap-2 md:flex-row md:items-center">
            <FlowBox title="Sahibkar / Portal" tone="brand" />
            <Arrow />
            <FlowBox title="Backend API (JWT)" tone="blue" />
            <Arrow />
            <FlowBox title="EKTİS mərkəzi sistem" tone="green" />
          </div>
          <p className="mt-4 text-xs leading-relaxed text-slate-500">
            Giriş JWT ilə qorunur. Müraciət yaradıldıqda kadastr məlumatı <code>/ektis/lands</code>,
            fermer statusu <code>/ektis/farmer/verify</code> üzərindən yoxlanılır və qərar
            <code> /ektis/applications/sync</code> ilə mərkəzi sistemə ötürülür.
          </p>
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-bold text-ink-900">Canlı EKTİS statusu</h2>
          {status ? (
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${status.online ? 'animate-pulse bg-brand-500' : 'bg-flag-red'}`} />
                <span className="font-semibold">{status.online ? 'Onlayn' : 'Oflayn'}</span>
                <span className="text-slate-400">· {status.latencyMs} ms</span>
              </div>
              {status.services.map((s) => (
                <div key={s} className="chip block bg-sky-50 font-mono text-sky-700">{s}</div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-400">Yüklənir…</p>
          )}
        </div>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="card p-5">
          <h2 className="text-sm font-bold text-ink-900">Texnoloji stek</h2>
          <dl className="mt-3 space-y-2 text-sm">
            {STACK.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3">
                <dt className="font-semibold text-ink-900">{k}</dt>
                <dd className="text-right text-slate-500">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="card p-5 lg:col-span-2">
          <h2 className="text-sm font-bold text-ink-900">Rol əsaslı giriş nəzarəti (RBAC)</h2>
          <div className="mt-3 space-y-2">
            {ROLES.map((r) => (
              <div key={r.role} className="rounded-lg bg-slate-50 p-3">
                <span className={`chip ${r.color}`}>{r.role}</span>
                <p className="mt-1.5 text-xs text-slate-500">{r.can}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="text-sm font-bold text-ink-900">Əsas REST endpoint-lər</h2>
          <div className="mt-3 space-y-1.5 font-mono text-xs">
            {ENDPOINTS.map((e) => (
              <div key={e.p} className="flex items-center gap-2 rounded-md bg-slate-50 px-2.5 py-1.5">
                <span className={`chip ${e.m === 'GET' ? 'bg-sky-50 text-sky-700' : 'bg-brand-50 text-brand-700'}`}>
                  {e.m}
                </span>
                <span className="text-ink-900">{e.p}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card overflow-hidden p-5">
          <h2 className="text-sm font-bold text-ink-900">EKTİS cavab nümunəsi</h2>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-ink-900 p-4 text-[11px] leading-relaxed text-brand-200">
{sample ? JSON.stringify(sample, null, 2) : '// yüklənir...'}
          </pre>
        </div>
      </section>
    </div>
  );
}

function FlowBox({ title, tone }) {
  const tones = {
    brand: 'bg-brand-50 text-brand-700 ring-brand-100',
    blue: 'bg-sky-50 text-sky-700 ring-sky-100',
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-100'
  };
  return (
    <div className={`flex-1 rounded-lg px-4 py-3 text-center text-sm font-semibold ring-1 ${tones[tone]}`}>
      {title}
    </div>
  );
}

function Arrow() {
  return <div className="hidden text-slate-300 md:block">→</div>;
}
