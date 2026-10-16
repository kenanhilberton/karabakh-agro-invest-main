import { useEffect, useState } from 'react';

function diff(target) {
  const ms = new Date(target).getTime() - Date.now();
  const clamped = Math.max(0, ms);
  return {
    d: Math.floor(clamped / 86400000),
    h: Math.floor((clamped % 86400000) / 3600000),
    m: Math.floor((clamped % 3600000) / 60000),
    s: Math.floor((clamped % 60000) / 1000),
    done: ms <= 0
  };
}

function Box({ value, label, compact }) {
  return (
    <div
      className="rounded-lg bg-white/10 py-1.5 text-center ring-1 ring-white/15"
      style={{ minWidth: compact ? 42 : 56 }}
    >
      <div
        className="font-black tabular-nums"
        style={{ fontSize: compact ? 18 : 24 }}
      >
        {String(value).padStart(2, '0')}
      </div>
      <div className="text-[9px] uppercase tracking-widest text-slate-300">{label}</div>
    </div>
  );
}

export default function Countdown({ endDate, compact = false }) {
  const [t, setT] = useState(() => diff(endDate));

  useEffect(() => {
    const id = setInterval(() => setT(diff(endDate)), 1000);
    return () => clearInterval(id);
  }, [endDate]);

  return (
    <div className="flex items-center gap-2">
      <Box value={t.d} label="gün" compact={compact} />
      <Box value={t.h} label="saat" compact={compact} />
      <Box value={t.m} label="dəq" compact={compact} />
      <Box value={t.s} label="san" compact={compact} />
    </div>
  );
}
