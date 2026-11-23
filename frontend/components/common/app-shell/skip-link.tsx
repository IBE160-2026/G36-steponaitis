// Skip link (WCAG 2.4.1): hidden until focused, then jumps to `<main id="content">`. Used by the app
// shell and by the demo front page, which renders its own header and main (Story 9.6).

export function SkipLink() {
  return (
    <a
      href="#content"
      className="sr-only rounded-lg print:hidden bg-surface px-3 py-2 text-ink type-button focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50"
    >
      Skip to content
    </a>
  );
}
