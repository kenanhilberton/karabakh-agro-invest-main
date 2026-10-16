export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-6 text-xs text-slate-500 sm:flex-row">
        <div>© {new Date().getFullYear()} KarabakhAgroInvest — Hackathon prototipi</div>
        <div className="flex items-center gap-3">
          <span className="chip bg-flag-blue/10 text-flag-blue">EKTİS inteqrasiyası</span>
          <span className="chip bg-brand-50 text-brand-700">JWT / RBAC</span>
          <span className="chip bg-slate-100 text-slate-600">OpenAPI</span>
        </div>
      </div>
    </footer>
  );
}
