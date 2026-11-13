# Fieldnotes: San Gabriel Valley Job Watch

A static, source-linked local job search focused on the San Gabriel Valley and nearby cities. The project supports a career change toward hands-on work, history, parks, books, museums, precious metals, teaching and small business, while also keeping an optional path into approachable e-commerce, Shopify, WordPress and technical-support work.

**Live site:** https://vector-jobsearch.netlify.app/  
**GitHub:** https://github.com/VectorLe/jobsearch

## What the site shows

The site has two views, intentionally avoiding an elaborate multi-tab dashboard:

1. **Job watch** is the home page: searchable employment leads with employer, place, approximate distance, source, published pay, schedule, posting age (when verified), closing date, visible qualifications and an original listing link. Search filters include distance, field, pay, posting age, date status and saved leads. Switch between all openings, hands-on work and e-commerce/technical work.
2. **Explore careers** contains 16 concise career directions, 9 organizations to visit or contact and a single 16-step transition checklist. State is saved locally in the browser.

There are **22 curated listing records** in `data/opportunities.json`, including older or closed postings retained for research. A listing record is **not** confirmation that an employer is currently accepting applications; entries with passed deadlines are hidden by default. There are also **43 additional job-title search ideas**, each with example qualifications and outbound searches in Indeed and GovernmentJobs. Those are **not actual vacancies** and should not be counted as verified job postings.

### Geographic scope

Select **any of the 31 member cities** of the San Gabriel Valley Council of Governments, plus 13 nearby unincorporated communities, as the search center. A few examples: Alhambra, Arcadia, Azusa, Bradbury, Claremont, Diamond Bar, El Monte, Glendora, Industry (City of Industry), La Canada Flintridge, La Verne, Monrovia, Montebello, Monterey Park, Pasadena, Pomona, Rosemead, San Dimas, San Gabriel, South El Monte, Walnut and West Covina. The full list and approximate city-center coordinates are in `data/geo.json`.

The initial center is **El Monte**, not downtown Los Angeles. Expand the search area to 10, 15, 30, 50, 75 miles, or all known locations. Proximity is approximate **straight-line distance between reference points, not a driving route or commute-time estimate**. The list of 31 cities is based on https://www.sgvcog.org/about/memberagencies-affiliates. An unknown location may be excluded by a selected radius instead of being assigned a fictitious distance.

### Job-card accuracy

- **Qualifications:** Always visible. Researched listings summarize observed requirements, while external feed results are explicitly marked as provider excerpts or not supplied. The full employer listing is authoritative.
- **Posting age:** Based only on a known `postedAt` date, never calculated from the date we found the link (`observedAt`). Unknown dates display **Date not published**. Third-party feed dates are the provider's reported dates, which might differ from the employer's original posting date.
- **Pay:** Published ranges retain their source labels. Third-party job-board compensation is labeled as reported or estimated; undisclosed compensation remains undisclosed. Annual-to-hourly equivalents in the filter are a comparison convenience, not a guaranteed hourly wage.
- **Closing:** Calculated in the America/Los_Angeles timezone. A deadline does not prove the post is open, and employers can close early. A reachable URL also does not prove active hiring.
- **Job freshness:** The dashboard evaluates dates in the browser. A scheduled GitHub Actions workflow checks curated source URLs and, if configured, pulls additional opportunities from an approved jobs API.

## Hosting on Netlify

The source lives at the repository root. Use:

| Setting | Value |
| --- | --- |
| Repository | `VectorLe/jobsearch` |
| Production branch | `main` |
| Base directory | blank or `.` |
| Build command | **blank** |
| Publish directory | `.` |

`netlify.toml` sets the root base/publish paths and security headers. The generated `index.html` includes the full CSS, JavaScript and the current JSON snapshot, so the initial experience needs no separate asset downloads. There is also a readable fallback list for browsers where JavaScript is blocked. This prevents the prior plain-text loading problem caused by unavailable assets on Netlify.

