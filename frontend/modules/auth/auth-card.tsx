// The Log in and Create account card (UX-DR53): a 380px surface card with a border and
// `rounded.lg` corners on the ground colour, the title in `page-title`, an optional lead, the form
// and a link row to the other page, then an optional footer. Shared by both pages (Stories 9.1, 9.2
// and 9.5).

import Link from "next/link";
import { type ReactNode, useId } from "react";

import { Icon } from "@/components/common/icons";

export type AuthCardProps = {
  title: string;
  lead?: string;
  children: ReactNode;
  /** The link row under the form: its text, then the link. */
  linkPrompt: string;
  linkHref: string;
  linkLabel: string;
  /** Optional content after the link row (Log in's "or" rule and Demo version, Story 9.5). */
  footer?: ReactNode;
};

export function AuthCard({ title, lead, children, linkPrompt, linkHref, linkLabel, footer }: AuthCardProps) {
  const titleId = `${useId()}-title`;
  return (
    <div className="flex justify-center px-page-gutter py-10">
      <section
        aria-labelledby={titleId}
        className="flex w-full max-w-[380px] flex-col gap-5 rounded-lg border border-border bg-surface p-6"
      >
        <div className="flex flex-col gap-1">
          <h1 id={titleId} className="type-page-title text-ink">
            {title}
          </h1>
          {lead && <p className="text-ink-secondary type-body">{lead}</p>}
        </div>
        {children}
        <p className="text-ink-secondary type-body">
          {linkPrompt}{" "}
          <Link href={linkHref} className="text-ink underline underline-offset-2">
            {linkLabel}
          </Link>
        </p>
        {footer}
      </section>
    </div>
  );
}

/** One pale-red alert for the whole form (UX-DR20 panel style): a wrong login or another error. */
export function AuthAlert({ message }: { message: string }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-lg border border-error bg-error-tint p-3 text-ink">
      <Icon name="warning" size={20} className="mt-px text-error" />
      <p className="type-body">{message}</p>
    </div>
  );
}
