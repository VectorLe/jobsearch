# How job listings get into Fieldnotes

This research dashboard offers source-linked opportunities, not a job-placement guarantee. The user's primary search region is the San Gabriel Valley, and every incorporated SGV city can be selected as the search origin. Locations farther away appear when the distance filter expands. Straight-line city-center distances are approximate and should not be treated as driving estimates.

## Sources and provenance

| Source | Access | Scope | What we can verify |
| --- | --- | --- | --- |
| Curated records (`data/opportunities.json`) | Manually researched source links | SGV and surrounding cities, with an occasional farther-away contrast | Specific reported pay, source posting date, official requirements and deadline when publicly stated |
| Greenhouse Job Board API | Public read-only employer GET endpoint, no API key | Selected employer job boards and postings whose explicit city matches an SGV or nearby city | Source-linked title, employer, location and provider-reported first published date; pay only when shown unambiguously |
| Jobicy public API | Public read-only API, no API key | Remote jobs that the provider marks geographically eligible for the United States | Remote job title, original publication date, US eligibility tag, provider pay, summary and requirements excerpts |
| Adzuna API (optional) | Application ID and API key stored in GitHub Actions secrets | Targeted SGV and nearby-city searches | Provider reported dates and salary, clearly marked as estimated when the provider says so |
| Role ideas (`data/role_ideas.json`) | Search links only | Many categories matching the user's interests and technical experience | Suggested job titles, **not verified vacancies** |

Public API documentation:
- [Greenhouse Job Board API](https://docs.greenhouse.io/job-board): read-only GET endpoints do not require authentication. `content=true` includes the job description.
- [Jobicy public jobs API](https://github.com/Jobicy/remote-jobs-api): `geo=usa`, cursor pagination, provider-reported `pubDate` and salary fields. The public API returns recently published opportunities, generally within seven days.
- [Adzuna developer API](https://developer.adzuna.com/): optional broader keyword discovery with credentials.

## What is not claimed

- A reachable posting URL is not proof that an employer is accepting applications.
- A missing deadline does not mean a job is permanently open.
- The first date the dashboard discovered a listing is not the posting date.
- Remote eligibility tags are not guarantees that a company hires in California or that work is fully location-independent.
- A job's stated salary is not a binding offer, and missing salary is shown as not provided.
- Extracted qualifications are labeled when taken from third-party summaries; verify the full source.
- The geographic distance filter is a radius around city-center coordinates, not a commute calculation.

## Performance and reliability

GitHub Actions retrieves sources once per day and publishes a static JSON snapshot. The browser only loads the site bundle and does not call outside job APIs. Each public feed is limited by item count, response size and network timeout. Source failures never remove hand-researched records, and delayed provider results are explicitly marked. The site combines records and removes duplicates by job ID, URL and employer/title/city fingerprints. No web scraping of protected job boards is used.

The static seed is included in `index.html` so the site is readable even when separate assets are not available. When new daily records arrive, the updater runs `scripts/build.py` and automatically adjusts Netlify's Content Security Policy script hash. No frontend packages or hosted database are required.

## Adding a new source

1. Confirm the source permits access by an unauthenticated read endpoint, or use its documented API with credentials kept in GitHub Actions.
2. Restrict location to explicit city matches or provider-reported US remote eligibility. Reject ambiguous out-of-state city names.
3. Preserve the original source URL, provider, reported publication date, reported pay units, stated minimum qualifications and first-observed date.
4. Add deterministic fixtures to `tests/test_public_feeds.py` and verify handling of missing pay, missing dates, source outages and bad geography.
5. Run `python3 scripts/build.py`, both test suites, and inspect the generated HTML before committing.

The source list is centralized in `scripts/public_feeds.py`; update only after checking both the company's hiring site and geographical relevance. Manually verify promising leads with the employer before applying.
