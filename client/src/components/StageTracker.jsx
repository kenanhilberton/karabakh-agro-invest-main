import { STAGES } from '../constants.js';

export default function StageTracker({ status, timeline = [] }) {
  const activeIndex = STAGES.findIndex((s) => s.key === status);
  const seen = new Set(timeline.map((t) => t.status));

  function reached(key) {
    return seen.has(key) || key === status;
  }

  return (
    <ol className="flex flex-wrap items-center gap-2">
      {STAGES.map((stage, i) => {
        const done = reached(stage.key);
        const isCurrent = activeIndex === i;
        const isRejectedStep = isCurrent && stage.key === 'rejected';

        let bubble = 'bg-slate-200 text-slate-500';
        if (isRejectedStep) bubble = 'bg-flag-red text-white';
        else if (done) bubble = 'bg-brand-600 text-white';
        else if (isCurrent) bubble = 'bg-flag-blue text-white';

        const text = done || isCurrent ? 'text-ink-900' : 'text-slate-400';
        return (
          <li key={stage.key} className="flex items-center gap-2">
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${bubble}`}>
              {i + 1}
            </div>
            <span className={`text-xs font-medium ${text}`}>{stage.label}</span>
            {i < STAGES.length - 1 && (
              <span className={`mx-1 hidden h-0.5 w-8 sm:block ${done ? 'bg-brand-500' : 'bg-slate-200'}`} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
