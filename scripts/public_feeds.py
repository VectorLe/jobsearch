"""Public job-board discovery, without API keys or browser-side requests.

Sources:
  Greenhouse Job Board API (published employer postings)
  Jobicy public jobs API (US-eligible remote listings, seven-day discovery window)

Only the daily GitHub Actions job calls these sources. Failures are nonfatal and
are reported in data/live_jobs.json. The UI does not call third-party APIs.
"""
from __future__ import annotations
from datetime import date, datetime, timedelta, timezone
from html import unescape
from html.parser import HTMLParser
import json
import re
from urllib.parse import quote, urlencode, urlsplit
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

# Real public job boards with employment in/near the San Gabriel Valley.
# Add companies only after confirming the public board and geographic fit.
GREENHOUSE_BOARDS = {
    'ridemobilityllc': 'RIDE Mobility',
    'byd': 'BYD North America',
    'brilliantearth': 'Brilliant Earth',
    'philzcoffeecareers': 'Philz Coffee',
    'welbehealth': 'WelbeHealth',
}

LOCAL_TITLES = (
    'technical', 'aftersales', 'after-sales', 'information technology', 'support',
    'operations', 'ecommerce', 'e-commerce', 'shopify', 'wordpress', 'digital',
    'systems analyst', 'business analyst', 'merchandis', 'training', 'trainer',
    'sales associate', 'jewelry', 'store manager', 'barista', 'recreation',
    'museum', 'park', 'library', 'visitor', 'customer', 'retail', 'field service',
    'warehouse', 'inventory', 'parts', 'maintenance', 'marketing coordinator',
    'community', 'events', 'outside sales', 'learning and development',
)
REMOTE_TITLES = (
    'shopify', 'wordpress', 'woocommerce', 'ecommerce', 'e-commerce',
    'website', 'web content', 'content manager', 'content specialist', 'copywriter',
    'marketing coordinator', 'marketing operations', 'digital marketing', 'seo',
    'merchandising', 'support specialist', 'technical support', 'customer support',
    'customer success', 'customer experience', 'implementation specialist',
    'onboarding', 'account manager', 'sales operations', 'business operations',
    'project coordinator', 'customer service', 'technical writer',
    'learning specialist', 'trainer', 'operations coordinator', 'tutor',
)
EXCLUDED_TITLES = ('software engineer', 'machine learning engineer', 'devops engineer',
                   'cloud architect', 'principal engineer', 'data scientist',
                   'registered nurse', 'physician', 'nurse practitioner',
                   'board member', 'volunteer', 'talent community', 'future opportunities')
USER_AGENT = 'FieldnotesJobWatch/3.0 (public careers discovery; cached once daily)'


def _text(value, limit=1000):
    return re.sub(r'\s+', ' ', unescape(str(value or '')).replace(chr(8212), ' - ')).strip()[:limit]


