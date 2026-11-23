// The demo front page (Story 9.6, FR-50, NFR-5, UX-DR54): what a visitor without a session sees on
// the public deployment. Its own graphite header (logo, name, How it works, an outlined Log in),
// the hero with Log in, Create account and the Demo version slot beside the bin wall and its
// reason card, then "One part, start to finish": four panels hung from a graphite rail. Everything
// below the actions is a static picture; nothing in the panels is a control. The page owns its
// skip link, header and `<main>`, because the app shell renders bare on `/`. Demo version comes in
// as a slot (app/page.tsx), so this module never imports modules/auth.

import Link from "next/link";
import type { ReactNode } from "react";

import { ProductMark } from "@/components/common/app-shell/product-mark";
import { SkipLink } from "@/components/common/app-shell/skip-link";
import { buttonClassName } from "@/components/common/button";
import { Icon } from "@/components/common/icons";
import { Bin } from "@/components/common/wall";
import { LOGIN_HREF, SIGNUP_HREF } from "@/lib/view-state/urls";

import { BIN_HEIGHT, BIN_WIDTH, BinWall } from "./bin-wall";
import {
  BEST_TAG,
  CLASSIFIED_CAPTION,
  CLASSIFIED_PICKS,
  CREATE_ACCOUNT,
  DECIDE_APPLY,
  DECIDE_CAPTION,
  DECIDE_KEEP,
  DEMO_CAPTION,
  DEMO_FROM,
  DEMO_PART,
  DEMO_TO,
  EXPORT_HEADERS,
  EXPORT_ROWS,
  FLOW_PANELS,
  FLOW_TITLE,
  HEADLINE,
  HOW_IT_WORKS,
  HOW_IT_WORKS_ID,
  LEAD,
  LOG_IN,
  MOVE_LIST_LINES,
  MOVE_LIST_ROUND,
  MOVE_LIST_ROUND_NOTE,
  MOVE_LIST_TITLE,
  PRODUCT_NAME,
  REASON_CARD,
} from "./copy";

function FrontPageHeader() {
  return (
    <header
      data-surface="graphite"
      className="flex min-h-toolbar-height flex-wrap items-center gap-x-6 gap-y-2 border-b border-shell-edge bg-louvre-shell px-page-gutter py-3"
    >
      <div className="flex shrink-0 items-center gap-2">
        <ProductMark />
        <span className="font-code text-[15px] leading-none font-bold whitespace-nowrap text-white">{PRODUCT_NAME}</span>
      </div>
      <nav aria-label="Front page" className="ml-auto flex items-center gap-4">
        <a
          href={`#${HOW_IT_WORKS_ID}`}
          className="rounded-sm type-button text-on-dark underline-offset-2 hover:underline"
        >
          {HOW_IT_WORKS}
        </a>
        <Link
          href={LOGIN_HREF}
          className="inline-flex h-control-lg shrink-0 items-center justify-center rounded-lg border border-on-dark bg-transparent px-4 type-button whitespace-nowrap text-on-dark"
        >
          {LOG_IN}
        </Link>
      </nav>
    </header>
  );
}

function ReasonCard() {
  return (
    <div
      data-reason-card=""
      className="flex w-[240px] max-w-full shrink-0 flex-col gap-1 rounded-lg border border-border border-l-[6px] border-l-accent bg-surface p-4"
    >
      <p className="type-tag text-ink-secondary">{REASON_CARD.rule}</p>
      <p className="flex flex-col">
        <strong className="font-code text-[18px] leading-tight font-bold">{DEMO_PART.number}</strong>
        <span className="type-body-strong">{DEMO_PART.description}</span>
      </p>
      <p className="flex flex-col pt-2 type-reason text-ink-secondary">
        <span>{REASON_CARD.picks}</span>
        <span>{REASON_CARD.where}</span>
      </p>
      <p className="pt-2 type-body-strong text-best-on-light">{REASON_CARD.target}</p>
    </div>
  );
}

function Hero({ demoAction }: { demoAction?: ReactNode }) {
  return (
    <section
      aria-labelledby="front-page-headline"
      className="mx-auto grid w-full max-w-[1392px] gap-10 px-page-gutter pt-12 pb-10 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center"
    >
      <div className="flex min-w-0 flex-col gap-5">
        <h1 id="front-page-headline" className="type-display-hero text-ink max-sm:text-[40px]">
          {HEADLINE}
        </h1>
        <p className="max-w-[34em] type-lead text-ink-secondary">{LEAD}</p>
        <div className="flex flex-wrap items-center gap-3 pt-2" data-front-page-actions="">
          <Link href={LOGIN_HREF} className={buttonClassName("primary")}>
            {LOG_IN}
          </Link>
          <Link href={SIGNUP_HREF} className={buttonClassName("secondary")}>
            {CREATE_ACCOUNT}
          </Link>
          {demoAction}
        </div>
        <p className="type-caption text-ink-secondary">{DEMO_CAPTION}</p>
      </div>
      <div className="flex flex-wrap items-center gap-6 xl:flex-nowrap">
        <BinWall className="h-auto w-[360px] max-w-full" />
        <ReasonCard />
      </div>
    </section>
  );
}

