# Fieldnotes · San Gabriel Valley Job Watch

A fast, static job-search board for work around the San Gabriel Valley, with a secondary page for career ideas and local field visits. Uses Gruvbox Dark, Arial for body text, and Garamond for headings. No frontend frameworks, packages, build commands, analytics, database, or API keys in the browser.

## What you see

There are **two sections**:

- **Job watch** (home): role cards with employer, city, approximate proximity, published pay, full-time/part-time schedule, how long ago the job was posted, its filing deadline, requirements, source verification note and source link. Save jobs and filter by search terms, category, radius, posting age, pay floor and deadline.
- **Explore careers**: eight practical career directions, nine nearby organizations and a single checkable 90-day transition plan. Tasks and saved jobs are stored locally in your browser.

The dashboard begins in **El Monte**, near the middle of the San Gabriel Valley. Change the reference city to Arcadia, Pasadena, San Gabriel, West Covina, Covina, Monrovia, or Glendora. Expand from a **15-mile** radius to 30, 50, 75 or all. The distances are approximate city-center **straight-line** measurements; **not driving distance**. Supported places and city-center coordinates are in `data/geo.json`, shared by the dashboard and daily updater. Listings that specify only Los Angeles city are omitted from the automatic regional feed.

### Date and salary accuracy

- Curated employer listings use the **opening date listed by the employer** as `postedAt`. The date is never inferred from the time we found the link (`observedAt`). An unknown posting date is labeled unknown.
- Newly discovered Adzuna jobs use the **provider's reported creation date** as `postedAt`. That is not necessarily the date the employer originally opened the vacancy.
- Published salary ranges are labeled as such; Adzuna estimates are labeled estimates, and listings without pay display **Pay not provided**. Annual salary floors used for filtering are approximated by dividing by 2,080 hours; this is **not** a guarantee of hourly compensation.
- An HTTP success confirms only that the URL responded. It does **not** mean the employer is still accepting applications. Filing deadlines can change or close early.
- Curated employer listings are maintained manually; automatic discovery is optional and requires Adzuna credentials. Without credentials, the job feed is **not refreshed with newly found opportunities**.

## Netlify deployment

Repository: `VectorLe/jobsearch`.

| Setting | Value |
| --- | --- |
| Branch | `main` |
| Base directory | *(empty)* |
| Build command | *(empty)* |
| Publish directory | `.` |

Import the GitHub repository into Netlify and deploy. `netlify.toml` supplies the publish directory and security headers. Commits to `main` trigger Netlify Git deployments when the site is connected. If you had a previous deployment based on `career-compass/`, **clear its old Base directory** first.


## Single-file deployment fix (November 2026)

Production `index.html` is **generated** from `index.template.html`, `styles.css`, `js/logic.js`, `js/app.js`, and seven `data/*.json` files. CSS, JavaScript, and the current JSON are embedded in the generated HTML. It therefore works even if a Netlify deployment serves the HTML but the browser fails to load separate CSS or JavaScript assets. There is also a pre-rendered list of jobs when JavaScript is disabled.

**Do not edit the generated `index.html` directly.** Edit source files and regenerate:

```sh
python3 scripts/build.py
python3 -m unittest discover -s tests -p 'test_*.py'
node --test tests/*.test.mjs
```

The builder updates the `script-src` SHA-256 hash in `netlify.toml`, preserving a strict Content Security Policy without enabling arbitrary inline JavaScript. The daily GitHub Actions workflow rebuilds `index.html` after refreshing the job data, then commits the changed files. Netlify can continue deploying the repository root (`main`, base directory `.`, blank build command, publish directory `.`).

If the page still appears unstyled, inspect the **published deploy** in Netlify to ensure the site is serving the latest commit, and use **Clear cache and deploy site** once.

## Daily updates

The GitHub workflow `.github/workflows/career-compass-daily.yml` runs at `16:17 UTC` daily (8:17 a.m. PST / 9:17 a.m. PDT) and can also be run manually. It:

1. Recalculates the filing-date status of curated jobs.
2. Checks source URL reachability (not hiring status).
3. If configured, performs Adzuna searches starting near El Monte/Arcadia/Pasadena and widening toward Covina, Monrovia, and Claremont; filters results to known local cities and at most ~75 straight-line miles from El Monte.
4. Writes only `data/snapshot.json` and `data/live_jobs.json`, then commits changes.

To enable fresh discoveries: register for the [Adzuna API](https://developer.adzuna.com/), add `ADZUNA_APP_ID` and `ADZUNA_APP_KEY` as GitHub Actions repository secrets, and manually run the workflow once. Failed provider searches are reported. Results remain unverified until you inspect the employer's posting.

## Editing without coding

| File | Purpose |
| --- | --- |
| `data/opportunities.json` | Employer-vetted opportunities and their `postedAt`, `observedAt`, pay, dates, qualifications and links |
| `data/geo.json` | San Gabriel Valley reference cities and surrounding city coordinates |
| `data/careers.json` | Eight career ideas on the Explore page |
| `data/places.json` | Organizations for in-person visits and volunteer opportunities |
| `data/tasks.json` | One checklist spanning a 90-day transition |
| `data/live_jobs.json` | Auto-generated external feed (do not hand-edit) |
| `data/snapshot.json` | Auto-generated link and deadline checks (do not hand-edit) |

Edit content in JSON; the dashboard handles presentation. The frontend is just `index.html`, `styles.css`, `js/app.js`, and `js/logic.js`. `scripts/refresh.py` is the entire backend updater (Python standard library only).

## Tests and local preview

Requires Node 18+ and Python 3.9+; no install step.

```sh
npm test
python3 -m unittest discover -s tests -p 'test_*.py'
python3 scripts/refresh.py --offline
python3 -m http.server 8000
```

Open `http://localhost:8000`. Do not open `index.html` via `file://`, because the dashboard fetches local JSON files.

## Privacy and research scope

Research baseline: November 11–12, 2026. Current postings must be rechecked directly. Job cards are sourced from employer pages or an explicitly labeled third-party job API. The career suggestions are research hypotheses, not psychometric conclusions. Saved jobs and task progress remain in localStorage; preferences from the previous Fieldnotes site are migrated when available. `noindex` discourages search indexing but does **not** secure access: use Netlify site access controls if the research should be private.
