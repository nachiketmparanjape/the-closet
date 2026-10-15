# Tech-debt registry — entries

Newest first. Each entry: date, shortcut, why, paydown shape.

---

## 2026-10-15 — Firebase CLI broken from this VM; deploys go via direct REST calls

**Shortcut:** `describeItem` (PC-6) was deployed via hand-rolled REST
calls (`deploy-*.js` scripts) instead of `firebase deploy`, because this
VM's egress mangles the Firebase CLI's empty-body POSTs (HTTP 411).

**Why:** unblocked the deploy without waiting on a network fix that may
never come.

**Paydown:** if the VM is replaced or the egress issue is fixed, delete
the `deploy-*.js` scripts and return to plain `firebase deploy`. Trigger
to revisit: any failed deploy, or a fresh VM. Until then: accepted,
documented.

---

## 2026-10-15 — Registry seeded (pilot start)

No code debt logged yet — the discipline starts with PC-7's remaining
work. This entry exists so the pilot's day one is honest: an empty
registry on day one is expected, on day fourteen it's a kill signal.
