// A QR code drawn as inline SVG (Story 14.1, FR-48). `uqr` (bundled, no network call) encodes
// `value` exactly as given, with ECC level M and a quiet zone of 4 modules; every dark module is one
// `M{x} {y}h1v1h-1z` square of a single path, black on a white background, so it prints crisply
// without printed backgrounds mattering and the tests can rasterise the rendered output.

import { encode } from "uqr";

/** The quiet zone around the symbol, in modules (the QR standard's minimum). */
export const QR_BORDER = 4;

/** The single path of the dark modules of `value`'s QR code, and the matrix size. */
export function qrPath(value: string): { size: number; d: string } {
  const { size, data } = encode(value, { ecc: "M", border: QR_BORDER });
  const parts: string[] = [];
  data.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (dark) parts.push(`M${x} ${y}h1v1h-1z`);
    }),
  );
  return { size, d: parts.join("") };
}

export function QrCode({ value, className }: { value: string; className?: string }) {
  const { size, d } = qrPath(value);
  return (
    <svg
      role="img"
      aria-label={`QR code ${value}`}
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      className={className}
    >
      <rect width={size} height={size} className="fill-print-paper" />
      <path d={d} className="fill-print-ink" />
    </svg>
  );
}
