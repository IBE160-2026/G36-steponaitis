# Goal command: autonomous build of Epics 1–12

## Before you start

1. Push everything: `! git push origin main`
2. Restart Claude Code so `.claude/settings.json` is loaded.
3. Start Docker Desktop and run `! .claude/scripts/preflight-autonom.sh`. It must say `READY`.
4. Test-run Story 1.1 on its own first:
   > Follow `.docs/implementation-artifacts/autonomous-run.md` for one iteration only (Story 1.1, including the special step after 1-1), then stop.
5. Check `/help` to make sure `/goal` takes free text in your version.
6. Keep the Mac awake and plugged in (for example `caffeinate -dis` in a separate terminal).

## The command

Paste this into a fresh session:

```
/goal Build Epics 1–12 of Smart Warehouse Planner unattended by following the runbook .docs/implementation-artifacts/autonomous-run.md exactly.

Rules:
- Re-read autonomous-run.md at the start of every iteration and after every context compaction. It wins over anything in this goal.
- One story per iteration, in sprint-status.yaml order. Each story is built by a fresh general-purpose subagent running bmad-build-auto. Wait for its result notification before doing anything else.
- After each story: update sprint-status.yaml, commit, write the sesjonslogg log in Norwegian, and push to origin main.
- After the last story of each epic: run bmad-retrospective -H in a fresh subagent, then commit and push.
- Check CI on main before each new story (from Story 1.2 on), and follow the runbook's single-fix rule.
- Milestone gates 5-8 and 12-5 must pass in chromium, firefox and msedge.
- Never deploy, never touch Vercel or Supabase, never use data/private or real company data, never edit data/sample or data/answer-key, never force-push, reset --hard or rebase. Epics 13–16 are out of scope.

The goal is complete when either:
(a) DONE: every story and epic in Epics 1–12 is "done" in sprint-status.yaml, the epic 12 retrospective is committed, CI is green on main, the final log autonom-kjoring-epic-1-12 is pushed, and the user has been notified as in the runbook's Finish section; or
(b) STOPPED: a story is blocked or CI stays red after one fix, and the runbook's Stop section has been carried out (the blocked story is left as it is, the log and issues.md are updated and pushed, and a push notification is sent with the story key and the blocking condition).
```

## Following the run

- Progress: `.docs/implementation-artifacts/sprint-status.yaml`
- Logs and open points: `.logs/justas/` and `.logs/justas/issues.md`
- CI: `gh run list -w ci.yml -b main`
