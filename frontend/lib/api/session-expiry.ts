// Session expiry on the client (FR-40, AD-12, Story 9.3): when the session ends while the app is
// open (expiry, deleted user, Log out in another tab), a 401 GET or command calls `expire` with the
// page that was open and Log in opens. Commands wait on the returned promise, holding their body.
// After a successful Log in (or Create account) `restore` hands back that page and lets every
// waiting command go. Framework-free and memory-only: a reload while waiting forgets both.

import { isAuthPath } from "@/lib/view-state/urls";

export class SessionExpiry {
  private href: string | null = null;
  private waiters: Array<() => void> = [];

  /**
   * Remember `href` (the first non-auth page since the last restore) and return a promise that
   * resolves on the next `restore()`.
   */
  expire(href: string): Promise<void> {
    if (this.href === null && !isAuthPath(href.split(/[?#]/)[0])) this.href = href;
    return new Promise<void>((resolve) => {
      this.waiters.push(resolve);
    });
  }

  /** The remembered page (or null); clears it and lets every waiting command go. */
  restore(): string | null {
    const href = this.href;
    const waiters = this.waiters;
    this.href = null;
    this.waiters = [];
    for (const resolve of waiters) resolve();
    return href;
  }

  /** True while some command waits for the next Log in. */
  isWaiting(): boolean {
    return this.waiters.length > 0;
  }
}

/** The app's one coordinator, shared by the query error hook, the command client and Log in. */
export const sessionExpiry = new SessionExpiry();
