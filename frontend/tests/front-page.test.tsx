import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "@/components/common/app-shell";
import { CommandsProvider } from "@/lib/commands";
import type { Session } from "@/lib/api/session";
import { FRONT_PAGE_HREF, isFrontPagePath, LOGIN_HREF, SAVED_PLANS_HREF, SIGNUP_HREF } from "@/lib/view-state/urls";
import { CLASS_CODES, FLOW_PANELS } from "@/modules/front-page/copy";
import { FrontPage } from "@/modules/front-page/front-page";
import { homeDecision, HomePage } from "@/modules/front-page/home-page";

// Story 9.6 (FR-50, NFR-5, UX-DR54): the demo front page on `/` and the bare shell there. Vitest
// has no DOM: pages are rendered to static markup with the path and session hooks stubbed.

const nav = vi.hoisted(() => ({
  pathname: "/",
  session: { isPending: false, data: undefined as unknown },
  replace: vi.fn(),
  push: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: nav.replace, push: nav.push }),
}));
vi.mock("@/lib/api/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/session")>()),
  useSession: () => nav.session,
}));

afterEach(() => {
  nav.pathname = "/";
  nav.session = { isPending: false, data: undefined };
  nav.replace.mockReset();
  nav.push.mockReset();
});

const html = renderToStaticMarkup;
const PUBLIC: Session = { user: null, feature_auth: true, feature_demo: true, max_upload_bytes: 1 };
const SLOT = <button type="button">Demo slot</button>;

/** The opening tag of the first `<a>` whose text is `label`. */
function anchor(markup: string, label: string): string {
  const match = markup.match(new RegExp(`<a [^>]*>${label}</a>`));
  expect(match, `link ${label}`).not.toBeNull();
  return match![0];
}

