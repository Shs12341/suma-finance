const icons = {
  overview: [
    <path key="a" d="M4 13h6V4H4v9Z" />,
    <path key="b" d="M14 20h6v-9h-6v9Z" />,
    <path key="c" d="M4 20h6v-3H4v3Z" />,
    <path key="d" d="M14 7h6V4h-6v3Z" />
  ],
  transactions: [
    <path key="a" d="M4 7h13" />,
    <path key="b" d="m14 4 3 3-3 3" />,
    <path key="c" d="M20 17H7" />,
    <path key="d" d="m10 14-3 3 3 3" />
  ],
  categories: [
    <path key="a" d="M4 4h6v6H4z" />,
    <path key="b" d="M14 4h6v6h-6z" />,
    <path key="c" d="M4 14h6v6H4z" />,
    <path key="d" d="M14 14h6v6h-6z" />
  ],
  security: [
    <path key="a" d="M12 3 5 6v5c0 4.6 2.9 8.1 7 10 4.1-1.9 7-5.4 7-10V6l-7-3Z" />,
    <path key="b" d="m9 12 2 2 4-4" />
  ],
  logout: [
    <path key="a" d="M10 5H5v14h5" />,
    <path key="b" d="M13 8l4 4-4 4" />,
    <path key="c" d="M17 12H9" />
  ],
  wallet: [
    <path key="a" d="M4 7h15a1 1 0 0 1 1 1v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h11" />,
    <path key="b" d="M15 11h5v4h-5a2 2 0 0 1 0-4Z" />
  ],
  income: [
    <path key="a" d="M12 19V5" />,
    <path key="b" d="m7 10 5-5 5 5" />
  ],
  expense: [
    <path key="a" d="M12 5v14" />,
    <path key="b" d="m17 14-5 5-5-5" />
  ],
  savings: [
    <path key="a" d="M4 17 9 12l3 3 7-8" />,
    <path key="b" d="M14 7h5v5" />
  ],
  calendar: [
    <path key="a" d="M6 3v3M18 3v3M4 9h16" />,
    <rect key="b" x="4" y="5" width="16" height="16" rx="2" />
  ],
  plus: [<path key="a" d="M12 5v14M5 12h14" />],
  search: [
    <circle key="a" cx="11" cy="11" r="6" />,
    <path key="b" d="m16 16 4 4" />
  ],
  tag: [
    <path key="a" d="M3 10V4h6l11 11-6 6L3 10Z" />,
    <circle key="b" cx="7" cy="8" r="1" />
  ],
  lock: [
    <rect key="a" x="5" y="10" width="14" height="10" rx="2" />,
    <path key="b" d="M8 10V7a4 4 0 0 1 8 0v3" />
  ],
  device: [
    <rect key="a" x="5" y="3" width="14" height="18" rx="2" />,
    <path key="b" d="M10 17h4" />
  ],
  edit: [
    <path key="a" d="M4 20h4l11-11-4-4L4 16v4Z" />,
    <path key="b" d="m13 7 4 4" />
  ],
  trash: [
    <path key="a" d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13" />,
    <path key="b" d="M10 11v5M14 11v5" />
  ],
  sparkles: [
    <path key="a" d="m12 3 1.2 3.3L16.5 7.5l-3.3 1.2L12 12l-1.2-3.3-3.3-1.2 3.3-1.2L12 3Z" />,
    <path key="b" d="m18 14 .7 1.8 1.8.7-1.8.7L18 19l-.7-1.8-1.8-.7 1.8-.7L18 14Z" />
  ],
  arrowUp: [<path key="a" d="m7 14 5-5 5 5" />],
  arrowDown: [<path key="a" d="m7 10 5 5 5-5" />],
  chevron: [<path key="a" d="m9 6 6 6-6 6" />]
}

function Icon({ name, size = 18, strokeWidth = 1.8, className = "" }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {icons[name] || icons.sparkles}
    </svg>
  )
}

export default Icon
