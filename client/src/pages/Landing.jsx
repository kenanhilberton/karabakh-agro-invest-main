import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, Polygon, useMap } from 'react-leaflet';
import { api } from '../api.js';
import Countdown from '../components/Countdown.jsx';

const STEPS = [
  { n: 1, icon: 'shield', title: 'Profil təsdiqi', text: 'VÖEN/FİN ilə EKTİS üzərindən avtomatik yoxlama.' },
  { n: 2, icon: 'map', title: 'Sahə seçimi', text: 'İnteraktiv xəritədən investisiya üçün torpaq sahəsini seçin.' },
  { n: 3, icon: 'trend', title: 'Biznes plan', text: 'ROI simulyasiyası və təyinat üzrə gəlirliliyin hesablanması.' },
  { n: 4, icon: 'qr', title: 'Təsdiq & QR', text: 'Rəqəmsal imza, unikal izləmə kodu və QR ilə təqdimat.' }
];

const TONES = {
  brand: 'from-brand-500 to-brand-700',
  blue: 'from-sky-500 to-sky-700',
  amber: 'from-amber-500 to-orange-600',
  violet: 'from-violet-500 to-violet-700',
  teal: 'from-teal-500 to-emerald-700',
  slate: 'from-slate-600 to-slate-800'
};

const FEATURES = [
  {
    icon: 'map',
    tone: 'brand',
    title: 'İnteraktiv GIS xəritə',
    text: 'Rayon və təyinat üzrə rəngli zonalar, torpaq pH, münbitlik və su məsafəsi metrikaları.'
  },
  {
    icon: 'trend',
    tone: 'blue',
    title: 'Agro-ROI kalkulyatoru',
    text: 'Sahəni və məhsulu seçin — ilkin investisiya, gəlirlilik və özünüödəmə müddəti anında hesablanır.'
  },
  {
    icon: 'compass',
    tone: 'amber',
    title: '4 addımlı müraciət',
    text: 'Smart wizard vasitəsilə profil təsdiqi, sahə seçimi, biznes-plan və rəqəmsal təsdiq.'
  },
  {
    icon: 'qr',
    tone: 'violet',
    title: 'QR + izləmə kodu',
    text: 'Hər müraciətə unikal kod və QR verilir; status dəyişikliyini şəffaf izləyin.'
  },
  {
    icon: 'building',
    tone: 'teal',
    title: 'EKTİS inteqrasiyası',
    text: 'Kadastr, VÖEN yoxlaması və müraciət sinxronizasiyası REST API üzərindən.'
  },
  {
    icon: 'shield',
    tone: 'slate',
    title: 'JWT + RBAC',
    text: 'Sahibkar, operator və admin rolları üzrə təhlükəsiz giriş nəzarəti.'
  }
];

const TRUST = ['EKTİS', 'OpenAPI 3.0', 'JWT', 'RBAC', 'OpenStreetMap', 'PostgreSQL', 'React 18', 'Node.js'];

const FAQ = [
  {
    q: 'Portal kimlər üçün nəzərdə tutulub?',
    a: 'İşğaldan azad edilmiş ərazilərdə aqrar layihə həyata keçirmək istəyən investorlar, sahibkarlar və təsərrüfat subyektləri üçündür.'
  },
  {
    q: 'Müraciət prosesi neçə addımdan ibarətdir?',
    a: 'Dörd addım: profil təsdiqi, torpaq sahəsinin seçimi, biznes-plan və gəlirlilik hesablaması, son olaraq rəqəmsal imza və QR ilə təsdiq.'
  },
  {
    q: 'Torpaq sahələri necə seçilir?',
    a: 'İnteraktiv xəritədə rayon, təyinat və münbitlik üzrə filtrləyərək sahəni seçirsiniz; hər sahə üzrə pH, su məsafəsi və günəş günləri göstərilir.'
  },
  {
    q: 'Müraciətimi necə izləyə bilərəm?',
    a: 'Hər müraciətə unikal izləmə kodu və QR verilir. "İzlə" bölməsindən kodla statusun bütün mərhələlərini şəffaf şəkildə görə bilərsiniz.'
  },
  {
    q: 'EKTİS inteqrasiyası nə təmin edir?',
    a: 'VÖEN/farmer yoxlaması, kadastr məlumatı və qərar mərhələsində müraciətin mərkəzi sistemə sinxronizasiyası təhlükəsiz REST API üzərindən aparılır.'
  }
];

function useCountUp(target, active, duration = 1100) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) return undefined;
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active, duration]);
  return value;
}

