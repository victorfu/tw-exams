/** 泡泡考卷 logo：考卷右上角冒出兩顆泡泡。 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path d="M18 14h17l9 9v25a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4V18a4 4 0 0 1 4-4z" fill="#fff" stroke="#2F9BF0" strokeWidth="3" strokeLinejoin="round" />
      <path d="M21 31h14M21 38h17M21 45h10" stroke="#9CCBF5" strokeWidth="3" strokeLinecap="round" />
      <circle cx="46" cy="18" r="8.5" fill="#3DD6B5" />
      <circle cx="43.5" cy="15.5" r="2.2" fill="#fff" opacity="0.75" />
      <circle cx="55" cy="7" r="4" fill="#2F9BF0" />
    </svg>
  );
}
