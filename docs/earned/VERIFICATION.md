# Earned: verification report

What was checked for this version, how, and what still needs credentials or a real iPhone. "Earned" is a provisional working title.

## Ran locally (all passing)

| Check | Command | Result |
|---|---|---|
| Type checking (strict) | `npm run typecheck` | Clean |
| Lint | `npm run lint` | Clean |
| Production build | `npm run build` | Succeeds with no Earned env vars set (live routes report what's missing; demo works) |
| Domain, service, database, vision, image, balance tests | `npm test` | 91 tests in 10 files |
| End-to-end (Playwright, Chromium, iPhone 13 viewport, demo mode) | `npm run build && npm run test:e2e` | 3 tests |
| Balance simulation | `npm run earned:balance` | `docs/earned/balance-report.md` |

### Coverage of the required test areas

- **XP curve:** cumulative totals and reference days for levels 2–10, Level 10 = 2,700 XP, strictly increasing marginal costs through Level 30, multi-level jumps (`levels-xp.test.ts`).
- **Minimum/optional:** minimum-only success, half-up rounding of the self-rated bonus (including odd halves), abandonment without loss, expiry at the window's close, one award per session (`levels-xp`, `service`).
- **Duplicates/concurrency:** concurrent identical requests replay, a reused key for another command is refused, a second completion of the same occurrence is refused, chest opens race to one outcome, concurrent estate purchases and budget claims serialize correctly (`service`). Postgres serializes per owner with a transaction-scoped advisory lock; the same code runs on real SQL in `db.test.ts`.
- **AI outcomes:** accepted / rejected / inconclusive / unavailable, retry within grace awards once, excused after grace, exact image reuse rejected without a provider call, perceptual similarity flagged only, structured-output validation, refusals/truncation/malformed output/transport errors → unavailable, a model swayed by text in the image still can't accept without every criterion (`service`, `vision-image`).
- **Geofence:** inside/outside/boundary, accuracy wider than the zone, poor accuracy, stale, future-dated, invalid and implausible readings (`time-geo`).
- **Time:** occurrence windows, cross-midnight windows, weekly quotas (one slot per day, one miss per unmet week, partial rewards), DST gap and overlap rules, DST-day window lengths, schedule edits affecting only the future, prospective pauses and resume, no retroactive occurrences, delayed verification (`time-geo`, `service`).
- **Consequences:** misses 1–11 in order after a long absence, −2/−3/−4 ladder, 6/day cap across quests, floor at 40, recovery (+10 each, +20/day cap), momentum activation/suspension/comeback, repeated catch-up idempotent (`momentum-loot`, `service`).
- **Chests:** one per three minimums across days, exactly-once opening with a saved outcome, duplicate conversion, odds summing to 100% (`momentum-loot`, `service`).
- **Auth/RLS:** owners read only their own rows; anonymous and non-allowlisted sessions get nothing; client writes to balances, verification decisions, chest outcomes, penalties, and battle seeds are denied; capture tokens/receipts/allowlist are server-only; private storage folder isolation; append-only ledgers (update/delete/truncate) for every role; XP requires a completed occurrence; cross-account foreign keys rejected; demo verification rows rejected; every function has a pinned `search_path`; cached balances reconcile with ledgers (`db.test.ts`, on PGlite with the real migrations).
- **Estate:** level gates, prerequisites, insufficient funds, concurrent purchases (`service`).
- **Ventures:** ticket caps (2/day, 6 stored), one ticket per rewarded battle, resume without a second charge, replayed and conflicting round submissions, rewards exactly once, practice without rewards, round legality, determinism across reloads, counters and builds change the best move, informed play beats autopilot in all 12 scenarios and still at high levels (`battle`, `service`).
- **Complete flow (e2e):** template → schedule + evidence → verified minimum → +10 XP → "Done for today" → chest earned and opened → item equipped → estate upgraded → battle started, played, page reloaded mid-battle (resumed, no second ticket), finished → XP unchanged by chest/equipment/estate/battle. Also: first check-in visible without scrolling on an iPhone-sized viewport, no horizontal overflow on any screen, reduced-motion and mute persist.

## Used deterministic or local stand-ins

- **Database:** PGlite (Postgres compiled to WASM) with a small shim for Supabase's `auth`/`storage` schemas and roles (`tests/earned/supabase-shim.sql`). The migrations themselves are unmodified. Real Supabase was not contacted.
- **Vision:** the Anthropic adapter was tested with a mocked SDK client (request shape, output validation, failure mapping). Service-level AI outcomes use scripted verdicts. No real model call was made.
- **Camera:** e2e uses the demo's generated test card; desktop Chromium has no camera. The live-camera code path (getUserMedia, switching, capture) was exercised only by type checking and manual reading.
- **GPS:** e2e uses the demo's "simulate arriving". Geofence math is unit-tested with synthetic readings.
- **Time:** tests use a controllable clock; e2e pins the browser clock.

## Not yet verified (needs credentials or hardware)

- A live Supabase project: migrations via `supabase db push`, email OTP sign-in, RLS against Supabase's real `auth.uid()`, storage upload/download/signed URLs/removal, the pooler connection under load.
- A real Claude vision call: latency, verdict quality on real photos, and behavior with text-in-image injection attempts. Recommended first check: a few deliberate pass/fail photos per template category.
- iPhone field test: Safari camera permission and switching, Precise Location accuracy indoors/outdoors, Add to Home Screen, standalone sign-in, service-worker update flow, offline viewing, safe areas on notched devices, audio after the first tap. A desktop browser simulation is not a substitute.
- Vercel Cron delivery and `CRON_SECRET` handling in production.

## Known limitations

- Verification is evidence, not proof. A determined person can stage a photo or spoof a location; the app says so and doesn't claim otherwise.
- One scoring per habit per local day (template clones share a habit identity). Two genuinely separate sessions of the same template on one day need a custom quest.
- The demo runs the full rules in the browser; its data lives in `localStorage` and can be reset from Profile.
- Rate limiting for sign-in codes is per server instance (Supabase Auth adds its own limits); verification rate limits are stored in the database and apply across instances.
- No push notifications in this version.
