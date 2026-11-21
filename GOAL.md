/goal Build Epics 1–12 of Smart Warehouse Planner unattended by following the runbook .docs/implementation-artifacts/autonomous-run.md exactly.

Rules:
- Re-read autonomous-run.md at the start of every iteration and after every context compaction. It wins over anything in this goal, except for the blocked-story rule below.
- One story per iteration, in sprint-status.yaml order. Each story is built by a fresh general-purpose subagent running bmad-build-auto. Wait for its result notification before doing anything else.
- After each story: update sprint-status.yaml, commit, write the sesjonslogg log in Norwegian, and push to origin main.
- After the last story of each epic: run bmad-retrospective -H in a fresh subagent, then commit and push.
- Check CI on main before each new story (from Story 1.2 on), and follow the runbook's CI fix rule (up to 20 fix attempts).
- Milestone gates 5-8 and 12-5 must pass in chromium, firefox and msedge.
- Never deploy, never touch Vercel or Supabase, never use data/private or real company data, never edit data/sample or data/answer-key, never force-push, reset --hard or rebase. Epics 13–16 are out of scope.
- commit and push after each story and merge epics to 'main' når CI is green. 
- Blocked story: before the runbook's Stop section, try to unblock the same story yourself, up to 20 fix attempts, each in a fresh subagent running bmad-build-auto. Log every attempt and its outcome in issues.md. Never skip a story.
 

The goal is complete when either:
(a) DONE: every story and epic in Epics 1–12 is "done" in sprint-status.yaml, the epic 12 retrospective is committed, CI is green on main, the final log autonom-kjoring-epic-1-12 is pushed, and the user has been notified as in the runbook's Finish section.
All users journeys have to be done via playwright, so all wanted funkcions on the webside are tested: totall implementation of the whole webside, users, warehouse features and etc;
or
(b) STOPPED: a story is still blocked after 20 fix attempts, CI stays red after 20 fix attempts, or an action requires a new account, any purchase or any product not listed; and the runbook's Stop section has been carried out (the blocked story is left as it is, the log and issues.md are updated and pushed, and a push notification is sent with the story key and the blocking condition).