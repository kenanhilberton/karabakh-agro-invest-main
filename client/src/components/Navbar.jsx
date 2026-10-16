import { useState } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useSession } from '../session.jsx';
import LogoMark from './LogoMark.jsx';
import Icon from './Icon.jsx';
import NotificationBell from './NotificationBell.jsx';

const link = ({ isActive }) =>
  `rounded-lg px-3 py-2 text-sm font-medium transition ${
    isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:text-brand-700'
  }`;

const mobileLink = ({ isActive }) =>
  `block rounded-lg px-3 py-2.5 text-sm font-medium transition ${
    isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-700 hover:bg-slate-50'
  }`;

function Crest() {
  return (
    <div className="flex items-center gap-2">
      <LogoMark className="h-9 w-9" />
      <div className="leading-tight">
        <div className="text-sm font-extrabold tracking-tight text-ink-900">KarabakhAgroInvest</div>
        <div className="text-[10px] font-medium uppercase tracking-widest text-slate-400">
          İnvestisiya Portalı
        </div>
      </div>
    </div>
  );  
}

export default function Navbar() {
  const { user, logout } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const isAdmin = user?.role === 'operator' || user?.role === 'admin';

  const applying =
    location.pathname.startsWith('/apply') ||
    (location.pathname === '/login' && String(location.state?.from || '').startsWith('/apply'));

  const close = () => setOpen(false);

  return (
    <header className="sticky top-0 z-[1000] border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2.5">
        <Link to="/" className="flex items-center" onClick={close}>
          <Crest />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <NavLink to="/competition" className={link}>Müsabiqə</NavLink>
          <NavLink to="/map" className={link}>Xəritə</NavLink>
          <NavLink to="/compare" className={link}>Müqayisə</NavLink>
          <NavLink to="/investments" className={link}>Birgəİnvest</NavLink>
          <NavLink to="/apply" className={({ isActive }) => link({ isActive: isActive || applying })}>Müraciət et</NavLink>
          <NavLink to="/track" className={link}>İzlə</NavLink>
          <NavLink to="/analytics" className={link}>Analitika</NavLink>
          {isAdmin && <NavLink to="/admin" className={link}>Admin Panel</NavLink>}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <NotificationBell />
              <div className="hidden text-right sm:block">
                <div className="text-sm font-semibold text-ink-900">{user.name}</div>
                <div className="text-[11px] uppercase tracking-wide text-slate-400">{user.role}</div>
              </div>
              <button
                className="btn-ghost hidden sm:inline-flex"
                onClick={() => {
                  logout();
                  navigate('/');
                }}
              >
                Çıxış
              </button>
            </>
          ) : (
            <>
              <Link to="/register" className="btn-ghost hidden sm:inline-flex">Qeydiyyat</Link>
              <Link to="/login" className="btn-primary hidden sm:inline-flex">Daxil ol</Link>
            </>
          )}

          <button
            className="grid h-10 w-10 place-items-center rounded-lg text-ink-900 hover:bg-slate-100 md:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-label="Menyu"
            aria-expanded={open}
          >
            <Icon name={open ? 'x' : 'menu'} className="h-5 w-5" />
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-slate-200 bg-white px-4 pb-4 pt-2 md:hidden">
          <nav className="flex flex-col gap-1">
            <NavLink to="/competition" className={mobileLink} onClick={close}>Müsabiqə</NavLink>
            <NavLink to="/map" className={mobileLink} onClick={close}>Xəritə</NavLink>
            <NavLink to="/compare" className={mobileLink} onClick={close}>Müqayisə</NavLink>
            <NavLink to="/investments" className={mobileLink} onClick={close}>Birgəİnvest</NavLink>
            <NavLink to="/apply" className={({ isActive }) => mobileLink({ isActive: isActive || applying })} onClick={close}>Müraciət et</NavLink>
            <NavLink to="/track" className={mobileLink} onClick={close}>İzlə</NavLink>
            <NavLink to="/analytics" className={mobileLink} onClick={close}>Analitika</NavLink>
            {isAdmin && <NavLink to="/admin" className={mobileLink} onClick={close}>Admin Panel</NavLink>}
          </nav>

          <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
            {user ? (
              <>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-ink-900">{user.name}</div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">{user.role}</div>
                </div>
                <NotificationBell />
                <button
                  className="btn-ghost"
                  onClick={() => {
                    logout();
                    close();
                    navigate('/');
                  }}
                >
                  Çıxış
                </button>
              </>
            ) : (
              <>
                <Link to="/register" className="btn-ghost flex-1 text-center" onClick={close}>Qeydiyyat</Link>
                <Link to="/login" className="btn-primary flex-1 text-center" onClick={close}>Daxil ol</Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