function text(markup: string): string {
  return markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

describe("fr50 the start page decides on the client", () => {
  it("fr50_front_page_path_is_slash_only", () => {
    expect(FRONT_PAGE_HREF).toBe("/");
    expect(isFrontPagePath("/")).toBe(true);
    for (const path of ["/plans", "/login", "/signup", "", "/x"]) expect(isFrontPagePath(path)).toBe(false);
  });

  it("fr50_home_decision_for_every_session_state", () => {
    expect(homeDecision(PUBLIC)).toBe("front-page"); // public, logged out
    expect(homeDecision({ ...PUBLIC, user: "demo" })).toBe("saved-plans"); // public, logged in
    expect(homeDecision({ ...PUBLIC, feature_demo: false })).toBe("saved-plans"); // local (the guard sends it to Log in first)
    expect(homeDecision({ ...PUBLIC, feature_auth: false, feature_demo: false })).toBe("saved-plans"); // auth off
    expect(homeDecision({ ...PUBLIC, feature_auth: false })).toBe("saved-plans"); // demo on, auth off: no login exists
    expect(homeDecision(undefined)).toBe("saved-plans"); // session read failed
  });

  it("fr50_home_page_renders_nothing_while_pending_and_the_front_page_for_a_public_visitor", () => {
    nav.session = { isPending: true, data: undefined };
    expect(html(<HomePage demoAction={SLOT} />)).toBe("");
    nav.session = { isPending: false, data: { ...PUBLIC, user: "demo" } };
    expect(html(<HomePage demoAction={SLOT} />)).toBe("");
    nav.session = { isPending: false, data: PUBLIC };
    const markup = html(<HomePage demoAction={SLOT} />);
    expect(markup).toContain("Every move comes with a reason.");
    expect(markup).toContain("Demo slot");
    expect(SAVED_PLANS_HREF).toBe("/plans");
  });
});

describe("nfr5 the demo front page", () => {
  const markup = html(<FrontPage demoAction={SLOT} />);

  it("nfr5_header_is_graphite_with_name_how_it_works_and_outlined_log_in", () => {
    const header = markup.slice(markup.indexOf("<header"), markup.indexOf("</header>"));
    expect(header).toContain('data-surface="graphite"');
    expect(header).toContain("bg-louvre-shell");
    expect(header).toContain("Smart Warehouse Planner");
    expect(anchor(header, "How it works")).toContain('href="#how-it-works"');
    const logIn = anchor(header, "Log in");
    expect(logIn).toContain(`href="${LOGIN_HREF}"`);
    expect(logIn).toContain("border-on-dark");
    expect(logIn).toContain("text-on-dark");
    expect(logIn).toContain("bg-transparent");
    // The name is not a link.
    expect(header).not.toMatch(/<a [^>]*>[^<]*Smart Warehouse Planner/);
    // The skip link comes first.
    expect(markup.indexOf("Skip to content")).toBeLessThan(markup.indexOf("<header"));
    expect(markup).toContain('<main id="content" tabindex="-1"');
  });

  it("nfr5_hero_has_headline_lead_three_actions_and_caption", () => {
    expect(markup).toMatch(/<h1[^>]*type-display-hero[^>]*>Every move comes with a reason.<\/h1>/);
    expect(markup).toMatch(
      /type-lead[^>]*>Smart Warehouse Planner reads your warehouse exports and suggests which parts to move where. You decide each one.</,
    );
    const actions = markup.slice(markup.indexOf("data-front-page-actions"));
    const logIn = anchor(actions, "Log in");
    expect(logIn).toContain(`href="${LOGIN_HREF}"`);
    expect(logIn).toContain("bg-ink"); // primary
    const signUp = anchor(actions, "Create account");
    expect(signUp).toContain(`href="${SIGNUP_HREF}"`);
    expect(signUp).toContain("bg-surface text-ink border border-ink"); // secondary
    expect(actions.indexOf("Create account")).toBeLessThan(actions.indexOf("Demo slot"));
    expect(markup).toContain("Demo version skips the login and opens the app with a demo account.");
  });

  it("nfr5_bin_wall_is_one_labelled_image_with_codes_best_tags_and_the_reason_card", () => {
    expect(markup).toContain(
      'role="img" aria-label="A shelf wall in aisle G, section 14: part 4410281 lifted out of level 4 and moved to an empty best location on level 1."',
    );
    expect(markup).toContain("Aisle G · Section 14");
    for (const code of Object.values(CLASS_CODES)) expect(markup).toContain(`>${code}</text>`);
    expect(markup.match(/data-best-tag=""/g)).toHaveLength(2);
    expect(markup).toContain('data-lifted=""');
    expect(markup).toContain('stroke-dasharray="4 3"');
    expect(markup).toContain("var(--color-accent)");
    const card = text(markup.slice(markup.indexOf("data-reason-card")));
    for (const line of ["RULE 1 · MOVE 1", "4410281", "Brake pads, front", "61 picks in 12 months", "sits on L4, not best", "→ G-14-01-04, best location"]) {
      expect(card).toContain(line);
    }
  });

  it("nfr5_four_numbered_panels_in_order_with_static_illustrations", () => {
    const flow = markup.slice(markup.indexOf('id="how-it-works"'));
    expect(flow).toMatch(/<h2[^>]*>One part, start to finish<\/h2>/);
    expect(flow).toContain("<ol");
    const titles = [...flow.matchAll(/<h3[^>]*>([^<]+)<\/h3>/g)].map((match) => match[1]);
    expect(titles).toEqual(FLOW_PANELS.map((panel) => panel.title));
    expect(titles).toEqual(["In your export", "Classified fast", "You decide", "On the move list"]);
    for (const n of [1, 2, 3, 4]) expect(flow).toContain(`data-flow-panel="${n}"`);
    const words = text(flow);
    for (const subtitle of FLOW_PANELS.map((panel) => panel.subtitle)) expect(words).toContain(subtitle);
    expect(flow).toMatch(/data-highlighted=""[^>]*>.*4410281.*G-14-04-02.*61/);
    for (const piece of ["3301877", "B-07-04-03", "5520114", "C-03-03-01", "6612040", "D-11-04-01"]) {
      expect(words).toContain(piece);
    }
    expect(words).toContain("picks in the last 12 months");
    expect(words).toContain("Nothing changes until you apply it.");
    expect(words).toContain("Move list · Spring re-slot 2026");
    expect(words).toContain("ROUND 1");
    expect(words).toContain("A-02-01-02");
    expect(words).toContain("A-03-02-01");
    // Nothing in the panels is a control.
    expect(flow).not.toMatch(/<(button|a|input|select)\b/);
  });

  it("nfr5_no_footer_notice_or_links_beyond_the_three_ways_in", () => {
    expect(markup).not.toContain("<footer");
    expect(markup).not.toMatch(/README|synthetic|demo data|customers|saved \d|metres/i);
    expect(markup).not.toContain("!");
    expect([...markup.matchAll(/<a [^>]*href="([^"]+)"/g)].map((match) => match[1]).sort()).toEqual(
      ["#content", "#how-it-works", LOGIN_HREF, LOGIN_HREF, SIGNUP_HREF].sort(),
    );
  });
});

describe("nfr5 the shell steps aside on the front page", () => {
  function shell(): string {
    const queryClient = new QueryClient();
    const wrap = (children: ReactNode) => (
      <QueryClientProvider client={queryClient}>
        <CommandsProvider effects={{ notify: vi.fn(), navigate: vi.fn(), sessionExpired: vi.fn(async () => {}) }}>
          {children}
        </CommandsProvider>
      </QueryClientProvider>
    );
    return html(wrap(<AppShell account={<span>Avatar</span>}>page</AppShell>));
  }

  it("nfr5_shell_renders_only_the_page_on_slash", () => {
    nav.pathname = "/";
    expect(shell()).toBe("page");
    nav.pathname = SAVED_PLANS_HREF;
    const full = shell();
    expect(full).toContain("<header");
    expect(full).toContain("Skip to content");
    expect(full).toContain('<main id="content"');
    expect(full).toContain("Avatar");
  });
});
