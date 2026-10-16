export default function StatCard({ label, value, sub, tone = 'default', icon }) {
  const tones = {
    default: 'bg-white',
    brand: 'bg-brand-50',
    blue: 'bg-sky-50',
    amber: 'bg-amber-50',
    dark: 'bg-ink-900 text-white'
  };
  const valueTone = tone === 'dark' ? 'text-white' : 'text-ink-900';
  const labelTone = tone === 'dark' ? 'text-slate-300' : 'text-slate-400';
  return (
    <div className={`card p-4 ${tones[tone] || tones.default}`}>
      <div className="flex items-start justify-between">
        <div className={`text-[10px] font-semibold uppercase tracking-wide ${labelTone}`}>{label}</div>
        {icon && <span className="text-lg leading-none">{icon}</span>}
      </div>
      <div className={`mt-1.5 text-2xl font-black tabular-nums ${valueTone}`}>{value}</div>
      {sub && <div className={`mt-0.5 text-[11px] ${labelTone}`}>{sub}</div>}
    </div>
  );
}
