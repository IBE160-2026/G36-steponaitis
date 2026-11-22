// Display formats (UX-DR56): dates YYYY-MM-DD, times HH:MM in the viewer's time zone,
// numbers with thousands separators. Instants arrive as ISO 8601 UTC strings from the API.

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DECIMAL = /^(-?)(\d+)(?:\.(\d+))?$/;

function parseInstant(value: string | Date): Date {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`Not a date or time: ${String(value)}`);
  }
  return date;
}

function isValidDateOnly(value: string): boolean {
  const match = DATE_ONLY.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function localParts(date: Date): Record<string, string> {
  const parts = new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

/** `YYYY-MM-DD`. A date-only string is returned unchanged; an instant is shown in the viewer's zone. */
export function formatDate(value: string | Date): string {
  if (typeof value === "string" && DATE_ONLY.test(value)) {
    if (!isValidDateOnly(value)) throw new RangeError(`Not a date: ${value}`);
    return value;
  }
  const parts = localParts(parseInstant(value));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** `HH:MM` (24-hour) in the viewer's zone. A date-only string has no time and is rejected. */
export function formatTime(value: string | Date): string {
  if (typeof value === "string" && DATE_ONLY.test(value)) {
    throw new RangeError(`A date has no time: ${value}`);
  }
  const parts = localParts(parseInstant(value));
  return `${parts.hour}:${parts.minute}`;
}

/** `YYYY-MM-DD HH:MM` in the viewer's zone (an instant, not a date-only string). */
export function formatDateTime(value: string | Date): string {
  return `${formatDate(value)} ${formatTime(value)}`;
}

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Thousands separators: `1584` → `"1,584"`. A string (a decimal from the API) keeps its decimals
 * exactly; only the integer part is grouped.
 */
export function formatNumber(value: number | string): string {
  let text: string;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new RangeError(`Not a number: ${value}`);
    text = String(value);
    if (/e/i.test(text)) {
      return value.toLocaleString("en-US", { maximumFractionDigits: 20 });
    }
  } else {
    text = value.trim();
  }
  const match = DECIMAL.exec(text);
  if (!match) throw new RangeError(`Not a number: ${String(value)}`);
  const [, sign, integer, fraction] = match;
  const grouped = groupThousands(BigInt(integer).toString());
  const isZero = /^0+$/.test(integer) && (!fraction || /^0+$/.test(fraction));
  return `${sign && !isZero ? "-" : ""}${grouped}${fraction !== undefined ? `.${fraction}` : ""}`;
}

// Megabytes (UX-DR19): 1 MB = 1,000,000 bytes. Integer arithmetic, so no floating-point drift.
const BYTES_PER_TENTH_MB = 100_000;
const BYTES_PER_MB = 1_000_000;

function checkBytes(bytes: number): void {
  if (!Number.isInteger(bytes) || bytes < 0) throw new RangeError(`Not a byte count: ${bytes}`);
}

function fromTenths(tenths: number): string {
  return `${formatNumber(Math.floor(tenths / 10))}.${tenths % 10}`;
}

/** Megabytes rounded up to one decimal, without a trailing `.0`: 5,200,000 → "5.2", 4,000,001 → "4.1". */
export function megabytesRoundedUp(bytes: number): string {
  checkBytes(bytes);
  return fromTenths(Math.ceil(bytes / BYTES_PER_TENTH_MB)).replace(/\.0$/, "");
}

/** Megabytes to the nearest tenth, always one decimal: 1,234,567 → "1.2", 0 → "0.0". */
export function megabytesOneDecimal(bytes: number): string {
  checkBytes(bytes);
  return fromTenths(Math.round(bytes / BYTES_PER_TENTH_MB));
}

/** Exact megabytes with as many decimals as needed: 4,000,000 → "4", 1,500,000 → "1.5". */
export function megabytesExact(bytes: number): string {
  checkBytes(bytes);
  const whole = formatNumber(Math.floor(bytes / BYTES_PER_MB));
  const fraction = String(bytes % BYTES_PER_MB).padStart(6, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}
