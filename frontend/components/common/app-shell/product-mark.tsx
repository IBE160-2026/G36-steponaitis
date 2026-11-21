// Product mark: a medium-moving bin in miniature, in the fixed brand yellow (never a changed class colour).

export function ProductMark() {
  return (
    <svg width="24" height="26" viewBox="0 0 24 26" aria-hidden="true" focusable="false" className="shrink-0">
      {/* Bin body */}
      <rect x="0" y="0" width="24" height="26" rx="2" fill="var(--color-brand-mark)" />
      {/* Darker top lip and bottom line */}
      <rect x="0" y="0" width="24" height="3.5" rx="1.5" fill="rgba(0,0,0,0.22)" />
      <rect x="0" y="24.5" width="24" height="1.5" fill="rgba(0,0,0,0.18)" />
      {/* White label window with the medium-moving diamond */}
      <rect x="3" y="8" width="18" height="11" rx="1" fill="var(--color-label-window)" />
      <path d="M12 9.5 L16 13.5 L12 17.5 L8 13.5 Z" fill="var(--color-glyph)" />
    </svg>
  );
}
