import type { ChoiceDef, IntentDef, RoundDef, Scenario } from "../domain/battle";

/**
 * Twelve authored Ventures scenarios. Every rival is a fictional NPC. Each round offers at least
 * three choices; the right one depends on the signal, what you've scouted, your remaining Capital,
 * and your build. Numbers are tuned by tests/earned/battle.test.ts so informed play beats autopilot.
 */

const ch = (
  id: string,
  label: string,
  tag: ChoiceDef["tag"],
  stat: ChoiceDef["stat"],
  cost: number,
  power: number,
  detail: string,
  extra: Partial<ChoiceDef> = {},
): ChoiceDef => ({ id, label, tag, stat, cost, power, detail, ...extra });

const it = (
  id: string,
  label: string,
  pressure: number,
  weakTo: IntentDef["weakTo"],
  detail: string,
  weight = 10,
  adapts?: IntentDef["adapts"],
): IntentDef => ({ id, label, pressure, weakTo, detail, weight, adapts });

const round = (title: string, situation: string, signal: string, intents: IntentDef[], choices: ChoiceDef[]): RoundDef => ({
  title,
  situation,
  signal,
  intents,
  choices,
});

/** A research option most rounds share in some form. */
const scout = (id: string, label: string, detail: string, cost = 1, power = 3) =>
  ch(id, label, "research", "insight", cost, power, detail, { reveals: true });

const hold = (id: string, label: string, detail: string) => ch(id, label, "defend", "execution", 0, 2, detail, { defense: 5 });

