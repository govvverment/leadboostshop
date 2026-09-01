// Общий набор line-иконок — тот же стиль (stroke, 1.8, скруглённые
// концы), что уже используется в BottomNav.jsx. Чтобы не разводить
// текстовые глифы (⧉, 👁, ⟲...) по разным экранам вперемешку с SVG.

const PATHS = {
  download: (
    <>
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
      <path d="M4 19.5h16" />
    </>
  ),
  externalLink: (
    <>
      <path d="M9 6h9v9" />
      <path d="M18 6L6 18" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2.5" />
      <path d="M16 8V6.5A2.5 2.5 0 0 0 13.5 4H6.5A2.5 2.5 0 0 0 4 6.5v7A2.5 2.5 0 0 0 6.5 16H8" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M3.5 3.5l17 17" />
      <path d="M10.6 5.7c.45-.1.9-.2 1.4-.2 6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3.3 4.1M6.4 6.4A17.4 17.4 0 0 0 2.5 12S6 18.5 12 18.5c1.2 0 2.3-.2 3.3-.6" />
      <path d="M9.9 10a2.8 2.8 0 0 0 3.9 3.9" />
    </>
  ),
  history: (
    <>
      <path d="M3 12a9 9 0 1 0 2.6-6.3" />
      <path d="M3 4v5h5" />
      <path d="M12 8v4.5l3 2" />
    </>
  ),
  headset: (
    <>
      <path d="M4 13v-1a8 8 0 0 1 16 0v1" />
      <rect x="3" y="13" width="4.5" height="6" rx="1.5" />
      <rect x="16.5" y="13" width="4.5" height="6" rx="1.5" />
      <path d="M18.5 19.3A4.5 4.5 0 0 1 14 22h-1.5" />
    </>
  ),
  document: (
    <>
      <path d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z" />
      <path d="M14 3.5V8h4" />
      <path d="M8.5 12.5h7M8.5 16h7" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M17.7 6.3l-1.5 1.5M7.8 16.2l-1.5 1.5M17.7 17.7l-1.5-1.5M7.8 7.8L6.3 6.3" />
    </>
  ),
  bag: (
    <>
      <path d="M6.5 8h11l-1 12h-9l-1-12z" />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
    </>
  ),
  code: (
    <>
      <path d="M9 8l-4 4 4 4" />
      <path d="M15 8l4 4-4 4" />
    </>
  ),
  people: (
    <>
      <circle cx="9" cy="8.2" r="3" />
      <path d="M3 20c1-3.3 3-5.2 6-5.2s5 1.9 6 5.2" />
      <circle cx="17.2" cy="9" r="2.3" />
      <path d="M15.8 12.1c2.3.3 3.6 1.9 4.2 4" />
    </>
  ),
  packageBookmark: (
    <>
      <path d="M4 9.5l1.8-3.6A1.5 1.5 0 0 1 7.2 5h9.6a1.5 1.5 0 0 1 1.4.9L20 9.5" />
      <path d="M4 9.5h16v7.8a1.7 1.7 0 0 1-1.7 1.7H5.7A1.7 1.7 0 0 1 4 17.3V9.5z" />
      <path d="M9.5 9.5V16l2.5-1.7 2.5 1.7V9.5" />
    </>
  ),
};

export default function Icon({ name, size = 16, className }) {
  const path = PATHS[name];
  if (!path) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {path}
    </svg>
  );
}
