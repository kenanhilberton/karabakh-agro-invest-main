import { QRCodeSVG } from 'qrcode.react';

const fmt = (n) => new Intl.NumberFormat('az-AZ', { maximumFractionDigits: 0 }).format(Math.round(n || 0));

export default function Receipt({ app }) {
  if (!app) return null;
  return (
    <div className="print-area card mx-auto max-w-2xl p-8">
      <div className="flex items-start justify-between border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-lg bg-gradient-to-br from-flag-blue via-brand-500 to-flag-green text-xl font-black text-white">
            K
          </div>
          <div>
            <div className="text-lg font-black text-ink-900">KarabakhAgroInvest</div>
            <div className="text-[11px] uppercase tracking-widest text-slate-400">
              İnvestisiya Müsabiqəsi Portalı
            </div>
          </div>
        </div>
        <QRCodeSVG value={`${typeof window !== 'undefined' ? window.location.origin : ''}/track/${app.trackingCode}`} size={92} />
      </div>

      <div className="mt-4 text-center">
        <div className="text-[11px] uppercase tracking-widest text-slate-400">Müraciət qəbzi</div>
        <div className="text-2xl font-black tracking-tight text-ink-900">{app.trackingCode}</div>
        <div className="mt-1 text-xs text-slate-500">
          Status: <b>{app.statusLabel}</b> · Tarix: {new Date(app.createdAt).toLocaleString('az-AZ')}
        </div>
      </div>

      <table className="mt-6 w-full text-sm">
        <tbody>
          <Row label="Müraciət edən" value={app.applicantName} />
          <Row label="Şirkət" value={app.company || '—'} />
          <Row label="Rayon" value={app.districtName} />
          <Row label="Torpaq kodu" value={app.landCode} />
          <Row label="Təyinat" value={app.purposeLabel} />
          <Row label="Sahə" value={`${app.areaHa} hektar`} />
          <Row label="İnvestisiya həcmi" value={`${fmt(app.investmentAmount)} ₼`} />
          {app.roi && <Row label="Gözlənilən ROI (5 il)" value={`${app.roi.roi5y}%`} />}
          {app.roi && <Row label="Geri qaytarma müddəti" value={`${app.roi.paybackYears} il`} />}
          {app.competitionTitle && <Row label="Müsabiqə" value={app.competitionTitle} />}
        </tbody>
      </table>

      <div className="mt-6 border-t border-dashed border-slate-200 pt-4 text-[11px] leading-relaxed text-slate-400">
        Bu sənəd KarabakhAgroInvest portalı tərəfindən avtomatik generasiya edilmişdir. Müraciətin
        statusunu <b>{app.trackingCode}</b> kodu ilə və ya yuxarıdakı QR kod vasitəsilə izləyə bilərsiniz.
        Sənəd EKTİS mərkəzi sistemi ilə sinxronizasiya üçün nəzərdə tutulmuşdur.
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <tr className="border-b border-slate-50">
      <td className="py-2 pr-4 align-top text-slate-400">{label}</td>
      <td className="py-2 text-right font-semibold text-ink-900">{value}</td>
    </tr>
  );
}