function Num({ value, suffix = '', decimals = 0 }) {
  const active = typeof value === 'number' && Number.isFinite(value);
  const v = useCountUp(active ? value : 0, active);
  if (!active) return <span>—</span>;
  return (
    <span className="tabular-nums">
      {Number(v).toLocaleString('az-AZ', { maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}

function Reveal({ children, delay = 0, className = '' }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const cls = shown ? `reveal reveal-in ${className}` : `reveal ${className}`;
  return (
    <div ref={ref} className={cls} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

function Icon({ name, className = 'h-5 w-5' }) {
  const paths = {
    map: (
      <>
        <path d="M9 3 3 6v15l6-3 6 3 6-3V3l-6 3-6-3Z" />
        <path d="M9 3v15" />
        <path d="M15 6v15" />
      </>
    ),
    trend: (
      <>
        <path d="M3 3v18h18" />
        <path d="m7 14 3-3 2 2 4-5" />
      </>
    ),
    compass: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />
      </>
    ),
    qr: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <path d="M14 14h3v3" />
        <path d="M17 20h4v-2" />
      </>
    ),
    building: (
      <>
        <path d="M3 21h18" />
        <path d="M5 21V8l7-5 7 5v13" />
        <path d="M9 21v-6h6v6" />
      </>
    ),
    shield: (
      <>
        <path d="M12 3 5 6v6c0 4 3 6.5 7 8 4-1.5 7-4 7-8V6l-7-3Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    leaf: (
      <>
        <path d="M11 20A7 7 0 0 1 4 13c0-6 9-10 16-10 0 7-4 16-10 16Z" />
        <path d="M4 20c2-6 6-9 12-11" />
      </>
    ),
    file: (
      <>
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
        <path d="M14 3v5h5" />
        <path d="M9 14h6" />
        <path d="M9 17h4" />
      </>
    ),
    sparkle: (
      <>
        <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
        <path d="m6 6 2 2M16 16l2 2M18 6l-2 2M8 16l-2 2" />
      </>
    ),
    arrow: (
      <>
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
      </>
    ),
    plus: (
      <>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </>
    ),
    check: <path d="m5 13 4 4L19 7" />
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {paths[name] || paths.sparkle}
    </svg>
  );
}

function TrustChip({ children }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon name="check" className="h-3.5 w-3.5 text-brand-400" />
      {children}
    </span>
  );
}

function HeroStat({ value, suffix = '', label }) {
  return (
    <div>
      <div className="text-2xl font-black text-white sm:text-3xl">
        <Num value={value} suffix={suffix} />
      </div>
      <div className="mt-0.5 text-xs uppercase tracking-wide text-slate-400">{label}</div>
    </div>
  );
}

function Stat({ icon, tone = 'brand', value, suffix = '', label }) {
  return (
    <div className="flex items-center gap-3.5">
      <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white shadow-md ${TONES[tone]}`}>
        <Icon name={icon} className="h-6 w-6" />
      </div>
      <div>
        <div className="text-2xl font-black text-ink-900">
          <Num value={value} suffix={suffix} />
        </div>
        <div className="text-xs text-slate-500">{label}</div>
      </div>
    </div>
  );
}

function heroLatLngs(geometry) {
  return (geometry?.coordinates?.[0] || []).map(([lng, lat]) => [lat, lng]);
}

function FitHero({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length) map.fitBounds(positions, { padding: [26, 26] });
  }, [positions, map]);
  return null;
}

function HeroMap({ lands }) {
  const positions = useMemo(() => lands.flatMap((l) => heroLatLngs(l.geometry)), [lands]);
  if (!lands.length) {
    return <div className="grid h-full w-full place-items-center bg-slate-100 text-xs text-slate-400">Xəritə yüklənir…</div>;
  }
  return (
    <MapContainer
      center={[39.7, 46.8]}
      zoom={9}
      className="h-full w-full"
      style={{ height: '100%', width: '100%' }}
      dragging={false}
      zoomControl={false}
      scrollWheelZoom={false}
      doubleClickZoom={false}
      boxZoom={false}
      keyboard={false}
      touchZoom={false}
      attributionControl={false}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <FitHero positions={positions} />
      {lands.map((l) => (
        <Polygon
          key={l.id}
          positions={heroLatLngs(l.geometry)}
          interactive={false}
          pathOptions={{ color: l.color, fillColor: l.color, fillOpacity: 0.5, weight: 1.5 }}
        />
      ))}
    </MapContainer>
  );
}

function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <div className="mx-auto mt-10 max-w-3xl divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
      {FAQ.map((f, i) => (
        <div key={f.q}>
          <button
            type="button"
            onClick={() => setOpen(open === i ? -1 : i)}
            className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-slate-50"
          >
            <span className="text-sm font-semibold text-ink-900">{f.q}</span>
            <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500 transition-transform ${open === i ? 'rotate-45' : ''}`}>
              <Icon name="plus" className="h-3.5 w-3.5" />
            </span>
          </button>
          {open === i && <div className="px-5 pb-5 text-sm leading-relaxed text-slate-500">{f.a}</div>}
        </div>
      ))}
    </div>
  );
}

