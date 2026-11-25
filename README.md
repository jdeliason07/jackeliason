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
app/              routes: /, /essays, /essays/[slug], /now, /canon, /rss.xml, sitemap, robots
components/       Header, Footer, EssayList, SubscribeForm, Prose
content/essays/   one Markdown file per essay
content/now.md    the Now page
content/canon.md  the Canon page
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

## Updating the Canon

Edit `content/canon.md`. Every `##` section appears in file order; rename, add, or remove sections freely. Entries are list items and may be links:

```markdown
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