class _Extractor(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.words = []
    def handle_starttag(self, tag, attrs):
        if tag in ('br', 'p', 'li', 'div', 'h2', 'h3', 'h4'):
            self.words.append(' ')
    def handle_data(self, data):
        self.words.append(data)


def plain_html(markup):
    parser = _Extractor()
    parser.feed(unescape(str(markup or ''))[:250000])
    return _text(' '.join(parser.words), 15000)


def qualifications(description):
    content = plain_html(description)
    section = re.search(
        r'(?:required qualifications|minimum qualifications|qualifications|requirements|'
        r'what you(?: will)? bring|essential physical requirements)\s*[:\-]?\s*(.{20,290})',
        content, flags=re.I,
    )
    if section:
        return 'Source excerpt, verify details: ' + section.group(1).strip()[:245]
    return 'The source does not clearly state minimum qualifications in its feed. Review the full posting.'


def source_json(url, timeout=12):
    url_info = urlsplit(url)
    if url_info.scheme != 'https' or not url_info.hostname:
        raise ValueError('Only HTTPS job APIs are allowed')
    request = Request(url, headers={'User-Agent': USER_AGENT, 'Accept': 'application/json'})
    with urlopen(request, timeout=timeout) as response:
        # A bounded read avoids unbounded memory and rejects truncated JSON.
        raw = response.read(12_000_001)
        if len(raw) > 12_000_000:
            raise ValueError('API response exceeds size limit')
        return json.loads(raw.decode('utf-8'))


def safe_date(value, today=None):
    raw = str(value or '')[:10]
    try:
        parsed = date.fromisoformat(raw)
    except ValueError:
        return None
    if today and parsed > today:
        return None
    return raw


def relevant(title, phrases):
    t = _text(title).casefold()
    return bool(t and any(x in t for x in phrases) and not any(x in t for x in EXCLUDED_TITLES))


def local_city(value, geo):
    """Match explicit city names anywhere in an address, longest name first."""
    location = _text(value, 220).lower()
    # A name such as Pasadena also occurs in Texas. Never assign out-of-state
    # posts to the SGV just because the city name matches.
    if re.search(r'(?<![a-z])(?:,|\s)(?:tx|texas|md|maryland|fl|florida|co|colorado|wa|washington|or|oregon|az|arizona|ny|new york|nj|new jersey)(?![a-z])', location):
        return None
    for city in sorted(geo['cities'], key=len, reverse=True):
        label = city.lower().replace('ñ', 'n')
        normalized = location.replace('ñ', 'n')
        if re.search(r'(?<![a-z])' + re.escape(label) + r'(?![a-z])', normalized):
            return city
    return None


def category_for(title):
    t = title.lower()
    if any(x in t for x in ('shopify', 'ecommerce', 'e-commerce', 'wordpress',
                             'merchandis', 'marketing', 'web content', 'copywrit', 'seo')):
        return 'E-commerce & digital'
    if any(x in t for x in ('computer', 'technical', 'aftersales', 'after-sales',
                             'information technology', 'systems analyst', 'support technician',
                             'field service', 'implementation', 'it support')):
        return 'Technical & IT'
    if any(x in t for x in ('museum', 'archive', 'historic', 'interpret', 'heritage')):
        return 'Museums & heritage'
    if any(x in t for x in ('library', 'book', 'tutor', 'educat', 'learning')):
        return 'Books & education'
    if any(x in t for x in ('jewel', 'coin', 'bullion', 'auction', 'estate')):
        return 'Collectibles & trade'
    if any(x in t for x in ('park', 'recreation', 'maintenance', 'barista', 'grounds')):
        return 'Parks & outdoors'
    return 'Operations & services'


def jobicy_pay(job):
    currency = job.get('salaryCurrency')
    low, high = job.get('salaryMin'), job.get('salaryMax')
    if currency != 'USD' or not isinstance(low, (int, float)) or low <= 0:
        return 'Pay not published'
    if not isinstance(high, (int, float)) or high < low:
        high = low
    unit = str(job.get('salaryPeriod', '')).lower()
    suffix = '/hr' if 'hour' in unit else '/yr' if 'year' in unit or 'annual' in unit else '/mo' if 'month' in unit else ''
    if not suffix:
        return 'Pay period not provided'
    def show(n):
        return f'${n:,.2f}' if suffix == '/hr' and n % 1 else f'${n:,.0f}'
    return f'{show(low)} to {show(high)}{suffix}' if high > low else f'{show(low)}{suffix}'


def greenhouse_pay(description):
    """Only display compensation when a nearby explicit pay label and unit match."""
    s = plain_html(description)
    a = re.search(r'(?:hourly rate|starting base hourly rate|pay range|salary|base pay|compensation budget|compensation range)\s*[:\-]?\s*.{0,100}?\$([\d,]+(?:\.\d+)?)\s*(k)?(?:\s*(?:to|\-|and)\s*\$?([\d,]+(?:\.\d+)?)\s*(k)?)?.{0,50}', s, re.I)
    if not a:
        return 'Pay not published'
    low = float(a.group(1).replace(',', '')) * (1000 if a.group(2) else 1)
    high = float(a.group(3).replace(',', '')) * (1000 if a.group(4) else 1) if a.group(3) else low
    context = a.group(0).lower()
    if any(k in context for k in ('per hour', 'hourly', '/hr')):
        unit = '/hr'
    elif any(k in context for k in ('annual', 'per year', 'salary', '/yr')) or low >= 15000:
        unit = '/yr'
    else:
        return 'Pay not published'
    if not (10 <= low <= high <= 500000):
        return 'Pay not published'
    fmt = lambda v: f'${v:,.2f}' if unit == '/hr' and v % 1 else f'${v:,.0f}'
    return f'{fmt(low)} to {fmt(high)}{unit}' if high > low else fmt(low) + unit


def normalize_greenhouse(job, board, employer, geo, today, first_seen):
    title = _text(job.get('title'), 170)
    if not relevant(title, LOCAL_TITLES):
        return None
    location = (job.get('location') or {}).get('name', '')
    city = local_city(location, geo)
    if not city:
        return None
    url = str(job.get('absolute_url') or '')
    if not url.startswith('https://'):
        return None
    jid = str(job.get('id') or '')
    if not jid.isdigit():
        return None
    posted = safe_date(job.get('first_published'), today)
    if not posted or not 0 <= (today - date.fromisoformat(posted)).days <= 30:
        return None
    desc = job.get('content') or ''
    summary = plain_html(desc)
    schedule = 'Part-time' if re.search(r'part[- ]time', title + ' ' + summary[:900], re.I) else 'Full-time' if re.search(r'full[- ]time', title + ' ' + summary[:900], re.I) else 'See source'
    key = f'greenhouse-{board}-{jid}'
    listed_pay = greenhouse_pay(desc)
    return {
        'id': key, 'title': title, 'employer': employer, 'city': city,
        'category': category_for(title), 'salary': listed_pay,
        'payType': 'Employer description; verify' if listed_pay != 'Pay not published' else 'Pay not provided on board',
        'schedule': schedule, 'workMode': 'On site / verify',
        'postedAt': posted,
        'deadline': safe_date(job.get('application_deadline'), today=None),
        'observedAt': today.isoformat(), 'seenAt': first_seen.get(key) or today.isoformat(),
        'sourceUrl': url, 'sourceType': 'Employer posting via Greenhouse',
        'provider': 'greenhouse', 'requirements': qualifications(desc),
        'note': _text(summary[:260], 260) if summary else 'Read the employer description for daily duties and work conditions.',
        'experienceLevel': 'Review requirements',
    }


def normalize_jobicy(job, today, first_seen):
    title = _text(job.get('jobTitle'), 170)
    if not relevant(title, REMOTE_TITLES):
        return None
    jid = str(job.get('id') or '')
    if not jid.isdigit():
        return None
    url = str(job.get('url') or '')
    if not url.startswith('https://jobicy.com/'):
        return None
    posted = safe_date(job.get('pubDate'), today)
    if not posted or (today - date.fromisoformat(posted)).days > 30:
        return None
    level = _text(job.get('jobLevel') or 'Not provided', 60)
    if re.search(r'principal|staff|vp|vice president|chief', level, re.I):
        return None
    region = _text(job.get('jobGeo'), 90)
    # Geographic eligibility is provider reported, not a promise that an
    # employer will hire from California. Reject explicitly foreign-only roles.
    if not re.search(r'\b(?:usa|united states|us only|north america|worldwide|anywhere|global)\b', region, re.I):
        return None
    if re.search(r'\b(?:europe only|eu only|united kingdom only|uk only|canada only|india only|australia only)\b', region, re.I):
        return None
    description = job.get('jobDescription') or ''
    key = f'jobicy-{jid}'
    types = job.get('jobType') or []
    return {
        'id': key, 'title': title,
        'employer': _text(job.get('companyName') or 'Employer not named', 100),
        'city': 'Remote', 'category': category_for(title),
        'salary': jobicy_pay(job),
        'payType': 'Jobicy reported pay; confirm with employer',
        'schedule': ', '.join(_text(t, 40) for t in types[:2]) if isinstance(types, list) and types else 'See source',
        'workMode': 'Remote', 'postedAt': posted, 'deadline': None,
        'observedAt': today.isoformat(), 'seenAt': first_seen.get(key) or today.isoformat(),
        'sourceUrl': url, 'sourceType': 'Jobicy', 'provider': 'jobicy',
        'requirements': qualifications(description),
        'note': _text(job.get('jobExcerpt'), 260) or _text(plain_html(description), 260),
        'experienceLevel': level,
        'eligibility': region or 'US eligibility indicated by Jobicy filter; verify',
    }


def load_greenhouse(geo, today, first_seen, fetch=source_json):
    found, errors = {}, []
    for board, employer in GREENHOUSE_BOARDS.items():
        try:
            payload = fetch(f'https://boards-api.greenhouse.io/v1/boards/{quote(board)}/jobs?content=true', timeout=16)
            if not isinstance(payload, dict) or not isinstance(payload.get('jobs'), list):
                raise ValueError('Invalid Greenhouse board response')
            for raw in payload['jobs']:
                job = normalize_greenhouse(raw, board, employer, geo, today, first_seen)
                if job:
                    found[job['id']] = job
        except (OSError, ValueError, KeyError, TypeError, TimeoutError, json.JSONDecodeError) as exc:
            errors.append(f'{board}: {type(exc).__name__}')
    return list(found.values()), errors


def load_jobicy(today, first_seen, fetch=source_json):
    found, errors = {}, []
    cursor = None
    for _ in range(3):
        params = {'count': 100, 'geo': 'usa'}
        if cursor:
            params['cursor'] = cursor
        try:
            payload = fetch('https://jobicy.com/api/jobs?' + urlencode(params), timeout=16)
            if not isinstance(payload, dict) or payload.get('success') is False or not isinstance(payload.get('jobs'), list):
                raise ValueError('Invalid Jobicy feed response')
            for raw in payload['jobs']:
                job = normalize_jobicy(raw, today, first_seen)
                if job:
                    found[job['id']] = job
            cursor = payload.get('nextCursor')
            if not cursor or len(found) >= 70:
                break
        except (OSError, ValueError, KeyError, TypeError, TimeoutError, json.JSONDecodeError) as exc:
            errors.append(f'Jobicy: {type(exc).__name__}')
            break
    return list(found.values())[:70], errors


def normalize_remotive(raw, today, first_seen):
    """Normalize a public Remotive posting with explicit US hiring eligibility."""
    title = _text(raw.get('title'), 170)
    if not relevant(title, REMOTE_TITLES):
        return None
    jid = str(raw.get('id') or '')
    if not jid.isdigit():
        return None
    url = str(raw.get('url') or '')
    if not url.startswith('https://remotive.com/'):
        return None
    posted = safe_date(raw.get('publication_date'), today)
    if not posted or not 0 <= (today - date.fromisoformat(posted)).days <= 30:
        return None
    region = _text(raw.get('candidate_required_location'), 100)
    if not re.search(r'\b(?:usa|united states|us only|north america|worldwide|anywhere|global)\b', region, re.I):
        return None
    if re.search(r'\b(?:europe only|eu only|canada only|uk only|india only)\b', region, re.I):
        return None
    desc = raw.get('description') or ''
    key = 'remotive-' + jid
    salary = _text(raw.get('salary'), 90) or 'Pay not published'
    return {
        'id': key, 'title': title, 'employer': _text(raw.get('company_name') or 'Employer not specified', 110),
        'city': 'Remote', 'category': category_for(title), 'salary': salary,
        'payType': 'Remotive reported; confirm units and with employer',
        'schedule': _text(raw.get('job_type') or 'See source', 50).replace('_', ' ').title(),
        'workMode': 'Remote', 'postedAt': posted, 'deadline': None,
        'observedAt': today.isoformat(), 'seenAt': first_seen.get(key) or today.isoformat(),
        'sourceUrl': url, 'sourceType': 'Remotive', 'provider': 'remotive',
        'requirements': qualifications(desc), 'note': _text(plain_html(desc), 260),
        'eligibility': region,
    }


def load_remotive(today, first_seen, fetch=source_json):
    """Use Remotive's public API once a day and attribute every listing."""
    try:
        payload = fetch('https://remotive.com/api/remote-jobs', timeout=16)
        if not isinstance(payload, dict) or not isinstance(payload.get('jobs'), list):
            raise ValueError('Invalid Remotive data')
        found = {}
        for raw in payload['jobs']:
            job = normalize_remotive(raw, today, first_seen)
            if job:
                found[job['id']] = job
        return list(found.values())[:110], []
    except (OSError, ValueError, KeyError, TypeError, TimeoutError, json.JSONDecodeError) as exc:
        return [], [f'Remotive: {type(exc).__name__}']


def load_public_jobs(geo, checked_at, previous=None, fetch=source_json):
    """Return actual source-linked postings and provider errors, never search ideas."""
    # Use the same local day as the dashboard's posting-age labels.
    now = datetime.fromisoformat(checked_at.replace('Z', '+00:00')).astimezone(ZoneInfo('America/Los_Angeles')).date()
    first_seen = {j['id']: j.get('seenAt') for j in previous or [] if isinstance(j, dict) and j.get('id')}
    greenhouse, gh_errors = load_greenhouse(geo, now, first_seen, fetch)
    jobicy, j_errors = load_jobicy(now, first_seen, fetch)
    remotive, r_errors = load_remotive(now, first_seen, fetch)
    jobs = greenhouse + jobicy + remotive
    errors = gh_errors + j_errors + r_errors
    provider_counts = {'greenhouse': len(greenhouse), 'jobicy': len(jobicy), 'remotive': len(remotive)}
    # A transient API failure should not erase yesterday's research, but stale
    # cards must be labeled and never retained indefinitely.
    failed = {err.split(':', 1)[0] for err in errors}
    if failed:
        existing_ids = {j['id'] for j in jobs}
        for old in previous or []:
            if not isinstance(old, dict) or old.get('id') in existing_ids:
                continue
            board = old.get('id', '').split('-')[1] if old.get('provider') == 'greenhouse' else None
            relevant_failure = (board in failed or (old.get('provider') == 'jobicy' and 'Jobicy' in failed) or (old.get('provider') == 'remotive' and 'Remotive' in failed))
            if not relevant_failure:
                continue
            try:
                seen = date.fromisoformat((old.get('observedAt') or old.get('seenAt') or '')[:10])
            except ValueError:
                continue
            posted = safe_date(old.get('postedAt'), now)
            if posted and 0 <= (now - date.fromisoformat(posted)).days <= 30 and now - seen <= timedelta(days=3):
                old = dict(old)
                old['feedStale'] = True
                jobs.append(old)
    return jobs[:240], provider_counts, errors
