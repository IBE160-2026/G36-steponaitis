// App toolbar (UX-DR4): 64px louvre-panel graphite with the product mark, the product name and the
// flow bar. Sticky while the viewport is at least 500px tall; below that it scrolls with the page.
// The plan plate, launcher button and avatar arrive in later stories.

import Link from "next/link";

import { FlowBar } from "@/components/common/app-shell/flow-bar";
import { ProductMark } from "@/components/common/app-shell/product-mark";

export function Toolbar() {
  return (
    <header
      data-surface="graphite"
      className="static z-40 flex min-h-toolbar-height flex-wrap items-center gap-x-6 gap-y-2 border-b border-shell-edge bg-louvre-shell px-page-gutter py-3 tall:sticky tall:top-0"
    >
      <Link href="/" className="flex shrink-0 items-center gap-2 rounded-sm">
        <ProductMark />
        <span className="font-code text-[15px] leading-none font-bold whitespace-nowrap text-white">
          Smart Warehouse Planner
        </span>
      </Link>
      <FlowBar />
    </header>
  );
}