function ExportTable() {
  return (
    <table className="w-full border-collapse text-left">
      <thead>
        <tr className="bg-band">
          {EXPORT_HEADERS.map((header) => (
            <th key={header} scope="col" className="px-2 py-1.5 type-column-head text-ink-secondary">
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {EXPORT_ROWS.map((row) => (
          <tr
            key={row.part}
            data-highlighted={row.highlighted ? "" : undefined}
            className={
              row.highlighted
                ? "border-b border-hairline bg-selected-tint text-ink shadow-[inset_4px_0_0_var(--color-accent)]"
                : "border-b border-hairline text-ink-secondary"
            }
          >
            <td className="px-2 py-2 type-code-table">{row.part}</td>
            <td className="px-2 py-2 type-code-table">{row.location}</td>
            <td className="px-2 py-2 type-code-table">{row.picks}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ClassifiedFast() {
  return (
    <div className="flex flex-col items-center gap-1">
      <svg
        viewBox={`0 0 ${BIN_WIDTH} ${BIN_HEIGHT}`}
        width={112}
        height={108}
        aria-hidden="true"
        focusable="false"
      >
        <Bin parts={["fast"]} width={BIN_WIDTH} height={BIN_HEIGHT} />
      </svg>
      <p className="pt-2 font-code text-[30px] leading-none font-bold">{CLASSIFIED_PICKS}</p>
      <p className="type-reason text-ink-secondary">{CLASSIFIED_CAPTION}</p>
    </div>
  );
}

function YouDecide() {
  return (
    <div className="flex flex-col gap-3">
      <p className="type-body-strong">
        {DEMO_PART.number} · {DEMO_PART.description}
      </p>
      <p className="flex flex-wrap items-center gap-2 type-code">
        <span>{DEMO_FROM}</span>
        <span aria-hidden="true">→</span>
        <span className="sr-only">to</span>
        <span>{DEMO_TO}</span>
        <span className="rounded-sm bg-best-on-light px-1.5 type-tag text-white">{BEST_TAG}</span>
      </p>
      <div className="flex flex-wrap gap-3" data-static-chips="">
        <span className={buttonClassName("primary", "lg", false, "pointer-events-none")}>
          <Icon name="check" />
          {DECIDE_APPLY}
        </span>
        <span className={buttonClassName("secondary", "lg", false, "pointer-events-none")}>{DECIDE_KEEP}</span>
      </div>
      <p className="type-reason text-ink-secondary">{DECIDE_CAPTION}</p>
    </div>
  );
}

function PrintedMoveList() {
  return (
    <div className="flex flex-col gap-2 border border-black bg-white p-3 text-black">
      <p className="border-b-[1.5px] border-black pb-2 type-body-strong">{MOVE_LIST_TITLE}</p>
      <p className="flex items-center gap-2">
        <span className="border-[1.5px] border-black px-1.5 font-code text-[12px] font-bold">{MOVE_LIST_ROUND}</span>
        <span className="type-caption">{MOVE_LIST_ROUND_NOTE}</span>
      </p>
      <ul className="flex flex-col">
        {MOVE_LIST_LINES.map((line) => (
          <li
            key={line.part}
            className="flex flex-wrap items-center gap-x-2 border-b border-black/35 py-1.5 font-code text-[12.5px] font-bold"
          >
            <span aria-hidden="true" className="size-3.5 shrink-0 border border-black" />
            <span>{line.part}</span>
            <span>{line.from}</span>
            <span aria-hidden="true" className="font-sans font-normal">
              →
            </span>
            <span className="sr-only">to</span>
            <span>{line.to}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const PANEL_BODIES: readonly ReactNode[] = [
  <ExportTable key="export" />,
  <ClassifiedFast key="classified" />,
  <YouDecide key="decide" />,
  <PrintedMoveList key="move-list" />,
];

function HowItWorks() {
  return (
    <section
      id={HOW_IT_WORKS_ID}
      aria-labelledby="front-page-flow-title"
      tabIndex={-1}
      className="mx-auto flex w-full max-w-[1392px] flex-col gap-6 px-page-gutter pt-6 pb-16"
    >
      <h2 id="front-page-flow-title" className="type-section-title text-ink">
        {FLOW_TITLE}
      </h2>
      <div className="relative pt-1.5">
        {/* The graphite rail the panels hang from. */}
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1.5 rounded-sm bg-upright" />
        <ol className="grid gap-x-6 gap-y-4 md:grid-cols-2 xl:grid-cols-4">
          {FLOW_PANELS.map((panel, index) => (
            <li key={panel.title} className="relative flex flex-col pt-5" data-flow-panel={index + 1}>
              {/* Two hangers from the rail. */}
              <span aria-hidden="true" className="absolute top-[-6px] left-5 h-4 w-2.5 rounded-sm bg-wall-edge" />
              <span aria-hidden="true" className="absolute top-[-6px] right-5 h-4 w-2.5 rounded-sm bg-wall-edge" />
              <div className="flex h-full flex-col gap-4 rounded-lg border border-ink bg-surface p-5">
                <div className="flex items-start gap-3 border-b border-hairline pb-4">
                  <span
                    aria-hidden="true"
                    className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-ink font-code text-[14px] font-bold text-white"
                  >
                    {index + 1}
                  </span>
                  <div className="flex flex-col">
                    <h3 className="font-sans text-[17px] leading-tight font-bold">{panel.title}</h3>
                    <p className="type-reason text-ink-secondary">{panel.subtitle}</p>
                  </div>
                </div>
                {PANEL_BODIES[index]}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** The demo front page. `demoAction` is the Demo version button (app/page.tsx passes it in). */
export function FrontPage({ demoAction }: { demoAction?: ReactNode }) {
  return (
    <>
      <SkipLink />
      <FrontPageHeader />
      <main id="content" tabIndex={-1}>
        <Hero demoAction={demoAction} />
        <HowItWorks />
      </main>
    </>
  );
}
