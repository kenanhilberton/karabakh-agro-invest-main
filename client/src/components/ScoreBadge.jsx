export default function ScoreBadge({ score, size = 'md' }) {
  if (score == null) return null;
  const total = score.total ?? score;
  const grade = score.grade;
  let color = 'bg-slate-100 text-slate-600';
  if (total >= 80) color = 'bg-brand-100 text-brand-700';
  else if (total >= 65) color = 'bg-sky-100 text-sky-700';
  else if (total >= 50) color = 'bg-amber-100 text-amber-700';
  else color = 'bg-red-100 text-flag-red';
  const pad = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`chip font-bold ${color} ${pad}`}>
        {total}
        {grade ? ` · ${grade}` : ''}
      </span>
    </span>
  );
}
