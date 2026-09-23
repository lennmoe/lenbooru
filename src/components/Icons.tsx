const base = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const ChevronLeft = () => (
  <svg {...base} width={22} height={22} strokeWidth={2.6}>
    <path d="M15 18l-6-6 6-6" />
  </svg>
);
export const ChevronRight = () => (
  <svg {...base} width={22} height={22} strokeWidth={2.6}>
    <path d="M9 18l6-6-6-6" />
  </svg>
);
export const Pencil = () => (
  <svg {...base} width={20} height={20}>
    <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);
export const Download = () => (
  <svg {...base} width={16} height={16}>
    <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
  </svg>
);
export const TagIcon = () => (
  <svg {...base} width={14} height={14} fill="currentColor" stroke="none">
    <path d="M3 3h8.6l9.4 9.4-8.6 8.6L3 11.6Zm5 3.5A1.5 1.5 0 1 0 8 9.5a1.5 1.5 0 0 0 0-3Z" />
  </svg>
);
export const UserIcon = () => (
  <svg {...base} width={16} height={16}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </svg>
);