export const SCENARIOS: Scenario[] = [
  {
    id: "harbor-lease",
    version: 1,
    title: "The Harbor Lease",
    category: "negotiation",
    opponent: { name: "Marla Quinn", role: "Landlord, Quinn Wharf Holdings (fictional)", style: "Patient, anchors high", color: "#2A9D8F" },
    objective: "Lease the waterfront warehouse on terms your café can survive.",
    meterLabel: "Deal value",
    startMeter: 10,
    target: 32,
    capital: 6,
    conditions: ["Two other tenants are touring the space.", "Quinn values long-term tenants over the highest rent."],
    weakness: "Quinn's warehouse has sat empty for eight months; every month costs her.",
    exploitBonus: 3,
    counterBonus: 4,
    rounds: [
      round(
        "Opening terms",
        "Quinn slides over a lease at the top of the market and waits.",
        "She keeps glancing at a stack of other applications.",
        [
          it("anchor-high", "Anchors high", 8, ["research"], "Opens 30% above comparable rents to see if you flinch."),
          it("rival-tenant", "Plays the rival tenant", 9, ["negotiate"], "Mentions a national chain is 'very interested'."),
        ],
        [
          scout("comps", "Pull comparable leases", "Study nearby rents and vacancy history. Reveals her next move."),
          ch("counter-offer", "Make a firm counter", "negotiate", "influence", 1, 7, "A clear number with reasons attached."),
          ch("walk-tour", "Tour the space with a contractor", "execute", "execution", 2, 8, "Price the build-out on the spot."),
          hold("hold-open", "Listen and take notes", "Spend nothing; absorb the anchor."),
        ],
      ),
      round(
        "Concessions",
        "Quinn offers a small discount if you sign a ten-year term today.",
        "Her assistant mentions the loading dock 'needs a little work'.",
        [
          it("long-term", "Pushes a long lock-in", 10, ["negotiate", "research"], "Ten years, personal guarantee, no exit."),
          it("repairs-on-you", "Shifts repairs to you", 9, ["execute"], "Dock and roof repairs become your problem.", 10, [{ tag: "execute", delta: -3 }]),
        ],
        [
          ch("tenant-improvements", "Ask for tenant-improvement credit", "negotiate", "influence", 1, 8, "Trade term length for build-out money.", { exploits: true }),
          ch("inspection", "Commission an inspection", "execute", "execution", 2, 9, "Put the repairs in writing before you sign."),
          ch("partner-landlord", "Offer a co-marketing partnership", "invest", "insight", 2, 7, "Feature the wharf in your branding; she gets foot traffic.", { yield: 1 }),
          hold("hold-concessions", "Ask for a week to decide", "Keep Capital; let the pressure pass."),
        ],
      ),
      round(
        "Signing day",
        "Quinn is ready to sign, but the final draft has new clauses.",
        "The draft arrived at 11 p.m. with tracked changes turned off.",
        [
          it("fine-print", "Hides clauses in the fine print", 12, ["research"], "A rent escalator buried on page 14."),
          it("deadline", "Imposes a deadline", 11, ["defend", "negotiate"], "'Sign by noon or it goes to the chain.'"),
        ],
        [
          scout("redline", "Redline every page", "Read it all, line by line.", 1, 6),
          ch("vacancy-leverage", "Name the empty months", "negotiate", "influence", 1, 9, "Remind her what eight vacant months have cost.", { requiresWeakness: true, exploits: true }),
          ch("sign-fast", "Sign and start building", "execute", "execution", 1, 10, "Lock it in and move."),
          hold("hold-signing", "Calmly restate your terms", "No spend; defend your position.", ),
        ],
      ),
    ],
  },
  {
    id: "supplier-squeeze",
    version: 1,
    title: "The Supplier Squeeze",
    category: "negotiation",
    opponent: { name: "Dario Venn", role: "Sales director, Venn Grain Co. (fictional)", style: "Friendly, then firm", color: "#E76F51" },
    objective: "Renew your flour contract without a 20% price hike.",
    meterLabel: "Margin protected",
    startMeter: 8,
    target: 30,
    capital: 6,
    conditions: ["Wheat prices rose this quarter.", "You are Venn's third-largest bakery account."],
    weakness: "Venn's new mill is underused; they need volume more than price.",
    exploitBonus: 3,
    counterBonus: 4,
    rounds: [
      round(
        "The new price sheet",
        "Dario emails a price sheet 20% higher, 'effective next month'.",
        "The email is cheerful and mentions their new mill twice.",
        [
          it("market-excuse", "Blames the market", 8, ["research"], "Cites commodity prices that rose only 6%."),
          it("bundle-push", "Pushes a bigger bundle", 7, ["negotiate"], "Offers the old price if you buy specialty flours too."),
        ],
        [
          scout("commodity-data", "Check commodity data", "Compare their hike to actual wheat prices."),
          ch("call-dario", "Call Dario directly", "negotiate", "influence", 1, 7, "A relationship call before the paperwork."),
          ch("test-alt", "Test an alternative supplier", "invest", "insight", 2, 8, "Order a sample batch elsewhere."),
          hold("hold-sheet", "Acknowledge and wait", "No spend."),
        ],
      ),
      round(
        "Leverage",
        "Dario offers 'a small courtesy discount' of 5%.",
        "He asks how many loaves you bake on weekends.",
        [
          it("volume-probe", "Probes your volume", 9, ["research", "defend"], "Fishing for how dependent you are."),
          it("exclusive-ask", "Asks for exclusivity", 10, ["negotiate"], "Discount only if you drop every other supplier."),
        ],
        [
          ch("volume-commit", "Offer a volume commitment", "negotiate", "influence", 1, 8, "Guarantee more tonnage for a lower rate.", { exploits: true }),
          ch("forecast", "Share a 6-month forecast", "execute", "execution", 1, 8, "Show them a reliable, plannable account."),
          ch("co-op", "Form a buying co-op", "invest", "insight", 3, 10, "Join two other bakeries to buy together.", { yield: 1 }),
          hold("hold-leverage", "Keep numbers private", "Reveal nothing.", ),
        ],
      ),
      round(
        "Final offer",
        "Dario says this is his best and final.",
        "His manager is copied on the email for the first time.",
        [
          it("escalate", "Escalates to his manager", 11, ["negotiate"], "The manager wants a quick, clean win."),
          it("walk-away", "Threatens to drop the account", 12, ["invest", "defend"], "Bluff: they need your volume."),
        ],
        [
          ch("mill-capacity", "Offer to fill their new mill", "negotiate", "influence", 1, 9, "Off-peak orders that fill unused capacity.", { requiresWeakness: true, exploits: true }),
          ch("switch-ready", "Show the backup supplier", "invest", "insight", 2, 9, "Make it clear you can walk."),
          ch("accept-mid", "Accept a midpoint", "execute", "execution", 0, 6, "Take 10% and move on."),
          hold("hold-final", "Hold the line", "No spend."),
        ],
      ),
    ],
  },
  {
    id: "studio-partnership",
    version: 1,
    title: "The Studio Partnership",
    category: "negotiation",
    opponent: { name: "Priya Lanne", role: "Founder, Lanne Design Studio (fictional)", style: "Visionary, protective of equity", color: "#9B5DE5" },
    objective: "Form a partnership with a design studio without giving away control.",
    meterLabel: "Partnership value",
    startMeter: 10,
    target: 34,
    capital: 6,
    conditions: ["Priya has two other partnership offers.", "Your product needs her brand by spring."],
    weakness: "Priya's studio needs steady revenue; she's tired of feast-or-famine projects.",
    exploitBonus: 4,
    counterBonus: 4,
    rounds: [
      round(
        "First meeting",
        "Priya likes your product but asks what's in it for her team.",
        "She talks about her designers' burnout.",
        [
          it("equity-ask", "Asks for equity", 9, ["negotiate"], "Wants 15% of your company for brand work."),
          it("vision-test", "Tests your vision", 8, ["research", "execute"], "Pokes holes in your roadmap."),
        ],
        [
          scout("studio-research", "Research her studio's clients", "Who has she worked with, and how often?"),
          ch("vision-deck", "Present the roadmap", "execute", "execution", 1, 8, "A tight, honest plan."),
          ch("rev-share", "Propose revenue share", "negotiate", "influence", 1, 8, "Share upside without giving up equity."),
          hold("hold-first", "Ask questions, offer nothing yet", "No spend."),
        ],
      ),
      round(
        "Terms",
        "Priya proposes a joint brand with her name first.",
        "She mentions an investor who 'loves co-branding'.",
        [
          it("name-first", "Insists on top billing", 10, ["negotiate"], "Her name leads every product page."),
          it("investor-pressure", "Brings in her investor", 11, ["research", "invest"], "The investor wants board observer rights."),
        ],
        [
          ch("retainer", "Offer a monthly retainer", "invest", "insight", 2, 9, "Steady revenue for her team.", { exploits: true }),
          ch("pilot", "Run a 60-day pilot", "execute", "execution", 1, 8, "Prove the partnership before formalizing it."),
          ch("co-brand-terms", "Negotiate shared billing", "negotiate", "influence", 1, 9, "Alternating credit by product line."),
          hold("hold-terms", "Table it for next week", "No spend."),
        ],
      ),
      round(
        "Handshake",
        "Priya is ready, but her lawyer adds an exclusivity clause.",
        "The lawyer's draft is 40 pages for a 6-page deal.",
        [
          it("exclusivity", "Demands exclusivity", 12, ["negotiate", "defend"], "You could never work with another studio."),
          it("ip-grab", "Claims shared IP", 11, ["research"], "Joint ownership of designs she touches."),
        ],
        [
          ch("steady-pipeline", "Promise a steady project pipeline", "negotiate", "influence", 1, 10, "Guaranteed quarterly work, no exclusivity.", { requiresWeakness: true, exploits: true }),
          scout("ip-audit", "Audit the IP clauses", "Read what she's actually claiming.", 1, 6),
          ch("ship-together", "Ship the first product together", "execute", "execution", 2, 10, "Momentum beats paperwork."),
          hold("hold-handshake", "Decline the clause politely", "No spend."),
        ],
      ),
    ],
  },
  {
    id: "valley-expansion",
    version: 1,
    title: "Into the Valley",
    category: "market_entry",
    opponent: { name: "Corbin Hale", role: "Owner, Hale Hardware (fictional)", style: "Entrenched, loyal customers", color: "#F4A261" },
    objective: "Open your tool-rental shop in a town Hale has served for 30 years.",
    meterLabel: "Market share",
    startMeter: 6,
    target: 30,
    capital: 7,
    conditions: ["Hale has deep community ties.", "Contractors complain about Hale's rental wait times."],
    weakness: "Hale's rental fleet is old and booked weeks out.",
    exploitBonus: 3,
    counterBonus: 4,
    rounds: [
      round(
        "Scouting the town",
        "You have one storefront option and a modest budget.",
        "Locals mention Hale sponsors every Little League team.",
        [
          it("loyalty", "Leans on loyalty", 8, ["research", "negotiate"], "Reminds town he's 'been here for you'."),
          it("price-match", "Announces price matching", 9, ["invest"], "Matches any competitor price."),
        ],
        [
          scout("contractor-survey", "Survey local contractors", "Ask what they actually need."),
          ch("grand-opening", "Plan a big grand opening", "execute", "execution", 3, 11, "Make a splash."),
          ch("sponsor-team", "Sponsor a team too", "negotiate", "influence", 2, 8, "Join the community, don't fight it."),
          hold("hold-scout", "Open quietly", "No spend."),
        ],
      ),
      round(
        "First customers",
        "Your doors are open. Traffic is slow.",
        "Hale's lot is full of contractor trucks waiting.",
        [
          it("rumors", "Spreads 'out-of-towner' talk", 10, ["negotiate"], "Coffee-shop gossip about big-city outsiders."),
          it("discount-blitz", "Launches a discount blitz", 10, ["defend", "execute"], "20% off rentals for a month."),
        ],
        [
          ch("same-day", "Guarantee same-day rentals", "execute", "execution", 2, 9, "Serve the contractors Hale can't.", { exploits: true }),
          ch("meet-greet", "Host a contractor breakfast", "negotiate", "influence", 1, 8, "Coffee, donuts, and a handshake."),
          ch("new-fleet", "Invest in newer equipment", "invest", "insight", 3, 11, "Better tools than the incumbent."),
          hold("hold-first", "Hold prices steady", "No spend."),
        ],
      ),
      round(
        "Hale responds",
        "Hale buys a full-page ad in the county paper.",
        "His nephew was seen pricing new equipment.",
        [
          it("fleet-upgrade", "Upgrades his fleet", 12, ["execute", "research"], "Closes the gap you exploited."),
          it("exclusive-deals", "Signs exclusive contractor deals", 11, ["negotiate"], "Discounts for contractors who rent only from him."),
        ],
        [
          ch("booking-app", "Launch online booking", "invest", "insight", 2, 10, "Reserve tools at midnight from a truck."),
          ch("loyalty-program", "Start a contractor loyalty card", "negotiate", "influence", 1, 9, "Every 10th rental free."),
          ch("fleet-depth", "Stock the tools Hale is always out of", "execute", "execution", 2, 10, "Depth where it matters.", { requiresWeakness: true, exploits: true }),
          hold("hold-hale", "Let the ad run its course", "No spend."),
        ],
      ),
    ],
  },
  {
    id: "night-market",
    version: 1,
    title: "The Night Market Stall",
    category: "market_entry",
    opponent: { name: "The Ferro Twins", role: "Rival food truck, Ferro Bros. (fictional)", style: "Loud, fast, viral", color: "#E63946" },
    objective: "Win a regular stall at the city night market.",
    meterLabel: "Crowd share",
    startMeter: 8,
    target: 30,
    capital: 6,
    conditions: ["The market committee picks one new vendor this season.", "Ferro's videos get thousands of views."],
    weakness: "The Ferros' lines are long and their food runs out by 9 p.m.",
    exploitBonus: 3,
    counterBonus: 4,
    rounds: [
      round(
        "Trial night",
        "You and the Ferros each get one trial night.",
        "The twins are filming a teaser outside your setup.",
        [
          it("viral-video", "Posts a viral video", 9, ["execute"], "Their video draws a crowd away from you."),
          it("undercut", "Undercuts your price", 8, ["research"], "Half-price tacos for the first hour."),
        ],
        [
          scout("observe-lines", "Watch their lines and stock", "Time their service and count their trays."),
          ch("fast-service", "Optimize your service line", "execute", "execution", 1, 8, "Two-minute orders, every time."),
          ch("signature-dish", "Debut a signature dish", "invest", "insight", 2, 9, "Something no one else sells."),
          hold("hold-trial", "Keep the menu simple", "No spend."),
        ],
      ),
      round(
        "Word of mouth",
        "The committee is watching crowd reactions.",
        "A food blogger is in line at the Ferros' truck.",
        [
          it("blogger", "Courts the blogger", 10, ["negotiate"], "Free food and a front-row interview."),
          it("crowd-surge", "Pulls a crowd surge", 9, ["defend", "invest"], "Live music at their truck."),
        ],
        [
          ch("late-night", "Stay stocked until close", "execute", "execution", 2, 9, "Be the only food left at 10 p.m.", { exploits: true }),
          ch("blogger-chat", "Invite the blogger to taste", "negotiate", "influence", 1, 8, "Honest food, honest conversation."),
          ch("collab", "Propose a pairing with a drinks stall", "invest", "insight", 1, 7, "Bundle with the lemonade stand.", { yield: 1 }),
          hold("hold-word", "Focus on regulars", "No spend."),
        ],
      ),
      round(
        "Committee vote",
        "The committee meets tomorrow.",
        "The Ferros have printed petition cards.",
        [
          it("petition", "Runs a petition", 11, ["execute"], "Customers sign cards supporting the Ferros."),
          it("sabotage-rumor", "Questions your permits", 12, ["research", "defend"], "Implies your health permit is lapsing."),
        ],
        [
          scout("permits", "Bring every permit, organized", "Proof beats rumor.", 1, 6),
          ch("committee-pitch", "Pitch the committee directly", "negotiate", "influence", 1, 9, "Explain what you add to the market."),
          ch("closing-crowd", "Serve the after-nine crowd", "execute", "execution", 1, 9, "Feed the people the Ferros couldn't.", { requiresWeakness: true, exploits: true }),
          hold("hold-vote", "Let your record speak", "No spend."),
        ],
      ),
    ],
  },
  {
    id: "bike-launch",
    version: 1,
    title: "Launch Day: The Commuter Bike",
    category: "product_launch",
    opponent: { name: "Velocity Nine", role: "Rival e-bike brand (fictional)", style: "Big ad budget", color: "#3A86FF" },
    objective: "Launch your commuter bike and hit pre-order goals.",
    meterLabel: "Pre-orders",
    startMeter: 8,
    target: 32,
    capital: 7,
    conditions: ["Velocity Nine launches the same week.", "Reviewers care about reliability."],
    weakness: "Velocity Nine's battery has a recall rumor they haven't addressed.",
    exploitBonus: 3,
    counterBonus: 4,
    rounds: [
      round(
        "Pre-launch",
        "Your landing page is ready. Their billboards are up.",
        "Their ads only mention speed, never range.",
        [
          it("ad-blitz", "Launches an ad blitz", 9, ["research", "negotiate"], "Ads on every commuter podcast."),
          it("discount-preorder", "Undercuts with pre-order discounts", 9, ["invest"], "$300 off for early buyers."),
        ],
        [
          scout("teardown", "Tear down their spec sheet", "Find what they aren't saying."),
          ch("reviewer-loans", "Loan bikes to reviewers", "negotiate", "influence", 2, 9, "Let reliability speak."),
          ch("warranty", "Offer a 5-year warranty", "invest", "insight", 2, 9, "Make reliability a promise."),
          hold("hold-pre", "Stay on schedule", "No spend."),
        ],
      ),
      round(
        "Launch day",
        "Orders are trickling in. A server hiccups.",
        "Their CEO is doing interviews all day.",
        [
          it("media-tour", "Floods the media", 10, ["negotiate"], "Their CEO is on every show."),
          it("site-crash", "Your checkout strains", 11, ["execute", "defend"], "Traffic spikes; checkout slows down."),
        ],
        [
          ch("scale-checkout", "Scale your checkout", "execute", "execution", 2, 9, "Keep the store fast."),
          ch("range-story", "Publish real-world range tests", "negotiate", "influence", 1, 8, "Show the commute, not the billboard.", { exploits: true }),
          ch("referral", "Launch a referral program", "invest", "insight", 2, 9, "Riders bring riders.", { yield: 1 }),
          hold("hold-launch", "Keep calm, fix bugs", "No spend."),
        ],
      ),
      round(
        "Week one",
        "Reviews are coming in.",
        "A forum thread asks about Velocity's batteries.",
        [
          it("price-cut", "Cuts price again", 12, ["invest", "research"], "Another $200 off."),
          it("influencers", "Pays influencers", 11, ["negotiate", "defend"], "Sponsored rides across the city."),
        ],
        [
          ch("battery-safety", "Publish your battery certification", "negotiate", "influence", 1, 10, "Answer the question they won't.", { requiresWeakness: true, exploits: true }),
          ch("ship-early", "Ship the first batch early", "execute", "execution", 2, 11, "Bikes in hands beat ads."),
          scout("cohort-data", "Study who's ordering", "Find your real customer.", 1, 6),
          hold("hold-week", "Protect your margin", "No spend."),
        ],
      ),
    ],
  },
  {
    id: "app-relaunch",
    version: 1,
    title: "The Planner App Relaunch",
    category: "product_launch",
    opponent: { name: "Tessa Ruiz", role: "Product lead, Plandex (fictional)", style: "Copies fast", color: "#06D6A0" },
    objective: "Relaunch your planner app and win back lapsed users.",
    meterLabel: "Active users",
    startMeter: 10,
    target: 34,
    capital: 6,
    conditions: ["Plandex is free with ads.", "Your old users left over sync bugs."],
    weakness: "Plandex shows ads inside users' calendars, and people hate it.",
    exploitBonus: 4,
    counterBonus: 4,
    rounds: [
      round(
        "Win-back email",
        "You can email 40,000 lapsed users once.",
        "Plandex just announced a 'privacy update'.",
        [
          it("feature-copy", "Copies your headline feature", 9, ["execute"], "Ships a clone in a week."),
          it("free-forever", "Pushes 'free forever'", 8, ["research", "negotiate"], "Free beats paid in an ad."),
        ],
        [
          scout("churn-survey", "Survey why users left", "Ask, then listen."),
          ch("fix-sync", "Rebuild sync first", "execute", "execution", 2, 9, "Fix the reason they left."),
          ch("apology-email", "Send an honest apology email", "negotiate", "influence", 1, 7, "Own the bugs, show the fix."),
          hold("hold-email", "Wait for the fix", "No spend."),
        ],
      ),
      round(
        "Relaunch week",
        "Your relaunch is live.",
        "Tessa tweeted a screenshot of your pricing page.",
        [
          it("price-mock", "Mocks your pricing", 10, ["negotiate", "invest"], "'Why pay for a calendar?'"),
          it("bug-hunt", "Users find a bug", 10, ["execute", "defend"], "A timezone bug in the new build."),
        ],
        [
          ch("hotfix", "Ship a same-day hotfix", "execute", "execution", 1, 8, "Fix it before lunch."),
          ch("no-ads-promise", "Promise a calendar without ads", "negotiate", "influence", 1, 8, "Your calendar, your time.", { exploits: true }),
          ch("family-plan", "Introduce a family plan", "invest", "insight", 2, 9, "One price for the whole house.", { yield: 1 }),
          hold("hold-week", "Monitor and wait", "No spend."),
        ],
      ),
      round(
        "Month one",
        "Retention data is in.",
        "Plandex's app-store rating is dropping.",
        [
          it("ad-free-tier", "Launches an ad-free tier", 12, ["invest", "research"], "Matches your no-ads pitch."),
          it("partnerships", "Signs a phone-maker partnership", 11, ["negotiate"], "Preinstalled on new phones."),
        ],
        [
          ch("ad-comparison", "Show a side-by-side calendar", "negotiate", "influence", 1, 10, "Theirs with ads, yours without.", { requiresWeakness: true, exploits: true }),
          ch("power-features", "Ship power-user features", "execute", "execution", 2, 10, "Give fans a reason to stay."),
          scout("retention-dive", "Dig into retention data", "Find the habit that keeps users.", 1, 6),
          hold("hold-month", "Hold course", "No spend."),
        ],
      ),
    ],
  },
  {
    id: "cookbook-launch",
    version: 1,
    title: "The Cookbook Launch",
    category: "product_launch",
    opponent: { name: "Chef Anton Brel", role: "TV chef, Brel Kitchens (fictional)", style: "Famous, overbooked", color: "#FB8500" },
    objective: "Get your family-recipe cookbook onto the regional bestseller list.",
    meterLabel: "Copies sold",
    startMeter: 6,
    target: 28,
    capital: 6,
    conditions: ["Brel's new book launches the same month.", "Bookstores give endcaps to proven sellers."],
    weakness: "Brel's book is expensive and full of hard-to-find ingredients.",
    exploitBonus: 3,
    counterBonus: 4,
    rounds: [
      round(
        "Pre-orders",
        "Your publisher gives you a small marketing budget.",
        "Brel's book has a glossy trailer.",
        [
          it("celebrity", "Leans on celebrity", 8, ["negotiate"], "Talk-show appearances."),
          it("endcap", "Books every endcap", 9, ["research", "execute"], "Front-of-store placement everywhere."),
        ],
        [
          scout("reader-research", "Research home cooks", "What do weeknight cooks actually want?"),
          ch("store-visits", "Visit indie bookstores", "negotiate", "influence", 1, 7, "Handshakes with booksellers."),
          ch("recipe-cards", "Print free recipe cards", "execute", "execution", 1, 7, "Something to take home."),
          hold("hold-pre", "Save the budget", "No spend."),
        ],
      ),
      round(
        "Launch month",
        "Your book is on shelves.",
        "Readers post photos of failed Brel recipes.",
        [
          it("tv-special", "Airs a TV special", 10, ["negotiate", "defend"], "An hour on prime time."),
          it("bulk-discount", "Bulk discounts to stores", 9, ["invest"], "Stores get Brel cheaper."),
        ],
        [
          ch("weeknight-demo", "Demo 20-minute dinners", "execute", "execution", 1, 8, "Real recipes, real kitchens.", { exploits: true }),
          ch("book-club", "Pitch book clubs", "negotiate", "influence", 1, 8, "Cook together, read together."),
          ch("library-copies", "Donate library copies", "invest", "insight", 2, 9, "Readers who borrow, buy.", { yield: 1 }),
          hold("hold-launch", "Let reviews build", "No spend."),
        ],
      ),
      round(
        "Bestseller week",
        "The list is decided this week.",
        "Brel is offering signed copies.",
        [
          it("signing-tour", "Runs a signing tour", 11, ["execute", "negotiate"], "Ten cities in ten days."),
          it("price-drop", "Drops his price", 11, ["research"], "Brel goes half price."),
        ],
        [
          ch("pantry-promise", "Promote 'all from your pantry'", "negotiate", "influence", 1, 9, "No specialty stores required.", { requiresWeakness: true, exploits: true }),
          ch("local-signing", "Do hometown signings", "execute", "execution", 1, 9, "Family, friends, and neighbors."),
          scout("sales-data", "Track store-by-store sales", "Restock where it's selling.", 1, 6),
          hold("hold-list", "Hold steady", "No spend."),
        ],
      ),
    ],
  },
  {
    id: "warehouse-crunch",
    version: 1,
    title: "The Holiday Warehouse Crunch",
    category: "operations",
    opponent: { name: "The Peak Season", role: "A brutal December (fictional scenario)", style: "Relentless", color: "#457B9D" },
    objective: "Ship every holiday order on time with a small team.",
    meterLabel: "Orders on time",
    startMeter: 10,
    target: 32,
    capital: 6,
    conditions: ["Orders are tripling.", "Two packers are out sick."],
    weakness: "Most orders are the same three products.",
    exploitBonus: 3,
    counterBonus: 4,
    rounds: [
      round(
        "The surge",
        "Orders triple overnight.",
        "The carrier pickup window just moved earlier.",
        [
          it("carrier-cutoff", "Earlier carrier cutoff", 9, ["execute"], "Pickups move to 2 p.m."),
          it("stockout", "Stock runs low", 8, ["research", "invest"], "Top seller nearly gone."),
        ],
        [
          scout("order-analysis", "Analyze the order mix", "What are people actually buying?"),
          ch("second-shift", "Add a second shift", "execute", "execution", 2, 9, "More hours on the floor."),
          ch("reorder", "Place a rush reorder", "invest", "insight", 2, 8, "Get stock in before it's gone."),
          hold("hold-surge", "Work the queue in order", "No spend."),
        ],
      ),
      round(
        "Bottleneck",
        "Packing is the bottleneck.",
        "Customer emails asking 'where is my order?' are rising.",
        [
          it("complaints", "Customer complaints spike", 10, ["negotiate"], "Angry emails and reviews."),
          it("packing-jam", "Packing station jams", 10, ["execute", "defend"], "Two stations break down."),
        ],
        [
          ch("pre-pack", "Pre-pack the top three products", "execute", "execution", 1, 9, "Batch the common orders.", { exploits: true }),
          ch("proactive-email", "Email every customer an update", "negotiate", "influence", 1, 7, "Honest delivery dates."),
          ch("rent-equipment", "Rent a second packing line", "invest", "insight", 3, 11, "Throughput for money."),
          hold("hold-bottleneck", "Keep going steady", "No spend."),
        ],
      ),
      round(
        "Final week",
        "Last shipping day before the holidays.",
        "The forecast shows snow on the carrier's route.",
        [
          it("snowstorm", "Snowstorm delays", 12, ["research", "invest"], "Carrier delays across the region."),
          it("returns-wave", "Early returns pile up", 11, ["execute"], "Returns clog the dock."),
        ],
        [
          ch("batch-ship", "Ship batched orders first", "execute", "execution", 1, 10, "Clear the biggest piles first.", { requiresWeakness: true, exploits: true }),
          ch("local-courier", "Book a local courier", "invest", "insight", 2, 10, "A backup carrier for local orders."),
          ch("gift-notes", "Send gift-note emails for late orders", "negotiate", "influence", 1, 8, "A printable note while they wait."),
          hold("hold-final", "Ship what you can", "No spend."),
        ],
      ),
    ],
  },
  {
    id: "kitchen-turnaround",
    version: 1,
    title: "The Kitchen Turnaround",
    category: "operations",
    opponent: { name: "Inspector Ilse Varga", role: "City health inspector (fictional)", style: "Thorough, fair", color: "#118AB2" },
    objective: "Turn around a struggling restaurant kitchen before re-inspection.",
    meterLabel: "Kitchen score",
    startMeter: 8,
    target: 30,
    capital: 6,
    conditions: ["Re-inspection is in three weeks.", "The staff is demoralized."],
    weakness: "Varga focuses on records and repeat issues, not one-off mistakes.",
    exploitBonus: 3,
    counterBonus: 4,
    rounds: [
      round(
        "Week one",
        "You inherit a messy kitchen and a tired crew.",
        "Last report circled 'temperature logs' twice.",
        [
          it("morale-dip", "Crew morale dips", 8, ["negotiate"], "Two cooks talk about quitting."),
          it("equipment-fail", "Walk-in cooler struggles", 9, ["research", "execute"], "The cooler won't hold temperature."),
        ],
        [
          scout("past-reports", "Read every past report", "Find the patterns."),
          ch("crew-meeting", "Hold a crew meeting", "negotiate", "influence", 1, 7, "Listen first, then plan together."),
          ch("repair-cooler", "Replace the cooler outright", "invest", "insight", 3, 10, "Fix the expensive problem with money."),
          hold("hold-week1", "Deep clean with what you have", "No spend."),
        ],
      ),
      round(
        "Week two",
        "Systems are forming.",
        "A cook forgets the logbook during the rush.",
        [
          it("rush-chaos", "Dinner rush chaos", 10, ["execute", "defend"], "Standards slip during the rush."),
          it("supplier-late", "Supplier delivers late and warm", 9, ["negotiate", "research"], "A delivery arrives at unsafe temperature."),
        ],
        [
          ch("log-system", "Install a simple logging routine", "execute", "execution", 1, 9, "Checklists at every station.", { exploits: true }),
          ch("supplier-call", "Renegotiate delivery terms", "negotiate", "influence", 1, 8, "Cold-chain guarantees in writing."),
          ch("new-thermometers", "Buy new prep equipment", "invest", "insight", 2, 9, "Shiny tools for every station."),
          hold("hold-week2", "Slow the menu down", "No spend."),
        ],
      ),
      round(
        "Re-inspection",
        "Varga arrives at 10 a.m.",
        "She asks to see records before she looks at the line.",
        [
          it("records-review", "Reviews three weeks of logs", 12, ["research", "execute"], "Every gap will show."),
          it("surprise-check", "Checks the walk-in first", 11, ["negotiate"], "Temperatures, labels, dates."),
        ],
        [
          ch("show-records", "Present complete logs", "execute", "execution", 1, 10, "Three weeks, no gaps.", { requiresWeakness: true, exploits: true }),
          ch("walkthrough", "Walk her through the changes", "negotiate", "influence", 1, 9, "Explain every fix."),
          ch("label-everything", "Buy a labeling system", "invest", "insight", 2, 9, "No mystery containers."),
          hold("hold-inspect", "Let the kitchen speak", "No spend."),
        ],
      ),
    ],
  },
  {
    id: "school-bid",
    version: 1,
    title: "The School Furniture Bid",
    category: "competitive_bid",
    opponent: { name: "Brandt & Sons", role: "Furniture contractor (fictional)", style: "Lowballs, then bills extras", color: "#6D597A" },
    objective: "Win the district contract to furnish three new classrooms.",
    meterLabel: "Bid strength",
    startMeter: 8,
    target: 32,
    capital: 6,
    conditions: ["The district weighs price and durability.", "Brandt has won the last two bids."],
    weakness: "Brandt's last two jobs ran 30% over budget in change orders.",
    exploitBonus: 4,
    counterBonus: 4,
    rounds: [
      round(
        "Request for proposals",
        "The district publishes its requirements.",
        "The board minutes mention 'budget overruns' twice.",
        [
          it("lowball", "Lowballs the price", 9, ["research"], "Bids 20% under everyone."),
          it("relationship", "Leans on relationships", 8, ["negotiate"], "Lunches with the facilities manager."),
        ],
        [
          scout("public-records", "Read past contract records", "Public records show what jobs really cost."),
          ch("sample-desk", "Build a sample desk", "execute", "execution", 2, 9, "Let them sit in it."),
          ch("meet-facilities", "Meet the facilities team", "negotiate", "influence", 1, 7, "Learn what breaks and why."),
          hold("hold-rfp", "Submit a clean, standard bid", "No spend."),
        ],
      ),
      round(
        "Shortlist",
        "You and Brandt are the finalists.",
        "Brandt's rep keeps calling the board chair.",
        [
          it("price-war", "Cuts price again", 10, ["invest", "research"], "Another 5% off."),
          it("lobbying", "Lobbies the board", 10, ["negotiate", "defend"], "Private calls to board members."),
        ],
        [
          ch("fixed-price", "Guarantee a fixed price", "invest", "insight", 2, 9, "No change orders, ever.", { exploits: true }),
          ch("durability-test", "Publish durability tests", "execute", "execution", 1, 8, "10,000 sit tests, on video."),
          ch("teacher-feedback", "Invite teachers to try samples", "negotiate", "influence", 1, 8, "The people who use it every day."),
          hold("hold-short", "Stay out of politics", "No spend."),
        ],
      ),
      round(
        "Board vote",
        "The board votes tonight.",
        "A board member asks about 'total cost' in the agenda.",
        [
          it("final-cut", "Promises a final discount", 12, ["research", "invest"], "Cheapest on paper."),
          it("doubt-campaign", "Questions your capacity", 11, ["execute", "defend"], "'Can a small shop deliver on time?'"),
        ],
        [
          ch("total-cost", "Present total cost with overruns", "negotiate", "influence", 1, 10, "Show what Brandt's jobs really cost.", { requiresWeakness: true, exploits: true }),
          ch("delivery-plan", "Show a delivery schedule", "execute", "execution", 1, 9, "Week-by-week, with a buffer."),
          ch("warranty-bond", "Post a performance bond", "invest", "insight", 2, 10, "Money where your mouth is."),
          hold("hold-vote", "Rest on your bid", "No spend."),
        ],
      ),
    ],
  },
  {
    id: "city-catering",
    version: 1,
    title: "The City Hall Catering Contract",
    category: "competitive_bid",
    opponent: { name: "Gilded Fork Events", role: "Upscale caterer (fictional)", style: "Polished, pricey", color: "#FFB703" },
    objective: "Win City Hall's yearly catering contract.",
    meterLabel: "Contract odds",
    startMeter: 8,
    target: 30,
    capital: 6,
    conditions: ["City Hall wants local and affordable.", "Gilded Fork catered the mayor's gala."],
    weakness: "Gilded Fork sources almost nothing locally.",
    exploitBonus: 3,
    counterBonus: 4,
    rounds: [
      round(
        "Tasting invite",
        "Both caterers are invited to a tasting.",
        "The procurement memo highlights 'local sourcing'.",
        [
          it("gala-menu", "Brings a gala menu", 8, ["research"], "Lobster and champagne."),
          it("connections", "Name-drops the mayor", 9, ["negotiate"], "'The mayor loved our gala.'"),
        ],
        [
          scout("procurement-rules", "Read the procurement rules", "What does City Hall actually score?"),
          ch("local-menu", "Design a local-farm menu", "invest", "insight", 2, 9, "Seasonal, local, affordable."),
          ch("staff-pitch", "Pitch your service team", "negotiate", "influence", 1, 7, "Friendly, fast, reliable."),
          hold("hold-tasting", "Bring your standard menu", "No spend."),
        ],
      ),
      round(
        "The tasting",
        "The committee tastes both menus.",
        "One committee member has a dairy allergy.",
        [
          it("presentation", "Wows with presentation", 10, ["execute"], "Ice sculptures and towers."),
          it("price-hint", "Hints at a discount", 9, ["negotiate", "defend"], "'We can be flexible.'"),
        ],
        [
          ch("allergy-plan", "Show an allergy-safe plan", "execute", "execution", 1, 9, "Labels and separate prep for every dish."),
          ch("farm-story", "Tell your farms' story", "negotiate", "influence", 1, 8, "Names and towns of every supplier.", { exploits: true }),
          ch("tasting-boxes", "Send tasting boxes to staff", "invest", "insight", 2, 9, "Let the whole office try.", { yield: 1 }),
          hold("hold-taste", "Let the food speak", "No spend."),
        ],
      ),
      round(
        "Decision",
        "The committee decides Friday.",
        "Gilded Fork requested a private meeting.",
        [
          it("private-meeting", "Lobbies privately", 11, ["negotiate", "research"], "A closed-door pitch."),
          it("bundle-offer", "Offers a free gala", 12, ["execute"], "A free holiday party with the contract."),
        ],
        [
          ch("local-scorecard", "Submit a local-sourcing scorecard", "negotiate", "influence", 1, 10, "Show the percentages side by side.", { requiresWeakness: true, exploits: true }),
          ch("pilot-month", "Offer a one-month pilot", "execute", "execution", 1, 9, "Earn it month by month."),
          ch("price-lock", "Lock prices for the year", "invest", "insight", 2, 10, "Predictable costs for the city."),
          hold("hold-decision", "Wait for the vote", "No spend."),
        ],
      ),
    ],
  },
];

export const SCENARIOS_BY_ID = new Map(SCENARIOS.map((s) => [s.id, s]));

export const CATEGORY_LABEL: Record<Scenario["category"], string> = {
  negotiation: "Negotiation",
  market_entry: "Market entry",
  product_launch: "Product launch",
  operations: "Operations",
  competitive_bid: "Competitive bid",
};

/** The tutorial (practice only) walks through the first scenario with hints. */
export const TUTORIAL_SCENARIO_ID = "harbor-lease";
