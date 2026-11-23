// The movement-class fills of every bin graphic (wall bins, the Key, BinSwatch). Written out in
// full: Tailwind emits a theme variable only when it finds its whole name in the source, so a
// name built at runtime (`var(--color-class-${…})`) may not exist in the built CSS.

import type { MovementClass } from "@/lib/copy";

export const CLASS_FILL: Record<MovementClass, string> = {
  fast: "var(--color-class-fast)",
  medium: "var(--color-class-medium)",
  slow: "var(--color-class-slow)",
  dead: "var(--color-class-dead)",
};
