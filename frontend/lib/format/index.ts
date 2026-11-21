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
