# jackeliason.com

The personal site and essay ledger of Jack Eliason. The essays are the permanent record; everything else is a snapshot of the present.

Next.js (App Router), TypeScript, and Tailwind CSS. Every page is generated at build time from Markdown in `content/`. There is no database or CMS: essays are files in the repository, written in an editor or on the site itself (see [Writing from the site](#writing-from-the-site)).

## Local development

Requires Node.js 20.9 or later.

```bash
npm install
npm run dev        # http://localhost:3000, drafts visible
npm run build      # production build; validates all content
npm run start      # serve the production build
npm run typecheck
npm run lint
```

```
app/(site)/       the site's routes and root layout: /, /essays, /essays/[slug], /now, /library, /write
app/(meros)/     Meros, the private habit game at /meros (its own root layout; see "Meros" below)
app/              shared: rss.xml, sitemap, robots, icons, editor API, global 404
components/       Header, Footer, EssayList, SubscribeForm, Prose (components/meros: the game's UI)
content/essays/   one Markdown file per essay
content/now.md    the Now page
lib/config.ts     identity, ventures, links, newsletter: edit this, not components
lib/content.ts    loads and validates content
assets/fonts/     fonts for preview images
```

## Publishing an essay

1. Create `content/essays/<slug>.md`. The filename is the URL: `on-simplicity.md` becomes `/essays/on-simplicity`. Use lowercase letters, numbers, and hyphens.
2. Add frontmatter:

   ```yaml
   ---
   title: "On Simplicity"
   date: "2026-11-23"
   summary: "A brief examination of simplicity as a governing principle."
   updated: "2026-12-01"   # optional; shows "Updated 2026-12-01"
   draft: true             # optional; defaults to false
   ---
   ```

3. Write the essay in Markdown below the frontmatter.
4. Commit and push to `main`. Vercel builds and deploys it.

Nothing else needs registering. The essay appears on the homepage (five most recent), the archive, the RSS feed, and the sitemap, and gets its own preview image.

The `summary` is used for search descriptions, link previews, and RSS. It is not shown on the page.

**Writing.** Start sections at `##`; the title is already the page's heading. Supported: headings, emphasis, links, block quotes, lists, horizontal rules (`---`), code blocks, tables, and footnotes:

```markdown
A claim that needs a source.[^1]

[^1]: The source.
```

Raw HTML is not rendered.

**Images.** Put files in `public/essays/<slug>/` and reference them by filename or full path:

```markdown
![A description of the image](photo.jpg)
![A description of the image](/essays/on-simplicity/photo.jpg)
```

The build fails if an image is missing, and sizes each image so it never shifts the page.

**Validation.** The build stops with a message naming the file and field if frontmatter is wrong: a missing title, date, or summary; a date that is not a real `YYYY-MM-DD` date; `updated` earlier than `date`; `draft` written as text (`"true"`) instead of `true`; an unknown field (so a typo like `darft: true` cannot publish a draft by accident); or two files with the same slug.

**Dates.** Essays are ordered newest first by `date`, then by filename. There is no scheduled publishing: a non-draft essay goes live on the next deploy, whatever its date.

### Drafts

Add `draft: true`. In `npm run dev`, drafts appear everywhere with a **Draft** label so you can preview them. Production builds leave them out completely: no page, no preview image, and absent from the homepage, archive, RSS, and sitemap. Delete the line (or set `draft: false`) to publish.

## Writing from the site

The **+** in the corner of the Essays page writes a new essay; on an essay's own page it edits that essay. It asks for a password, then opens the editor at `/write`. **Publish** commits the essay to `content/essays/` on `main` through the GitHub API, so Vercel deploys it like any push: it is live about a minute later. Tick **Draft** to save without publishing.

The editor checks every essay against the same rules as the build before it saves, so it cannot commit an essay that would break a deploy. If an essay changed since you opened it, the save is refused rather than overwriting the newer version. An essay keeps its URL once published, so links to it never break.

### Setup (once)

1. **A GitHub token.** GitHub → Settings → Developer settings → Fine-grained tokens → **Generate new token**. Repository access: **Only select repositories** → `jackeliason`. Permissions: **Contents: Read and write** (nothing else). Copy the token.
2. **Vercel.** Project → **Settings** → **Environment Variables**, for Production:
   - `EDITOR_PASSWORD`: a long passphrase only you know. It is checked on the server and never sent to the browser.
   - `GITHUB_TOKEN`: the token from step 1.
3. **Redeploy** (Deployments → the latest → Redeploy) so the settings take effect.

Until both are set, the + still appears, and the password prompt explains what's missing. Changing `EDITOR_PASSWORD` signs out every session. A session lasts 12 hours.

## The Library

`/library` shows books you've read and music you love as two carousels: the centre item largest, one smaller and angled on each side; scroll or swipe sideways for more. Edit the lists in `lib/library.ts`:

- **Books:** `{ title, author, cover }`. `cover` is an image in `public/library/books/` (2:3, about 600px wide), e.g. `cover: "/library/books/walden.jpg"`. A book without a cover gets one set in type.
- **Songs:** `{ title, artist }`. Each becomes a white record reading "TITLE · ARTIST ·" around it as it spins.

The build warns while the template entries (marked `placeholder`) remain.

## Updating the Now page

Edit `content/now.md` and change `updated` to today's date. The page renders whatever `##` sections the file contains.

## Books

- *Walden* — Henry David Thoreau
- [The essay title](https://example.com/essay) — Author
```

## Identity, ventures, and links

Everything about identity lives in `lib/config.ts`: name, description, email, ventures, social links, X handle, podcast, and newsletter. Components read from it; you should never need to edit a component to change who the site is about.

**Backdrop.** `public/backdrop.webp` is the blurred sky-and-wood image fixed behind every page; the reeded-glass stripes over it are CSS (`.backdrop` in `app/globals.css`).

**Title page.** `tagline` is the line under the name on the homepage, one array entry per line.

**The homepage's buttons.** The latest essay and each venture are buttons in one row. At rest a button shows only the essay's title or the venture's logo; hovered (or focused with the keyboard) it widens to 40% of the page and shows its blurb. On touch screens and narrow windows every button shows its blurb. A venture's `blurb` says what it is and `detail` gives the facts (in the accent); the essay button uses the essay's `summary` and date. Logo files live in `public/ventures/` (transparent WebP or PNG, about three times the display size). In each venture's `logo`, `width` and `height` are the file's pixel size and `displayHeight` is its height on the page.

Values still needing your input are marked `TODO:`. Search for `TODO:` to find them. Placeholder text in the config is wrapped in `placeholder("...")`; replace the whole call with a plain string.

`npm run build` prints a warning listing every placeholder still in place: config values, empty optional settings, and content files containing a `TODO:` marker. It warns; it does not fail.

## Newsletter

The subscribe form is a plain HTML form that posts directly to your provider: no script, no iframe. It appears at the end of every essay and on the homepage, and nowhere until configured.

Choose a provider that accepts a plain form post, then set two values in `lib/config.ts`:

| Provider | `formAction` | `emailFieldName` |
|---|---|---|
| Buttondown | `https://buttondown.com/api/emails/embed-subscribe/<username>` | `email` |
| Kit | `https://app.kit.com/forms/<form-id>/subscriptions` | `email_address` |

Copy the exact action URL from your provider's "embed form" or "HTML form" code; providers change these paths occasionally.

## Analytics

Vercel Web Analytics is installed (`@vercel/analytics`). It is cookieless, so no cookie banner is needed. It collects nothing until you enable it: Vercel dashboard → the project → **Analytics** → **Enable**. It only runs on Vercel deployments, never in development.

## Deployment

The site needs no Vercel configuration: no environment variables, build settings, or `vercel.json`.

### First-time setup

From the project folder:

```bash
# 1. Git (skip if the folder is already a repository on branch main)
git init -b main
git add -A
git commit -m "Initial site"

# 2. GitHub: create a private repository and push
gh auth login
gh repo create jackeliason.com --private --source=. --remote=origin --push

# 3. Vercel: import the repository (dashboard), or with the CLI:
npm install --global vercel
vercel login
vercel link --yes          # creates the Vercel project
vercel git connect         # links the GitHub repository for automatic deploys
vercel --prod              # first production deploy
```

Or import from the dashboard: [vercel.com/new](https://vercel.com/new) → **Import** the `jackeliason.com` repository → **Deploy**. Vercel detects Next.js; keep every default.

### Production branch

Vercel → project → **Settings** → **Git**: the production branch should be `main`. Every push to `main` deploys to production; pushes to other branches get preview URLs.

### Domain

1. Vercel → project → **Settings** → **Domains** → add `jackeliason.com`.
2. Add `www.jackeliason.com` as well and choose **Redirect to `jackeliason.com`** (permanent, 308). The apex is primary and canonical.
3. At your domain registrar, create the DNS records Vercel displays for each domain (an `A` record for the apex, a `CNAME` for `www`). Use the exact values Vercel shows; they can change.
4. Wait for both domains to show **Valid Configuration**. Vercel issues HTTPS certificates automatically.

### Confirming automatic deploys

Push any commit to `main`, then open Vercel → project → **Deployments**. A new production deployment should appear within seconds, built from that commit, and https://jackeliason.com should reflect the change once it finishes.

## Meros (the /meros tab)

**Meros** (pronounced *MAY-ross*) is a private, single-user, mobile-first habit RPG at `/meros`, linked from the site's nav. The name lives in one place, `APP_NAME` in `lib/meros/config.ts`.

The look is deliberate: near-black surfaces, bone-white type, deep blood red (`#8a0f1a`) as the brand and primary action color, and gold reserved for victory and levels. Display type is Barlow Condensed in caps; body type is Inter. All tokens are in `app/(meros)/meros.css`.

The behavior it reinforces is **showing up**. Each quest has a small, observable minimum action (open the textbook, set out the running shoes, walk into the gym). A minimum verified with a fresh in-app photo or a GPS check-in earns half the quest's XP immediately, progress toward a treasure chest (one per three minimums), and a Ventures ticket. Optional extra work is self-rated and never required. XP comes only from real-world quests: chests, battles, the estate, and app opens never grant it.

It has its own root layout and stylesheet (`app/(meros)/layout.tsx`, `app/(meros)/meros.css`), so it shares nothing visual with the site. Because the two root layouts differ, unmatched URLs use `app/global-not-found.tsx` (`experimental.globalNotFound` in `next.config.ts`).

### Try it without any setup: demo mode

Open `/meros` and choose **Explore the demo**. The real game rules run in your browser on a synthetic, two-week-old account saved to `localStorage`. Demo photo checks use a local stand-in (not AI), demo GPS can simulate arriving, and Profile has **Skip a day** to watch windows close, misses, and recovery. Demo data never touches a server or an account; the production database rejects demo verification rows outright (`demo = false` check).

### Architecture

```
lib/meros/config.ts       name, versioned XP/consequence/timing/GPS/ticket/battle rules
lib/meros/domain/         pure rules: levels, xp, schedule + DST, momentum/vitality, geofence, loot, estate, stats, battle engine
lib/meros/content/        50 quest templates, items, estate areas, 12 battle scenarios, appearance catalog
lib/meros/service/        game service: commands, catch-up/miss processing, awards, verification flow, views
lib/meros/store/          Store interface; memory (demo, tests) and Postgres (production, PGlite tests)
lib/meros/server/         auth + allowlist, DB driver, private storage, image processing, vision adapter selection
lib/meros/verify/         vision adapter boundary + Anthropic (Claude) adapter with structured-output validation
lib/meros/client/         live API client, in-browser demo client, sound effects
components/meros/         UI: screens, character and estate art (original SVG), sheets
supabase/migrations/       schema, constraints, append-only ledgers, RLS, storage policies, hardened functions
supabase/seed.sql          generated from lib/meros/content (npm run meros:seed)
```

Every mutation is one Postgres transaction holding a per-owner advisory lock. Requests carry an idempotency key (`command_receipts`), and every balance change is an immutable ledger row with a unique source id (`xp_events`, `wallet_events`, `ticket_events`, `consequence_events`), so retries, double taps, and concurrent requests can't double-award. `meros.ledger_drift(owner)` reconciles cached balances with their ledgers. The browser can only read its own rows (RLS) and can't write anything authoritative.

### Setup (once)

1. **Supabase project.** Create one at supabase.com. In **Authentication → Sign In / Providers → Email**, keep email enabled and **turn off "Allow new users to sign up"** (Meros never creates accounts).
2. **Email template.** In **Authentication → Emails → Magic Link**, make sure the template includes the 6-digit code, `{{ .Token }}`. Meros signs in with codes because an installed iPhone web app has storage separate from Safari, so a link would sign in the wrong place.
3. **First owner.** **Authentication → Users → Add user → Create new user** with your email (no password needed). Put the same email in `MEROS_OWNER_EMAILS`. The server keeps the database allowlist (`meros.owner_allowlist`, used by RLS) in step with that variable on each sign-in.
4. **Migrations and seed.** With the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started): `supabase link --project-ref <ref>`, then `supabase db push` (runs `supabase/migrations`) and run `supabase/seed.sql` (SQL Editor, or `psql "$MEROS_DATABASE_URL" -f supabase/seed.sql`). The storage migration creates the private `meros-evidence` bucket.
5. **Keys.** Copy `.env.example` to `.env.local` and fill in: project URL and publishable key (**Project Settings → API Keys**), the secret key (server-only, for private storage), the **transaction pooler** connection string from **Connect** (port 6543) as `MEROS_DATABASE_URL`, your owner email, and `CRON_SECRET`.
6. **Photo verification.** Set `MEROS_VISION_PROVIDER=anthropic`, `ANTHROPIC_API_KEY`, and optionally `MEROS_VISION_MODEL` (default `claude-opus-5-5`). Without a provider, photo check-ins are **unavailable** (fail closed), never auto-accepted; GPS quests still work. `MEROS_VISION_PROVIDER=test` accepts every photo for local development only and is refused when `NODE_ENV=production`.
7. **Vercel.** Add the same variables under **Settings → Environment Variables** (Production), then redeploy. `vercel.json` schedules `/meros/api/cron` daily (Vercel sends `CRON_SECRET` as a Bearer token); on a paid plan you can make it hourly. Missing a run is harmless: opening the app runs the same idempotent catch-up.

Until steps 1–7 are done, `/meros/sign-in` lists exactly which settings are missing and offers the demo.

### Local development

```bash
npm install
npm run dev                 # http://localhost:3000/meros (demo works with no .env.local)
npm test                    # domain, service, Postgres/RLS (in-process PGlite), vision, image, balance tests
npm run build && npm run test:e2e   # Playwright: the full loop on an iPhone-sized viewport, demo mode
npm run meros:balance      # writes docs/meros/balance-report.md
npm run meros:types        # regenerates lib/meros/db/database.types.ts from the migrations
npm run meros:seed         # regenerates supabase/seed.sql after editing content
npm run meros:icons        # regenerates the PWA icons
```

Camera and geolocation need a secure context: `localhost` works; on a phone, use the HTTPS deployment (or an HTTPS tunnel).

### Install on iPhone

Open `https://jackeliason.com/meros` in Safari → Share → **Add to Home Screen**. Open it from the Home Screen and sign in there with an emailed code. It runs standalone with its own manifest (`/meros/manifest.webmanifest`) and service worker (`/meros/sw.js`, scope `/meros/`). Offline, the last-synced day is viewable with a stale-data banner; check-ins, chest openings, and claims need a connection and are never queued. Authenticated API responses and evidence are never cached by the service worker; the cached last view lives in the page's own storage and is cleared on sign-out. Updates install in the background and apply when you tap **Update**. Web push and background location aren't used.

### Rules worth knowing

- **Schedules:** every day, chosen weekdays, or N per week (1–7 slots on different days; an unmet week is **one** miss; each completed day still pays; the miss count resets only when the target is met). Windows can cross midnight. Each occurrence freezes its time zone, window, rubric, and XP rules; edits and time-zone changes affect only the future. No occurrences are created before activation, during a pause, or with under an hour of window left. DST: a nonexistent time moves forward past the gap; an ambiguous time uses the first occurrence.
- **XP:** max XP per quest is an even number 2–40 (default 20). Verified minimum = half, immediately. Optional effort: round(rating/10 × half), self-rated, once. Level 10 = 2,700 XP; the curve continues with rising costs through Level 30.
- **Consequences** (configurable, future-only): misses 1–2 nothing; 3–4 pause that quest's momentum bonus; 5th −2, 6th −3, 7th+ −4 vitality; at most −6 per day; never below 40. Each verified minimum restores +10 (max +20/day). Deterioration affects only vitality, visible energy, and a 0.80–1.00 battle multiplier, never XP, level, buildings, items, or rewards. Rest days, pauses, technical problems, and skipped optional work are never misses.
- **Verification:** photo = live camera only (no gallery), a 10-minute server challenge bound to the occurrence, server-side byte validation and metadata stripping, exact-reuse rejection, AI judgement of the quest's visible criteria only. GPS = the whole accuracy circle must fit inside the area (default 150 m); edge overlaps ask for a retry. Evidence submitted inside a window can resolve for 24 hours after it closes; if the checker is down that long, the day is excused, not missed. No evidence method is cheat-proof; it's a commitment device, and the app says so.
- **Evidence and privacy:** photos are stored privately under your user id, deleted after 7 days by the cron (decision records stay), and can be deleted any time in Profile. They are sent to the configured AI provider for checking, and that provider's own data-retention terms apply to what it receives (Anthropic API inputs are retained per your Anthropic account's commercial terms; Meros cannot delete provider-side copies). GPS check-ins store distance and accuracy, not coordinates. Logs never include images, keys, or evidence.
- **Real-world rewards** are self-funded entitlements you define (money allocation, gift card, experience) unlocked by level or minimum count. Meros records claims; it never moves money or buys anything. With a monthly budget set, a money claim must fit what's left this month.

See `docs/meros/VERIFICATION.md` for what has and hasn't been tested, and `docs/meros/balance-report.md` for the economy simulation.
