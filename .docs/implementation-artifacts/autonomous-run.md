# Autonomous run: Epics 1–12

The runbook for the unattended build loop started with the goal command. Decisions by the user on 2026-11-19. Re-read this file at the start of every iteration, also after a context compaction.

## Scope and decisions

- **Scope:** Epics 1–12 (milestones 1 and 2), in the order of `.docs/implementation-artifacts/sprint-status.yaml`. Epics 13, 14, 15 and 16 are **out of scope**. Epic 16 is the deployment and waits for the user's approval of the website.
- **Branch:** work directly on `main`. Commit after each story and push to `origin main` once the story is done and its local checks pass.
- **Milestone gates:** Story 5.8 (M1) and Story 12.5 (M2) are recorded in the session log by the loop itself when every check in the story passes. If any check fails, the run stops.
- **Blocked story:** stop the whole run and notify the user. Never skip a story, because later stories build on it.
- **Retrospectives:** after the last story of each epic, run `bmad-retrospective` headless (`-H`).
- **Session log:** one `sesjonslogg` log per story, in Norwegian like the existing logs. The skill commits it; the loop pushes.
- **Never:** deploy or run the Vercel CLI; touch Vercel or Supabase; use `data/private/` or real company data; edit `data/sample/` or `data/answer-key/`; force-push, `reset --hard` or rebase; change planning artifacts unless the story itself says so.

## One iteration

1. **Preflight.** Run `.claude/scripts/preflight-autonom.sh`. On `NOT READY`, try one fix if it is mechanical (`git pull --ff-only` when only behind origin; `open -a Docker` and wait up to 2 minutes when Docker is down). Otherwise stop (see *Stop*).
2. **CI of the previous push.** From Story 1.2 on, check the latest `ci.yml` run on `main` (`gh run list -w ci.yml -b main -L 1`). If it is still running, wait for it (`gh run watch <id>`, up to 20 minutes). If it failed, run **one** fix: a fresh subagent runs `bmad-build-auto` with the intent "Fix the failing CI run <id> on main: <failing job and the error lines>". Then push and check again. If it is still red, stop.
3. **Pick the story.** In `sprint-status.yaml`, take the first story key of Epics 1–12, in file order, whose status is not `done`. If none is left, go to *Finish*.
4. **Mark it started.** Set the story to `in-progress` and its epic from `backlog` to `in-progress`, update `last_updated`, and keep comments and structure. Commit only that file with `Sprint: start <story-key>`. `bmad-build-auto` needs a clean tree.
5. **Build it in a fresh subagent.** Launch one `general-purpose` subagent with this prompt, filling in the story number, title and key:

   > Invoke the skill `bmad-build-auto` with this intent: "Story <N.M>: <title> from `.docs/planning-artifacts/epics/epics-Project-2026-11-17/epics.md` (sprint key `<story-key>`)". Follow the skill exactly until it HALTs. Then reply with only: the final status, the spec file path, the full hashes of the commits made in this run, the commands used for verification and their results, and the blocking condition if any.

   Wait for the subagent's result notification before doing anything else. Do not read the diff in this session; keep only the subagent's summary.
6. **Check the result.**
   - Read the spec file's frontmatter `status` and run `git status --porcelain`.
   - Leftover files under `.docs/implementation-artifacts/` are expected: the spec, `epic-<N>-context.md` and triage notes may be untracked. Commit them in step 7.
   - A HALT with `finalization left repository dirty` counts as done when the spec status is `done` and the only dirty files are under `.docs/implementation-artifacts/`.
   - Otherwise the story counts as **done** only if the status is `done`, no file outside `.docs/implementation-artifacts/` is dirty, and at least one commit was made after step 4.
   - Any other outcome means the story is **blocked**: go to *Stop* with the blocking condition from the spec's `## Auto Run Result`.
7. **Record it.**
   - Set the story to `done` in `sprint-status.yaml`.
   - If every story of its epic is now `done`, set the epic to `done`.
   - Commit it together with the leftover files under `.docs/implementation-artifacts/`, with the message `Sprint: <story-key> done`.
   - Run the `sesjonslogg` skill for the story. Use the title `<story-key>` and record the spec path, the commit hashes and the verification. Put real open points from the spec's deferred findings in `issues.md`.
   - Push: `git push origin main`.
8. **Special stories.**
   - After **1-1**: run `bmad-project-context` in a fresh subagent so `AGENTS.md` lists the real install, dev, lint and test commands. Commit and push it. Then add `"file:AGENTS.md"` to `persistent_facts` in `_bmad/custom/bmad-build-auto.toml`, and commit and push that too.
   - After **1-2**: CI must be green on `main` before the next story starts (step 2). A throwaway branch for the deliberate violation must be deleted again.
   - **5-8 and 12-5 (gates):** the story's checks include Playwright in `chromium`, `firefox` and `msedge`. If Microsoft Edge is missing, stop with the blocking condition "Microsoft Edge is not installed". After the story is done, the session log states "Milestone N gate passed" with the test summary. For 12-5, the log adds the open point "Someone else must run the README flow before submission (SM-2)."
9. **End of epic.** When an epic turns `done`, launch a fresh subagent with: "Invoke the skill `bmad-retrospective` with `-H` for epic <N>." Commit its output, then push. Open action items stay in `sprint-status.yaml` and are not worked on unless a later story needs them.
10. **Next.** Continue with step 1 for the next story.

## Stop

- Leave the blocked story as it is (`in-progress`, its spec and any patch files kept).
- Commit what the run left, but only files under `.docs/implementation-artifacts/`.
- Write the session log with the blocking condition and add it to `issues.md` as an open point. Then push.
- Send the user a push notification: "Autonomous run stopped at <story-key>: <blocking condition>". Load the `PushNotification` tool through ToolSearch first.
- Then end the goal and report the same in the conversation.

## Finish

When Epics 1–12 are `done` and the epic 12 retrospective is committed:

- Run the preflight once more, and confirm CI is green on `main`.
- Write a final session log, titled `autonom-kjoring-epic-1-12`, with the story count, the gates and the open points.
- Push.
- Notify the user: "Epics 1–12 are done. The app is ready for your review locally: `npm install` and `npm run dev` in the repo root, then http://localhost:3000. Deployment (Epic 16) waits for your approval."
- End the goal.