export default function Landing() {
  const [stats, setStats] = useState(null);
  const [competition, setCompetition] = useState(null);
  const [lands, setLands] = useState([]);

  useEffect(() => {
    api.landStats().then(setStats).catch(() => {});
    api.activeCompetition().then(setCompetition).catch(() => {});
    api.lands().then(setLands).catch(() => {});
  }, []);

  const districts = useMemo(() => {
    if (!stats || !stats.byDistrict) return [];
    return Object.entries(stats.byDistrict)
      .map(([name, ha]) => ({ name, ha: Math.round(ha) }))
      .sort((a, b) => b.ha - a.ha)
      .slice(0, 6);
  }, [stats]);

  const maxDistrictHa = districts.length ? districts[0].ha : 1;
  const fund = competition ? Math.round(competition.totalBudget / 1000000) : null;

  return (
    <div>
      <section className="relative overflow-hidden bg-ink-900 text-white">
        <div className="absolute inset-0 bg-grid opacity-60" />
        <div className="absolute -left-24 top-[-120px] h-[460px] w-[460px] animate-blob rounded-full bg-brand-500/25 blur-3xl" />
        <div
          className="absolute right-[-180px] top-16 h-[520px] w-[520px] animate-blob rounded-full bg-flag-blue/25 blur-3xl"
          style={{ animationDelay: '3s' }}
        />
        <div className="absolute left-1/3 top-1/2 h-[320px] w-[320px] animate-glow rounded-full bg-violet-500/10 blur-3xl" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-4 py-20 lg:grid-cols-[1.02fr_0.98fr] lg:py-28">
          <div className="animate-fade-up">
            <span className="chip bg-white/10 text-brand-200 ring-1 ring-white/15">
              Qarabağ &amp; Şərqi Zəngəzur
            </span>
            <h1 className="mt-5 text-4xl font-black leading-[1.06] tracking-tight sm:text-5xl lg:text-6xl">
              Aqrar innovasiya,
              <br className="hidden sm:block" /> <span className="text-gradient">şəffaf</span> investisiya
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-300">
              İşğaldan azad edilmiş ərazilərdə torpaq seçimindən investisiya müraciətinə qədər bütün
              prosesi bir rəqəmsal platformada birləşdiririk.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/map" className="btn-primary px-6 py-3 text-base">
                Xəritədən torpaq seç
                <Icon name="arrow" className="h-4 w-4" />
              </Link>
              <Link
                to="/track"
                className="btn bg-white/10 px-6 py-3 text-base text-white ring-1 ring-white/20 hover:bg-white/20"
              >
                Müraciətimi izlə
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs text-slate-400">
              <TrustChip>EKTİS inteqrasiyası</TrustChip>
              <TrustChip>JWT · RBAC</TrustChip>
              <TrustChip>OpenAPI / Swagger</TrustChip>
            </div>
            <div className="mt-9 grid max-w-lg grid-cols-3 gap-4 border-t border-white/10 pt-6">
              <HeroStat value={stats ? stats.totalHa : null} suffix=" ha" label="Ümumi sahə" />
              <HeroStat value={stats ? stats.totalPlots : null} label="Torpaq sahəsi" />
              <HeroStat value={stats ? stats.applications : null} label="Müraciət" />
            </div>
          </div>

          <div className="relative animate-fade-up delay-2">
            <div className="glass rounded-2xl p-2 shadow-2xl ring-1 ring-white/15">
              <div className="flex items-center gap-1.5 px-2 py-2">
                <span className="h-2.5 w-2.5 rounded-full bg-flag-red/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-brand-400/80" />
                <span className="ml-3 truncate rounded-md bg-white/5 px-2 py-0.5 text-[11px] text-slate-300">
                  karabakhagroinvest.az / xəritə
                </span>
                <span className="ml-auto inline-flex items-center gap-1.5 pr-1 text-[11px] text-slate-300">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-400" />
                  canlı
                </span>
              </div>
              <div className="relative h-[300px] overflow-hidden rounded-xl lg:h-[356px]">
                <HeroMap lands={lands} />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-ink-900/70 to-transparent" />
                <div className="absolute bottom-3 left-3 rounded-lg bg-ink-900/80 px-3 py-1.5 text-[11px] text-slate-200 backdrop-blur">
                  {stats ? stats.totalPlots : '—'} torpaq sahəsi · canlı məlumat
                </div>
              </div>
            </div>

            <div className="absolute -right-3 top-6 hidden animate-float-slow rounded-2xl bg-ink-900/95 p-3 text-white shadow-2xl ring-1 ring-white/10 sm:block">
              <div className="text-[10px] uppercase tracking-widest text-brand-300">Mükafat fondu</div>
              <div className="text-lg font-black">₼ {fund != null ? `${fund}M` : '25M'}+</div>
            </div>

            <div className="absolute -left-3 bottom-8 hidden animate-float rounded-2xl bg-white p-3 shadow-2xl ring-1 ring-slate-100 sm:block">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand-700">
                  <Icon name="trend" className="h-4 w-4" />
                </span>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-slate-400">Agro-ROI</div>
                  <div className="text-sm font-black text-ink-900">Anında hesablama</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="border-b border-slate-200 bg-white py-6">
        <div className="marquee-mask relative mx-auto max-w-7xl overflow-hidden px-4">
          <div className="flex w-max animate-marquee items-center gap-10">
            {[...TRUST, ...TRUST].map((t, i) => (
              <span key={i} className="whitespace-nowrap text-sm font-extrabold uppercase tracking-widest text-slate-300">
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-8 lg:grid-cols-4">
          <Stat icon="leaf" tone="brand" value={stats ? stats.totalHa : null} suffix=" ha" label="Ümumi torpaq sahəsi" />
          <Stat icon="map" tone="blue" value={stats ? stats.totalPlots : null} label="Torpaq sahəsi" />
          <Stat icon="sparkle" tone="amber" value={stats ? stats.availableHa : null} suffix=" ha" label="Mövcud (boş) sahə" />
          <Stat icon="file" tone="violet" value={stats ? stats.applications : null} label="İnvestisiya müraciəti" />
        </div>
      </section>

      {competition && (
        <section className="mx-auto max-w-7xl px-4 py-16">
          <Reveal>
            <div className="relative overflow-hidden rounded-3xl bg-ink-900 p-8 text-white lg:p-10">
              <div className="absolute inset-0 bg-grid opacity-40" />
              <div className="absolute -right-16 -top-16 h-64 w-64 animate-blob rounded-full bg-brand-500/30 blur-3xl" />
              <div className="absolute -bottom-20 -left-10 h-64 w-64 animate-blob rounded-full bg-flag-blue/20 blur-3xl" style={{ animationDelay: '2s' }} />
              <div className="relative grid gap-8 lg:grid-cols-[1.45fr_1fr] lg:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="chip bg-brand-500/20 text-brand-200 ring-1 ring-brand-400/30">
                      <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-brand-400" />
                      Müsabiqə aktiv
                    </span>
                    <span className="text-xs uppercase tracking-widest text-slate-400">
                      {competition.code} · {competition.daysLeft} gün qaldı
                    </span>
                  </div>
                  <h2 className="mt-4 text-2xl font-black sm:text-3xl">{competition.title}</h2>
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300">{competition.description}</p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <div className="rounded-xl bg-white/5 px-4 py-3 ring-1 ring-white/10">
                      <div className="text-[10px] uppercase tracking-widest text-slate-400">Mükafat fondu</div>
                      <div className="text-lg font-black text-brand-300">
                        {competition.totalBudget.toLocaleString('az-AZ')} {competition.currency}
                      </div>
                    </div>
                    <div className="rounded-xl bg-white/5 px-4 py-3 ring-1 ring-white/10">
                      <div className="text-[10px] uppercase tracking-widest text-slate-400">Müraciətlər</div>
                      <div className="text-lg font-black">{competition.applicationsCount}</div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-4 rounded-2xl bg-white/5 p-6 ring-1 ring-white/10 lg:items-end">
                  <div className="text-[10px] uppercase tracking-widest text-slate-400">Son müraciət tarixi</div>
                  <Countdown endDate={competition.endDate} />
                  <Link to="/competition" className="btn bg-white px-5 py-2.5 text-brand-700 hover:bg-white/90">
                    Şərtlər və mükafatlar →
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
        </section>
      )}

      <section className="mx-auto max-w-7xl px-4 py-16">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="chip bg-brand-50 text-brand-700">Necə işləyir</span>
          <h2 className="mt-3 text-3xl font-black text-ink-900">4 addımda investisiya müraciəti</h2>
          <p className="mt-2 text-sm text-slate-500">
            Qeydiyyatdan rəqəmsal təsdiqə qədər şəffaf və sürətli proses.
          </p>
        </Reveal>
        <div className="relative mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="pointer-events-none absolute left-0 right-0 top-[44px] hidden h-px bg-gradient-to-r from-transparent via-brand-200 to-transparent lg:block" />
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 90} className="relative">
              <div className="group card h-full p-5 text-center transition duration-300 hover:-translate-y-1.5 hover:shadow-xl">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-md transition group-hover:scale-110">
                  <Icon name={s.icon} className="h-6 w-6" />
                </div>
                <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500">
                  Addım {s.n}
                </div>
                <h3 className="mt-3 text-base font-bold text-ink-900">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{s.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16">
          <Reveal className="max-w-2xl">
            <span className="chip bg-flag-blue/10 text-flag-blue">Platforma imkanları</span>
            <h2 className="mt-3 text-3xl font-black text-ink-900">
              Aqrar investisiya üçün tam rəqəmsal alət dəsti
            </h2>
          </Reveal>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 90}>
                <div className="group card relative h-full overflow-hidden p-6 transition duration-300 hover:-translate-y-1.5 hover:shadow-xl">
                  <div className="pointer-events-none absolute -right-10 -top-12 h-28 w-28 rounded-full bg-slate-100/0 blur-2xl transition duration-300 group-hover:bg-brand-200/50" />
                  <div className="relative">
                    <div className={`grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br text-white shadow-md ${TONES[f.tone]}`}>
                      <Icon name={f.icon} className="h-6 w-6" />
                    </div>
                    <h3 className="mt-4 text-lg font-bold text-ink-900">{f.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-500">{f.text}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {districts.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-16">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <Reveal>
              <span className="chip bg-brand-50 text-brand-700">Coğrafiya</span>
              <h2 className="mt-3 text-3xl font-black text-ink-900">Rayonlar üzrə torpaq potensialı</h2>
              <p className="mt-2 text-sm text-slate-500">
                Mövcud torpaq sahələrinin rayonlar üzrə paylanması (hektarla).
              </p>
              <Link to="/map" className="btn-primary mt-5">
                Xəritədə bax
                <Icon name="arrow" className="h-4 w-4" />
              </Link>
            </Reveal>
            <Reveal delay={120}>
              <div className="card p-6">
                <div className="space-y-4">
                  {districts.map((d) => (
                    <div key={d.name}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-ink-900">{d.name}</span>
                        <span className="tabular-nums text-slate-500">{d.ha} ha</span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600"
                          style={{ width: `${Math.round((d.ha / maxDistrictHa) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      )}

      <section className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-16">
          <Reveal className="mx-auto max-w-2xl text-center">
            <span className="chip bg-slate-200 text-slate-600">Sual-cavab</span>
            <h2 className="mt-3 text-3xl font-black text-ink-900">Tez-tez verilən suallar</h2>
          </Reveal>
          <Faq />
        </div>
      </section>

      <section className="relative overflow-hidden bg-ink-900 text-white">
        <div className="absolute inset-0 bg-grid opacity-50" />
        <div className="absolute -right-20 -top-24 h-80 w-80 animate-blob rounded-full bg-brand-500/25 blur-3xl" />
        <div className="absolute -bottom-24 -left-16 h-80 w-80 animate-blob rounded-full bg-flag-blue/20 blur-3xl" style={{ animationDelay: '2.5s' }} />
        <div className="relative mx-auto max-w-4xl px-4 py-20 text-center">
          <h2 className="text-3xl font-black sm:text-4xl">Müraciətinizə 3 dəqiqədə başlayın</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-slate-300">
            Xəritədən sahəni seçin, gəlirliliyi hesablayın və unikal QR kodla müraciətinizi təqdim edin.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/apply" className="btn-primary px-6 py-3 text-base">
              Müraciət et
              <Icon name="arrow" className="h-4 w-4" />
            </Link>
            <Link
              to="/map"
              className="btn bg-white/10 px-6 py-3 text-base text-white ring-1 ring-white/20 hover:bg-white/20"
            >
              Xəritəyə keç
            </Link>
            <Link
              to="/competition"
              className="btn bg-white/10 px-6 py-3 text-base text-white ring-1 ring-white/20 hover:bg-white/20"
            >
              Müsabiqə şərtləri
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
