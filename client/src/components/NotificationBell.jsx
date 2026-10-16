import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useSession } from '../session.jsx';
import Icon from './Icon.jsx';

const relTime = (iso) => {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return 'indi';
  if (min < 60) return `${min} dəq əvvəl`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} saat əvvəl`;
  const d = Math.round(h / 24);
  return `${d} gün əvvəl`;
};

export default function NotificationBell() {
  const { user } = useSession();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState([]);
  const boxRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    const load = () =>
      api
        .notifications()
        .then((res) => {
          if (!alive) return;
          setItems(res.items || []);
          setUnread(res.unread || 0);
        })
        .catch(() => {});
    load();
    const timer = setInterval(load, 30000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [user]);

  useEffect(() => {
    function onClick(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  if (!user) return null;

  async function openItem(n) {
    setOpen(false);
    if (!n.read) {
      try {
        await api.markNotificationRead(n.id);
      } catch {
        /* ignore */
      }
      setItems((list) => list.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      setUnread((c) => Math.max(0, c - 1));
    }
    if (n.link) navigate(n.link);
  }

  async function markAll() {
    try {
      await api.markAllNotificationsRead();
    } catch {
      /* ignore */
    }
    setItems((list) => list.map((x) => ({ ...x, read: true })));
    setUnread(0);
  }

  return (
    <div className="relative" ref={boxRef}>
      <button
        className="relative grid h-10 w-10 place-items-center rounded-lg text-ink-900 hover:bg-slate-100"
        onClick={() => setOpen((o) => !o)}
        aria-label="Bildirişlər"
      >
        <Icon name="bell" className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-flag-red px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-[1200] mt-2 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="text-sm font-bold text-ink-900">Bildirişlər</span>
            {unread > 0 && (
              <button className="text-xs font-semibold text-brand-700 hover:underline" onClick={markAll}>
                Hamısını oxu
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-auto">
            {items.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-400">Bildiriş yoxdur.</div>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => openItem(n)}
                  className={`flex w-full gap-3 border-b border-slate-50 px-4 py-3 text-left transition hover:bg-slate-50 ${
                    n.read ? '' : 'bg-brand-50/50'
                  }`}
                >
                  <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                    n.read ? 'bg-slate-100 text-slate-400' : 'bg-brand-600 text-white'
                  }`}>
                    <Icon name={n.type === 'status_changed' ? 'trend' : 'file'} className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink-900">{n.title}</span>
                    {n.body && <span className="block truncate text-xs text-slate-500">{n.body}</span>}
                    <span className="mt-0.5 block text-[10px] text-slate-400">{relTime(n.createdAt)}</span>
                  </span>
                  {!n.read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-flag-red" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
