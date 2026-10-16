// "mygov" wordmark used by the Azerbaijani e-government portal (my.gov.az).
// Rendered with text/layout only, so no external asset is required.
export default function MyGovLogo({ className = '', size = 'md', badge = true }) {
  const text = size === 'sm' ? 'text-lg' : size === 'xs' ? 'text-base' : 'text-2xl';
  const chip =
    size === 'sm' || size === 'xs'
      ? 'px-1 py-0 text-[8px]'
      : 'px-1.5 py-0.5 text-[10px]';
  return (
    <span className={`inline-flex items-center gap-1.5 leading-none ${className}`}>
      <span className={`${text} font-extrabold tracking-tight text-slate-900`}>mygov</span>
      {badge && (
        <span className={`rounded-md bg-[#0d6efd] font-bold uppercase tracking-wider text-white ${chip}`}>
          ID
        </span>
      )}
    </span>
  );
}
