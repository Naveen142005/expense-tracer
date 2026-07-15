const paths = {
  wallet: (
    <>
      <path d="M4 7.5h14.5A1.5 1.5 0 0 1 20 9v9H5.5A1.5 1.5 0 0 1 4 16.5v-9Z" />
      <path d="M4 8V6a2 2 0 0 1 2-2h11" />
      <path d="M15.5 13h2" />
    </>
  ),
  cash: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M7 10.5c1.2 0 2-.8 2-2M17 13.5c-1.2 0-2 .8-2 2" />
      <circle cx="12" cy="12" r="2.25" />
    </>
  ),
  phone: (
    <>
      <rect x="7" y="2.75" width="10" height="18.5" rx="2.25" />
      <path d="M10.5 6h3M11 18h2" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M8 3v4M16 3v4M3.5 9.5h17" />
      <path d="M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01" />
    </>
  ),
  trend: (
    <>
      <path d="m4 17 5-5 3.5 3.5L20 8" />
      <path d="M15 8h5v5" />
    </>
  ),
  repeat: (
    <>
      <path d="M17 2.75 20.25 6 17 9.25" />
      <path d="M3.75 11V9a3 3 0 0 1 3-3h13" />
      <path d="M7 21.25 3.75 18 7 14.75" />
      <path d="M20.25 13v2a3 3 0 0 1-3 3h-13" />
    </>
  ),
  sunrise: (
    <>
      <path d="M4 18h16M6.5 15a5.5 5.5 0 0 1 11 0" />
      <path d="M12 3v3M4.2 7.2l2.1 2.1M19.8 7.2l-2.1 2.1" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4" />
    </>
  ),
  sunset: (
    <>
      <path d="M4 18h16M6.5 15a5.5 5.5 0 0 1 11 0" />
      <path d="M12 7V3m-2 2 2-2 2 2M4.5 10h2M17.5 10h2" />
    </>
  ),
  moon: <path d="M20 15.2A8 8 0 0 1 8.8 4a8.25 8.25 0 1 0 11.2 11.2Z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  food: (
    <>
      <path d="M7 3v7M4.5 3v4.5A2.5 2.5 0 0 0 7 10M9.5 3v4.5A2.5 2.5 0 0 1 7 10v11" />
      <path d="M16 3c2 1.7 3 4.1 3 7v2h-4V7c0-1.8.3-3.1 1-4Zm1 9v9" />
    </>
  ),
  snack: (
    <>
      <path d="M19.5 11.5A8 8 0 1 1 12.5 4c-.2 2.7 1.7 4.1 4 4-.2 2.2 1.1 3.5 3 3.5Z" />
      <path d="M8 9h.01M11 14h.01M7 16h.01M14 11h.01" />
    </>
  ),
  bus: (
    <>
      <rect x="4" y="3" width="16" height="16" rx="3" />
      <path d="M4 12h16M8 7h8M7 19v2M17 19v2" />
      <circle cx="8" cy="15.5" r="1" />
      <circle cx="16" cy="15.5" r="1" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  logout: (
    <>
      <path d="M10 4H5v16h5M14 8l4 4-4 4M8 12h10" />
    </>
  ),
  chevron: <path d="m9 7 5 5-5 5" />,
  palette: (
    <>
      <path d="M12 3a9 9 0 1 0 0 18h1.4a2 2 0 0 0 1.5-3.3 1.65 1.65 0 0 1 1.25-2.7H18a3 3 0 0 0 3-3c0-5-4-9-9-9Z" />
      <path d="M7.5 10h.01M9.5 6.5h.01M14 6.5h.01M17 9h.01" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10" width="14" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .35 1.9l.05.05-2.85 2.85-.05-.05A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1H9.55a1.7 1.7 0 0 0-.4-1.1 1.7 1.7 0 0 0-1-.6 1.7 1.7 0 0 0-1.9.35l-.05.05-2.85-2.85.05-.05A1.7 1.7 0 0 0 3.75 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4V9.55a1.7 1.7 0 0 0 1.1-.4 1.7 1.7 0 0 0 .6-1A1.7 1.7 0 0 0 3.4 6.25l-.05-.05L6.2 3.35l.05.05a1.7 1.7 0 0 0 1.9.35 1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1h4.05a1.7 1.7 0 0 0 .4 1.1 1.7 1.7 0 0 0 1 .6 1.7 1.7 0 0 0 1.9-.35l.05-.05L19.8 6.2l-.05.05a1.7 1.7 0 0 0-.35 1.9 1.7 1.7 0 0 0 .6 1 1.7 1.7 0 0 0 1.1.4v4.05a1.7 1.7 0 0 0-1.1.4 1.7 1.7 0 0 0-.6 1Z" />
    </>
  ),
  camera: (
    <>
      <path d="M4 7h3l1.5-2h7L17 7h3v12H4Z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  upload: (
    <>
      <path d="M12 16V4M7 9l5-5 5 5" />
      <path d="M5 19v2h14v-2" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6" />
    </>
  ),
  id: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8" cy="11" r="2" />
      <path d="M5.5 16a3 3 0 0 1 5 0M13 10h5M13 14h4" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </>
  ),
  sparkle: (
    <>
      <path d="m12 3 1.4 3.6L17 8l-3.6 1.4L12 13l-1.4-3.6L7 8l3.6-1.4L12 3Z" />
      <path d="m18 14 .8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8L18 14ZM5.5 13l.6 1.4 1.4.6-1.4.6L5.5 17l-.6-1.4-1.4-.6 1.4-.6.6-1.4Z" />
    </>
  ),
  template: (
    <>
      <rect x="5" y="3" width="14" height="16" rx="2" />
      <path d="M8 7h8M8 11h8M8 15h5M3 7v12a2 2 0 0 0 2 2h10" />
    </>
  ),
};

function AppIcon({ name, size = 20, className = "" }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name] || paths.sparkle}
    </svg>
  );
}

export default AppIcon;
