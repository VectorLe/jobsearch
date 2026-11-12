# Fieldnotes — Career Transition Atlas

A self-contained, fast, responsive career-change research dashboard, created for a Southern California professional who wants to leave e-commerce and explore history, parks, books, teaching, precious metals, hands-on work, and independent business.

**Stack:** HTML + modern JavaScript modules + CSS + plain JSON + one Python 3 standard-library updater. **No frontend dependencies, bundler, database, paid hosting component, external fonts, tracking, or runtime API credentials.** Font stacks are Arial for UI and Garamond for display; colors follow Gruvbox Dark.

## Dashboard contents

| View | What it does |
| --- | --- |
| Overview | Top recommendations, evidence safeguards, actionable deadline watch and personalized rankings |
| Career paths | 16 dossiers with real duties, trade-offs, training, first steps, movement estimates and qualified links |
| Compare | Editable weighting across subject fit, movement, entry ease, income potential, autonomy and learning |
| Job watch | 10 curated November 2026 postings, deadlines, source links, URL-reachability status, saved leads and optional new-job feed |
| Local field guide | 9 Southern California museums, gardens, parks, auction and recreation contacts with external maps |
| Evidence and fit | Direct observations separated from vocational hypotheses, plus post-shift self-ratings |
| 90-day plan | 16 checkable tasks, progress tracking, and notes exported/restored as JSON |
| Income and runway | Hourly-income scenario, gross yearly model, savings runway and occupational reference pay |
| Sources and methods | Inspectable research links, data freshness and privacy limitations |

## Deployment on Netlify

This repository can be used in two layouts:

1. **Standalone repo:** `index.html`, `data/`, `js/`, `netlify.toml` are at repository root. Import that repository into Netlify. Leave **Base directory** empty. **Build command:** leave empty. **Publish directory:** `.` (in `netlify.toml`).
2. **Existing-repo subdirectory:** files live in `career-compass/`. In Netlify select **Base directory:** `career-compass`. **Build command:** leave empty. **Publish directory:** `.` (relative to base). In a GitHub-repository branch deployment, set the production branch to that branch.

Netlify steps: [app.netlify.com/start](https://app.netlify.com/start) → Import existing project → GitHub → select the repository → verify base/publish settings → deploy. Netlify automatically redeploys when the configured branch receives a Git push. Connecting the Netlify account itself requires you to authorize the GitHub repository in Netlify; creating the code alone does not create a live Netlify site.

This site includes `robots.txt` and `noindex`, **but they do not restrict access**. If career/financial notes should be private, use Netlify access controls and a private repository; avoid publishing identifying notes. No private browser data is ever uploaded by this app.

## Daily refresh workflow

`.github/workflows/daily-refresh.yml` runs at **16:17 UTC every day** (8:17 a.m. PST / 9:17 a.m. PDT) and can also be started with **Actions → Career Atlas — daily research refresh → Run workflow**.

By default, the job performs three useful things:

- Recalculate all known job filing dates according to the *America/Los_Angeles* calendar.
- Check whether each listed source URL is reachable; distinguish `reachable`, `blocked`, `unreachable`, and `unknown`. **A working URL never proves a job is open.**
- Record when the main source website's HTML content checksum changes, for a human to revisit the narrative; it does **not** automatically invent new psychological conclusions.

The job writes `data/snapshot.json` and `data/live_jobs.json`, commits only those two files, and pushes. Netlify's Git integration then sees a new commit and redeploys. Browser views also calculate deadlines at runtime, so passage of time is reflected even if a scheduled run is late.

### Optional: automatically discover fresh local jobs

Without API credentials, the curated postings still refresh but **the program does not discover new openings**. To enable daily third-party job discovery:

1. Register for an [Adzuna developer API](https://developer.adzuna.com/), subject to provider terms and limits.
2. Create GitHub Actions secrets `ADZUNA_APP_ID` and `ADZUNA_APP_KEY` in the repository.
3. Run the workflow manually to test. `live_jobs.json` will list only a filtered, recent sample of listings near the San Gabriel Valley and Inland Empire. Every result is prominently labeled as an unverified external feed item.

The updater never posts keys to the dashboard. Query terms and accepted city names are centralized in `scripts/refresh.py`. Adzuna sometimes returns unrelated locations or job titles; the script filters terms and city names, but a human must still check pay, eligibility and availability. If the external API fails, `live_jobs.json` records an error and the curated dashboard remains operational.

**Important GitHub limitation:** `schedule` workflows run from the repository's **default branch**, not a feature branch. If this code is initially on an isolated branch, the workflow must eventually be placed on the default branch of the chosen repo (or moved to its own new repo's default branch) before daily scheduled updates occur. You can still deploy a feature branch on Netlify in the meantime; the static page itself works immediately.

### Why not scrape dozens of job boards?

Many sites prohibit automated scraping, aggressively block bots, or have pages that remain HTTP 200 after recruitment closes. A daily scraper can falsely label archived jobs as live. This project makes reachability explicit, treats deadlines as dated facts, and optionally uses a legitimate external API for new opportunities. Human-maintained source records remain the authoritative research layer.

## Updating the content

No JavaScript changes are needed to edit the research:

| File | Edit for |
| --- | --- |
| `data/careers.json` | Path descriptions, risk factors, credential notes, subjective 1–5 ratings, resource links |
| `data/profile.json` | Observed source evidence versus hypotheses; update `lastHumanReviewed` after review |
| `data/opportunities.json` | New carefully checked opportunities: add a unique ID, `observedAt`, source URL and optional deadline |
| `data/places.json` | More local institutions with accurate addresses and official URLs |
| `data/tasks.json` | Action-plan checklist and experiment stages |
| `data/sources.json` | Research references and provenance |
| `data/snapshot.json` | **Generated** by the daily refresh; do not manually curate |
| `data/live_jobs.json` | **Generated** by optional third-party feed; do not manually curate |

Every career has six ordinal 1–5 `scores`. These are **editorial estimates** for comparison, not evidence-based mental-health, personality, or economic measurements.

## Local development and tests

Requires Python 3.9+ and, for frontend tests, Node 18+ (Node 22 preferred). No installs are necessary.

```sh
python3 -m http.server 8000
# Open http://localhost:8000
python3 scripts/refresh.py --offline   # refresh locally without web calls
python3 -m unittest discover -s tests -p 'test_*.py'
node --test tests/logic.test.mjs
```

Serving through HTTP is necessary because browsers disallow ES-module fetches from `file://` origins.

## Accessibility and performance

- Native HTML controls, skip-navigation link, keyboard-operable navigation and semantically labeled filters.
- Honors reduced-motion preferences. Responsive layouts from mobile to desktop.
- No web fonts, ad trackers, charting frameworks, CSS libraries, backend runtime or third-party JavaScript.
- All visible text from JSON is escaped before insertion; external links only allow HTTP(S) URLs.
- JSON loaded in parallel; remaining interactions run locally. In-browser notes and preferences are saved to `localStorage` with backup/import commands.
- Strict Content Security Policy allows local scripts only. Dynamic score bars use inline styles; hence `style-src 'unsafe-inline'` is the only CSP exception.

## Scope and accuracy

Research baseline: **November 11, 2026**. Job data must be verified at the employer's website; jobs can close earlier than advertised or remain displayed after their deadline. National pay references are broad U.S. occupational medians from May 2025, not locally verified offers. Individual clinical traits, psychometric scores, political positions, mental health, beliefs and personal motives are **not** inferred from a curated public website. Any recommendation is a hypothesis until tested through actual work.

This is a planning and research tool, not a placement service, financial adviser or clinical assessment.