import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';

const SUGGESTIONS = [
  'Necə müraciət edə bilərəm?',
  'Neçə torpaq sahəsi var?',
  'Üzümçülük üçün nə lazımdır?',
  'Birgəİnvest nədir?',
  'Kəlbəcərdə hansı sahələr var?',
  'EKTİS nədir?'
];

function cleanText(text, role) {
  let t = String(text ?? '');
  if (role === 'assistant') {
    // The model sometimes returns light Markdown; strip the noisiest markers so
    // the bubble stays clean (we render plain text, not Markdown).
    t = t
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/__(.+?)__/g, '$1')
      .replace(/`{1,3}/g, '')
      .replace(/^#{1,6}\s*/gm, '');
  }
  return t;
}

export default function ChatBot() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [msgs, setMsgs] = useState([
    { role: 'assistant', text: 'Salam! 👋 Mən KarabakhAgroInvest AI köməkçisiyəm. Platforma, torpaq sahələri, investisiya və aqronomiya ilə bağlı istənilən sualı verə bilərsiniz.' }
  ]);
  const endRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [open, msgs, loading]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Prior turns give the model conversation context (server keeps the last N).
  const history = useMemo(
    () => msgs.slice(-8).map((m) => ({ role: m.role, text: m.text })),
    [msgs]
  );

  async function sendText(raw) {
    const text = (raw ?? '').trim();
    if (!text || loading) return;
    setMsgs((m) => [...m, { role: 'user', text }]);
    setInput('');
    setLoading(true);
    try {
      const res = await api.chat(text, history);
      setMsgs((m) => [...m, { role: 'assistant', text: res?.reply || 'Cavab alına bilmədi.' }]);
    } catch (err) {
      setMsgs((m) => [
        ...m,
        { role: 'assistant', text: 'Bağlantı xətası: ' + (err?.message || 'şəbəkə problemi') + '. Bir az sonra yenidən cəhd edin.' }
      ]);
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e) {
    e.preventDefault();
    sendText(input);
  }

  const showSuggestions = msgs.length <= 1 && !loading;

  return (
    <div className="fixed bottom-4 right-4 z-[2000]">
      {open && (
        <div className="w-80 sm:w-96 max-w-[92vw] h-[28rem] max-h-[75vh] bg-white border border-slate-200 shadow-2xl rounded-2xl flex flex-col overflow-hidden">
          <div className="bg-brand-600 text-white px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-white/20 text-xs">🤖</span>
              <div className="leading-tight">
                <div className="font-semibold text-sm">KarabakhAgroInvest AI</div>
                <div className="text-[10px] text-white/80">Aqrar köməkçi · onlayn</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Bağla" className="text-white/90 hover:text-white">✕</button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50">
            {msgs.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] whitespace-pre-wrap break-words rounded-xl px-3 py-2 text-sm ${
                  m.role === 'user' ? 'bg-brand-600 text-white ml-auto' : 'bg-white border border-slate-200 text-slate-700'
                }`}
              >
                {cleanText(m.text, m.role)}
              </div>
            ))}
            {showSuggestions && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendText(s)}
                    className="rounded-full border border-brand-200 bg-white px-2.5 py-1 text-xs text-brand-700 hover:bg-brand-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {loading && (
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:120ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:240ms]" />
                <span className="ml-1">yazır…</span>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form onSubmit={onSubmit} className="p-2 border-t border-slate-200 bg-white flex gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              className="input flex-1 text-sm"
              placeholder="Sualınızı yazın…"
            />
            <button disabled={loading || !input.trim()} className="btn-primary text-sm disabled:opacity-60">
              Göndər
            </button>
          </form>
        </div>
      )}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="h-12 px-4 rounded-full bg-brand-600 text-white shadow-lg hover:bg-brand-700 flex items-center gap-2"
        >
          <span>🤖</span> AI Köməkçi
        </button>
      )}
    </div>
  );
}
