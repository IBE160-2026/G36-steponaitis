// Session expiry on the client (FR-40, AD-12, Story 9.3): when the session ends while the app is
// open (expiry, deleted user, Log out in another tab), a 401 GET or command calls `expire` with the
// page that was open and the user who was logged in, and Log in opens. Commands wait on the
// returned promise, holding their body. After a successful Log in (or Create account) `restore`
// hands back that page and lets every waiting command go, telling it whether the same user logged
// back in (Story 16.0): a change held for one user is never saved under another user's name.
// Framework-free and memory-only: a reload while waiting forgets all of it.

import { isAuthPath } from "@/lib/view-state/urls";

/**
 * Who logged in after the session ended: the user who was logged in when it ended, or someone else.
 * An unknown previous or new user counts as someone else.
 */
export type ResumeVerdict = "same-user" | "other-user";

export class SessionExpiry {
  private href: string | null = null;
  private user: string | null = null;
  private userRecorded = false;
  private waiters: Array<(verdict: ResumeVerdict) => void> = [];

  /**
   * Remember `href` (the first non-auth page since the last restore) and `user` (the user logged in
   * when the session first ended since the last restore; null when unknown), and return a promise
   * that resolves on the next `restore()`.
   */
  expire(href: string, user: string | null = null): Promise<ResumeVerdict> {
    if (this.href === null && !isAuthPath(href.split(/[?#]/)[0])) this.href = href;
    if (!this.userRecorded) {
      this.user = user;
      this.userRecorded = true;
    }
    return new Promise<ResumeVerdict>((resolve) => {
      this.waiters.push(resolve);
    });
  }

  /**
   * The remembered page (or null); clears it and lets every waiting command go with
   * `"same-user"` only when `user` (who just logged in) is exactly the remembered user.
   */
  restore(user: string | null = null): string | null {
    const href = this.href;
    const waiters = this.waiters;
    const verdict: ResumeVerdict =
      this.user !== null && user !== null && this.user === user ? "same-user" : "other-user";
    this.href = null;
    this.user = null;
    this.userRecorded = false;
    this.waiters = [];
    for (const resolve of waiters) resolve(verdict);
    return href;
  }

  /** True while some command waits for the next Log in. */
  isWaiting(): boolean {
    return this.waiters.length > 0;
  }
}

/** The app's one coordinator, shared by the query error hook, the command client and Log in. */
export const sessionExpiry = new SessionExpiry();
