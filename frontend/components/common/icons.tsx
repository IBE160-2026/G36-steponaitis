// The UI icon set (UX-DR3): outline icons at a consistent 1.6px stroke, round caps and joins.

import {
  Check,
  ChevronDown,
  Clock,
  LayoutGrid,
  Link as LinkIcon,
  Lock,
  type LucideIcon,
  Palette,
  Pin,
  Plus,
  Search,
  TriangleAlert,
  X,
} from "lucide-react";

const ICONS = {
  search: Search,
  grid: LayoutGrid,
  lock: Lock,
  clock: Clock,
  pin: Pin,
  palette: Palette,
  warning: TriangleAlert,
  check: Check,
  link: LinkIcon,
  chevron: ChevronDown,
  plus: Plus,
  close: X,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;
export const ICON_NAMES = Object.keys(ICONS) as IconName[];

type IconProps = {
  name: IconName;
  size?: number;
  /** When given, the icon is announced as an image with this name; otherwise it is decorative. */
  label?: string;
  className?: string;
};

export function Icon({ name, size = 16, label, className }: IconProps) {
  const Component = ICONS[name];
  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true as const };
  return (
    <Component
      size={size}
      strokeWidth={1.6}
      absoluteStrokeWidth
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      focusable="false"
      data-icon={name}
      style={{ flexShrink: 0 }}
      {...a11y}
    />
  );
}
