export default function Icon({ name, className = 'h-5 w-5', strokeWidth = 1.8 }) {
  const paths = {
    map: (
      <>
        <path d="M9 3 3 6v15l6-3 6 3 6-3V3l-6 3-6-3Z" />
        <path d="M9 3v15" />
        <path d="M15 6v15" />
      </>
    ),
    trend: (
      <>
        <path d="M3 3v18h18" />
        <path d="m7 14 3-3 2 2 4-5" />
      </>
    ),
    compass: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />
      </>
    ),
    qr: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <path d="M14 14h3v3" />
        <path d="M17 20h4v-2" />
      </>
    ),
    building: (
      <>
        <path d="M3 21h18" />
        <path d="M5 21V8l7-5 7 5v13" />
        <path d="M9 21v-6h6v6" />
      </>
    ),
    shield: (
      <>
        <path d="M12 3 5 6v6c0 4 3 6.5 7 8 4-1.5 7-4 7-8V6l-7-3Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    leaf: (
      <>
        <path d="M11 20A7 7 0 0 1 4 13c0-6 9-10 16-10 0 7-4 16-10 16Z" />
        <path d="M4 20c2-6 6-9 12-11" />
      </>
    ),
    file: (
      <>
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
        <path d="M14 3v5h5" />
        <path d="M9 14h6" />
        <path d="M9 17h4" />
      </>
    ),
    sparkle: (
      <>
        <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
        <path d="m6 6 2 2M16 16l2 2M18 6l-2 2M8 16l-2 2" />
      </>
    ),
    arrow: (
      <>
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
      </>
    ),
    plus: (
      <>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </>
    ),
    check: <path d="m5 13 4 4L19 7" />,
    minus: <path d="M5 12h14" />,
    crosshair: (
      <>
        <circle cx="12" cy="12" r="7" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
      </>
    ),
    x: (
      <>
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
      </>
    ),
    trash: (
      <>
        <path d="M3 6h18" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </>
    ),
    menu: (
      <>
        <path d="M4 7h16M4 12h16M4 17h16" />
      </>
    ),
    upload: (
      <>
        <path d="M12 21V9" />
        <path d="m8 13 4-4 4 4" />
        <path d="M4 6V4a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2" />
      </>
    ),
    walk: (
      <>
        <circle cx="13" cy="4.5" r="2" />
        <path d="m10 21 2-6-2-4 3-2 2 3 3 1" />
        <path d="m12 15-3 6" />
        <path d="m8 11 3-3" />
      </>
    ),
    maximize: (
      <>
        <path d="M4 9V4h5" />
        <path d="M20 15v5h-5" />
        <path d="M15 4h5v5" />
        <path d="M9 20H4v-5" />
      </>
    ),
    minimize: (
      <>
        <path d="M9 4v5H4" />
        <path d="M15 20v-5h5" />
        <path d="M20 9h-5V4" />
        <path d="M4 15h5v5" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.2-3.2" />
      </>
    ),
    copy: (
      <>
        <rect x="9" y="9" width="11" height="11" rx="2" />
        <path d="M5 15V5a2 2 0 0 1 2-2h8" />
      </>
    ),
    download: (
      <>
        <path d="M12 3v12" />
        <path d="m8 11 4 4 4-4" />
        <path d="M4 20h16" />
      </>
    ),
    trophy: (
      <>
        <path d="M8 21h8" />
        <path d="M12 17v4" />
        <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
        <path d="M7 6H4v1a3 3 0 0 0 3 3" />
        <path d="M17 6h3v1a3 3 0 0 1-3 3" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="4.5" width="18" height="16" rx="2" />
        <path d="M8 3v3M16 3v3M3 9h18" />
      </>
    ),
    share: (
      <>
        <circle cx="18" cy="5" r="2.5" />
        <circle cx="6" cy="12" r="2.5" />
        <circle cx="18" cy="19" r="2.5" />
        <path d="m8.3 10.8 7.4-4.1M8.3 13.2l7.4 4.1" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    target: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1.4" />
      </>
    ),
    layers: (
      <>
        <path d="m12 3 9 5-9 5-9-5 9-5Z" />
        <path d="m3 13 9 5 9-5" />
      </>
    ),
    coin: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M15 9.5A3 3 0 0 0 12 8h-1a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4h-1a3 3 0 0 1-3-1.5" />
        <path d="M12 6.5v11" />
      </>
    ),
    bolt: <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />,
    users: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20a6 6 0 0 1 12 0" />
        <path d="M16 6a3 3 0 0 1 0 6" />
        <path d="M18 20a6 6 0 0 0-3-5.2" />
      </>
    ),
    award: (
      <>
        <circle cx="12" cy="9" r="5" />
        <path d="m9 14-2 7 5-3 5 3-2-7" />
      </>
    ),
    flag: (
      <>
        <path d="M5 21V4" />
        <path d="M5 5h12l-2 3 2 3H5" />
      </>
    ),
    star: <path d="m12 3 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.2l1-5.9L3.5 9.2l5.9-.8L12 3Z" />,
    external: (
      <>
        <path d="M14 4h6v6" />
        <path d="M20 4 10 14" />
        <path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
      </>
    ),
    chart: (
      <>
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
      </>
    ),
    link: (
      <>
        <path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1" />
        <path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.7 21a2 2 0 0 1-3.4 0" />
      </>
    ),
    grain: (
      <>
        <path d="M12 3v18" />
        <path d="M12 7c0-2 1.5-3.5 3.5-3.5C15.5 5.5 14 7 12 7Z" />
        <path d="M12 7c0-2-1.5-3.5-3.5-3.5C8.5 5.5 10 7 12 7Z" />
        <path d="M12 12c0-2 1.5-3.5 3.5-3.5C15.5 10.5 14 12 12 12Z" />
        <path d="M12 12c0-2-1.5-3.5-3.5-3.5C8.5 10.5 10 12 12 12Z" />
        <path d="M12 17c0-2 1.5-3.5 3.5-3.5C15.5 15.5 14 17 12 17Z" />
        <path d="M12 17c0-2-1.5-3.5-3.5-3.5C8.5 15.5 10 17 12 17Z" />
      </>
    ),
    droplet: (
      <path d="M12 3s6 6 6 10a6 6 0 0 1-12 0c0-4 6-10 6-10Z" />
    ),
    cpu: (
      <>
        <rect x="7" y="7" width="10" height="10" rx="2" />
        <path d="M10 2v3M14 2v3M10 19v3M14 19v3M2 10h3M2 14h3M19 10h3M19 14h3" />
      </>
    ),
    package: (
      <>
        <path d="m12 3 8 4.5v9L12 21 4 16.5v-9L12 3Z" />
        <path d="M4 7.5 12 12l8-4.5" />
        <path d="M12 12v9" />
      </>
    ),
    factory: (
      <>
        <path d="M3 21V9l6 4V9l6 4V9l6 4v8H3Z" />
        <path d="M7 21v-4M12 21v-4M17 21v-4" />
        <path d="M3 9 6 3v6" />
      </>
    ),
    truck: (
      <>
        <path d="M3 6h11v9H3z" />
        <path d="M14 9h4l3 3v3h-7V9Z" />
        <circle cx="7" cy="18" r="2" />
        <circle cx="17" cy="18" r="2" />
      </>
    ),
    ruler: (
      <>
        <path d="M4 14 14 4l6 6-10 10-6-6Z" />
        <path d="M8 10l1.6 1.6M11 7l1.6 1.6M5 13l1.6 1.6M14 4l1.6 1.6M17 7l-1.6 1.6" />
      </>
    ),
    tag: (
      <>
        <path d="M20.6 13.4 12 22l-9-9V4a1 1 0 0 1 1-1h9l7.6 7.6a2 2 0 0 1 0 2.8Z" />
        <circle cx="7.5" cy="7.5" r="1.3" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    )
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {paths[name] || paths.sparkle}
    </svg>
  );
}
