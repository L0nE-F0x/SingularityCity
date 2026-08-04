# Archive — the SingularityCityFirstPerson sandbox

First Person was built in a separate repo (`Desktop/SingularityCityFirstPerson`)
that carried a vendored copy of the 2D app so the two could be tested together.
That repo has been folded into this one and is being deleted.

These are its working documents, kept because they hold **decisions**, not just
status. Nothing here is current; treat it as history. Live docs are
[`../../README.md`](../../README.md) and
[`../../PARITY-AUDIT.md`](../../PARITY-AUDIT.md).

| File | Why it was kept |
|---|---|
| `PARITY.md` | The owner backlog, deliberate non-goals, and deferred decisions — including orbit mode being **closed on purpose** (the 2D app covers that view; `orbit_mode.js` stays a stub). Worth reading before "fixing" something that was dropped intentionally. |
| `HANDOFF.md` | Longest-running session log; context on why parts of the port look the way they do. |
| `RESUME.md` | Final sandbox handoff. Its architecture gotchas were carried into `first-person/README.md` — that copy is the live one. |
| `INTEGRATION.md` | The original two-repo integration plan. Superseded: it proposed pushing the sandbox over production, which is the opposite of what was done. |
| `SANDBOX-README.md` | The sandbox's own README. |

One correction worth flagging, since `INTEGRATION.md` states the opposite: the
merge went **sandbox → production**, as `first-person/`, leaving the 2D app at
the site root. The plan in that file to overwrite production with the sandbox
tree was not followed — production had moved on, and its git history, Netlify
functions, CSP and build tooling all live here.
