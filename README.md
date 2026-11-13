# Fieldnotes: San Gabriel Valley Job Watch

A focused job-research dashboard for people looking for a different kind of work around the San Gabriel Valley. Browse museum, park, outdoor, books, collectibles, e-commerce, and approachable technical roles. Compare pay, required experience, location and application dates before deciding what to investigate.

[Research and copy decisions](docs/cro-copy-notes.md) | [Live dashboard](https://vector-jobsearch.netlify.app/)

## What the site does

- **Job Watch** is the homepage. Research cards show the original source, employer, city, pay, posting age when reported, deadline, schedule, work setup and qualifications. Job availability is never assumed from a working URL.
- **Explore Careers** provides 16 practical career directions, nearby organizations and a small checklist for real-world career experiments.
- Search from all 31 SGV cities and 13 nearby communities, with adjustable radius, searchable keywords, work-type shortcuts, pay and date filters, saved jobs and removable active filters. Distances are straight-line city-center estimates, not commutes.
- Browse 68 additional job-title search ideas. These link to external searches and are **not** confirmed openings.
- The baseline now contains **18 source-linked jobs with verified posting dates in the previous 30 days**, **18 apprenticeship resources**, and **68 additional job-title searches**. Only recently dated job posts are shown. The external feeds can add more, but counts change daily. Application status must always be checked with the source.

## Deploy on Netlify

The code is hosted in [VectorLe/jobsearch](https://github.com/VectorLe/jobsearch). Import the repository into Netlify and use these settings:

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Base directory | `.` |
| Build command | Leave blank |
| Publish directory | `.` |

`index.html` contains the CSS, JavaScript and seed data needed to render the app. There is no build step at Netlify and no third-party browser scripts. The source is kept separately as readable modules and JSON files. Run `python3 scripts/build.py` whenever source code or research content changes.

`netlify.toml` allows the inline script only by its generated SHA-256 hash. Always rebuild rather than editing `index.html` by hand. The build refreshes that hash automatically.

## Daily research refresh

GitHub Actions runs the workflow in `.github/workflows/career-compass-daily.yml` daily at 16:17 UTC and supports manual runs. It:

1. Checks the response status of curated employer URLs. A successful response does **not** mean applications are open.
2. Recalculates deadline statuses against the `America/Los_Angeles` calendar.
3. **Discovers new jobs without API credentials:** Public Greenhouse employer boards near the SGV and the Jobicy public API for US-eligible remote roles. The set of participating employers and relevant openings changes daily.
4. Optionally expands local coverage with Adzuna if the GitHub Actions secrets `ADZUNA_APP_ID` and `ADZUNA_APP_KEY` are configured. Third-party descriptions, salaries, and qualifications must be independently confirmed.
5. Rebuilds the self-contained `index.html`, checks the test suite, and commits updated data for Netlify to deploy.

**No API keys are required for the Greenhouse, Jobicy and Remotive sources.** The sources are checked by GitHub Actions rather than by each visitor, so there are no browser-visible API keys or third-party tracking requests. Results are sorted by proximity and can include remote opportunities at the end of the default geographic grouping.

The curated records and live feeds are separated, and the site deduplicates multiple references to the same job. If a provider fails temporarily, recently observed listings can remain for up to three days with a clear stale-source warning. A listed position is not necessarily still taking applications. Daily sources do not add fabricated vacancies or promised job counts.

## Edit and test

No npm dependencies, build framework, server, database or runtime service keys are needed. The only requirements for local development and testing are Python 3.11+ and Node 18+.

```sh
python3 -m http.server 8000
# Open http://localhost:8000
python3 scripts/build.py
python3 -m unittest discover -s tests -p 'test_*.py'
node --test tests/*.test.mjs
```

Edit the following files instead of editing the generated page:

| File | Purpose |
| --- | --- |
| `index.template.html` | Semantic HTML shell, title and navigation |
| `styles.css` | Gruvbox Dark tokens, layout, responsive styles |
| `js/app.js` | UI rendering and client-side interactions |
| `js/logic.js` | Pure helpers for safe text, dates, geography and filters |
| `data/opportunities.json` | Curated listings, qualifications, pay and source links |
| `data/role_ideas.json` | Broader searches; **not verified vacancies** |
| `data/geo.json` | All starting cities, communities, distance coordinates |
| `data/careers.json`, `data/places.json`, `data/tasks.json` | Explore Careers content |
| `data/snapshot.json`, `data/live_jobs.json` | Generated by the daily workflow |
| `scripts/refresh.py` | Coordinates source checks, no-key discovery and optional Adzuna search |
| `scripts/public_feeds.py` | Greenhouse employer boards, Jobicy, Remotive, safe extraction and failure handling |
| `scripts/build.py` | Self-contained HTML build and CSP hash |
| `docs/cro-copy-notes.md` | Research provenance, voice rules and testing opportunities |
| `docs/job-source-methods.md` | Source contracts, limitations, freshness, geographic coverage and maintenance |

### Editorial standards

- Use plain English and a respectful, specific tone. Lead with what readers can do next.
- Keep claims precise. Never invent pay, job dates, hiring status, commute duration, qualifications or outcomes.
- Distinguish employer postings from third-party feeds and hypothetical role searches.
- Put pay, requirements, location and application deadlines within view of the job title.
- **No em dashes** in the site's text, data, CSS, source files or generated HTML. A regression test checks this. Incoming provider text is normalized before it is written.
- Use Arial for body copy and Garamond for headings. Gruvbox Dark colors are centralized in `styles.css`.

## Privacy and limitations

Saved jobs, city selection and the checklist are stored locally in the visitor's browser. No accounts, analytics or third-party browser scripts are used. `robots.txt` and `noindex` discourage indexing but **do not restrict public access**. Use Netlify access controls for private content.

Career directions are exploratory suggestions based on publicly expressed interests, not a personality diagnosis or guaranteed career match. US national pay averages, when discussed in supporting research, do not substitute for local offers.


## Strict publication date policy

Job cards only display genuine, known publication dates within the past **30 calendar days** in Pacific time, including today and day 30. All records with unknown, future or older dates are excluded by the source pipeline, browser and static fallback. This policy is different from `observedAt` or `seenAt`. A job posted recently can still be closed, and a job URL being reachable does not mean applications are open.

The `data/apprenticeships.json` file holds standing union and registered apprenticeship program references. These **are not job vacancies**, have no fabricated publication dates, and are never included in job counts. Recruitment status and wage scales must be verified with each sponsor. Browse via the `Skilled trades` filter or the apprenticeship section.

The no-key public job feeds include Greenhouse employer boards, Jobicy and Remotive, with direct source attribution and publication-date filtering. Optional Adzuna queries search hands-on trades, museums, parks, books, collectibles, IT and e-commerce across the San Gabriel Valley and nearby communities. External APIs are subject to provider rate limits and terms. The number of suitable recent jobs varies daily and is not guaranteed.