**Do not edit generated `index.html` or the Content-Security-Policy hash by hand.** Edit source files and run `python3 scripts/build.py` instead. The builder derives `index.html` from `index.template.html`, the CSS/JS modules and JSON, and updates the script hash in `netlify.toml`.

## Daily automatic updates

The GitHub Actions workflow at `.github/workflows/career-compass-daily.yml` runs every day at 16:17 UTC and can be started manually under Actions. It:

1. Checks the current URL status for curated listings and calculates deadlines. Successful HTTP responses do **not** confirm open jobs.
2. Optionally searches for recently reported jobs through **Adzuna**, covering public service, museums, parks, gardens, collectibles, books, Shopify, e-commerce operations, WordPress and on-site IT. Searches are seeded across SGV and expand roughly 75 straight-line miles from El Monte, then geographically screened against known cities.
3. Writes `data/snapshot.json` and `data/live_jobs.json`, rebuilds the single-file site and its matching Netlify security policy, runs tests and commits changed data.
4. Netlify redeploys when the connected GitHub `main` branch gets that commit.

**Without Adzuna credentials, new jobs are not automatically discovered.** Only existing curated links and deadline snapshots are checked. To enable fresh discovery, register at https://developer.adzuna.com/ and add `ADZUNA_APP_ID` and `ADZUNA_APP_KEY` as GitHub Actions secrets. External feed data can be incomplete or outdated; check the employer before applying. `scripts/refresh.py` contains the search terms and geographic rules and uses only Python's standard library.

## Editing the project

| Source | What to change |
| --- | --- |
| `data/opportunities.json` | Verified listings, pay, posting date, schedule, requirements and original employer URL |
| `data/role_ideas.json` | Searchable job titles and typical qualifications, **not** claims of vacancies |
| `data/geo.json` | Region centers, community aliases, approximate coordinates and search scope |
| `data/careers.json` | Career summaries, first real-world experiments and path choices |
| `data/places.json` | Organizations and field-trip options |
| `data/tasks.json` | Practical transition checklist |
| `styles.css` | Gruvbox Dark palette, layouts, responsive breakpoints and fonts |
| `js/app.js`, `js/logic.js` | View rendering, filtering, state and testable date/distance helpers |
| `scripts/build.py` | Single-page bundling and security hash generation |
| `scripts/refresh.py` | Daily source checks and optional new-job discovery |
| `data/live_jobs.json`, `data/snapshot.json` | Generated workflow data; do not hand-edit routinely |

Gruvbox Dark base colors and all green, aqua, blue, purple, yellow, orange and red accents are defined as CSS custom properties in `styles.css`; job-card accents communicate field category. Fonts are system Arial for UI and Garamond for display, with no network font dependency. The frontend has no React, bundler, NPM runtime dependencies, charting library, analytics script or database.

## Local development

Requires Python 3.11+ and Node.js 18+ for automated tests. No package install is required.

```sh
python3 scripts/build.py
python3 -m unittest discover -s tests -p 'test_*.py'
node --test tests/*.test.mjs
python3 -m http.server 8000
```

Visit http://localhost:8000. Editing source JS or CSS requires rerunning the builder to update the self-contained page. `npm run build` and `npm test` are convenience aliases.

For a local **offline** snapshot (does not call remote services): `python3 scripts/refresh.py --offline`, followed by `python3 scripts/build.py`. Do not commit a local offline snapshot in place of a successful production refresh unless intentional.

## Scope and privacy

Research and curation baseline: November 2026. Always verify the current employer listing, hiring status, eligibility, working location and compensation. A curated personal website is not sufficient for a diagnosis or a definitive personality profile; career guidance here is exploratory rather than clinical. Saved job preferences and task states are browser-local only; there is no account or backend collecting them. `noindex` requests that search engines avoid indexing but **does not protect a public Netlify page**; use Netlify access controls when confidentiality matters.
