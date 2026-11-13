#!/usr/bin/env python3
"""Build a resilient, single-request dashboard for Netlify (Python stdlib only).

CSS, JS and initial JSON are embedded in index.html. JSON remains separate for
human maintenance and is re-embedded by the daily GitHub Actions refresh.
"""
from __future__ import annotations
import base64
from datetime import datetime
import hashlib
from html import escape
import json
from pathlib import Path
import re
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
DATA = ('opportunities', 'live_jobs', 'careers', 'places', 'tasks', 'geo', 'snapshot', 'role_ideas')


def fallback(data: dict) -> str:
    """Accessible, styled fallback when browser JavaScript cannot execute."""
    now = datetime.now(ZoneInfo('America/Los_Angeles')).date()
    jobs = data['opportunities']
    visible = [job for job in jobs if not job.get('deadline') or job['deadline'] >= now.isoformat()]
    if not visible:
        visible = jobs[:8]
    chunks = [
        '<section class="hero"><div><div class="eyebrow">San Gabriel Valley · job watch</div>',
        '<h1>Work beyond <span>the screen.</span></h1>',
        '<p>A source-linked list of local careers. The interactive filters are optional; original job links work without JavaScript.</p>',
        '</div><aside class="hero-aside"><small>Search center</small><strong>El Monte</strong>',
        '<p>Explore the San Gabriel Valley first. This fallback shows recorded jobs without interactive filters.</p></aside></section>',
        '<section class="group"><div class="group-head"><h3>Researched job listings</h3>',
        '<span>Verify current availability with employers</span></div><div class="job-grid">',
    ]
    for job in visible:
        url = escape(job.get('sourceUrl') or '#', quote=True)
        title = escape(job.get('title') or 'Job listing')
        employer = escape(job.get('employer') or 'Employer not supplied')
        city = escape(job.get('city') or 'Location not supplied')
        salary = escape(job.get('salary') or 'Pay not published')
        schedule = escape(job.get('schedule') or 'Not specified')
        posted = escape(job.get('postedAt') or 'Not published')
        deadline = escape(job.get('deadline') or 'Not specified')
        note = escape(job.get('note') or 'Review source for responsibilities')
        requirements = escape(job.get('requirements') or 'Confirm minimum qualifications with employer')
        chunks.append(
            f'<article class="job-card"><div><h3><a class="job-title-link" href="{url}" target="_blank" rel="noopener noreferrer">{title}</a></h3>'
            f'<p class="company">{employer} · {city}</p></div>'
            f'<div class="pay"><span>Pay</span><strong>{salary}</strong></div>'
            '<div class="job-metadata">'
            f'<div class="field"><span>Posted</span><strong>{posted}</strong></div>'
            f'<div class="field"><span>Closing</span><strong>{deadline}</strong></div>'
            f'<div class="field"><span>Schedule</span><strong>{schedule}</strong></div></div>'
            f'<div class="qualifications"><h4>Qualifications</h4><p>{requirements}</p></div>'
            f'<p class="job-summary">{note}</p><div class="card-actions">'
            f'<a class="button button-primary" href="{url}" target="_blank" rel="noopener noreferrer">View job posting ↗</a>'
            '</div></article>'
        )
    chunks.append('</div></section>')
    return ''.join(chunks)


def build(root: Path = ROOT) -> tuple[str, str]:
    template = (root / 'index.template.html').read_text(encoding='utf-8')
    css = (root / 'styles.css').read_text(encoding='utf-8')
    logic = (root / 'js/logic.js').read_text(encoding='utf-8')
    app = (root / 'js/app.js').read_text(encoding='utf-8')
    data = {k: json.loads((root / 'data' / (k + '.json')).read_text(encoding='utf-8')) for k in DATA}
    if '</style' in css.lower() or '</script' in (logic + app).lower():
        raise ValueError('Inline source contains an HTML close tag')
    logic = re.sub(r'\bexport\s+(?=(?:const|let|function|class)\s)', '', logic)
    app = re.sub(r'^import\s+\{[^\n]+\}\s+from\s+[\'\"]\./logic\.js[\'\"];\s*\n', '', app, count=1)
    if app.startswith('import '):
        raise ValueError('Failed to remove the JavaScript module import')
    old = "    const data=await Promise.all(keys.map(async key=>{const r=await fetch('./data/'+key+'.json');if(!r.ok)throw new Error(key+': HTTP '+r.status);return r.json();}));"
    new = ("    const seed=document.querySelector('#job-seed');\n"
           "    const embedded=seed?JSON.parse(seed.textContent):null;\n"
           "    const data=embedded?keys.map(key=>embedded[key]):await Promise.all(keys.map(async key=>{const r=await fetch('./data/'+key+'.json');if(!r.ok)throw new Error(key+': HTTP '+r.status);return r.json();}));")
    if app.count(old) != 1:
        raise ValueError('Failed to find the job-data fetch line; inspect app.js after edits')
    app = app.replace(old, new)
    inline_js = '\n' + logic + '\n' + app + '\n'
    digest = base64.b64encode(hashlib.sha256(inline_js.encode('utf-8')).digest()).decode('ascii')
    json_seed = json.dumps(data, separators=(',', ':'), ensure_ascii=False).replace('<', '\\u003c').replace('>', '\\u003e').replace('&', '\\u0026')
    if template.count('<link rel="stylesheet" href="./styles.css">') != 1 or template.count('<script type="module" src="./js/app.js"></script>') != 1:
        raise ValueError('The HTML template no longer matches expected asset references')
    html = template.replace('<link rel="stylesheet" href="./styles.css">', '<style>\n' + css + '\n</style>')
    html = html.replace('<div class="loading">Loading job research…</div>', fallback(data))
    html = html.replace('<script type="module" src="./js/app.js"></script>',
                        '<script type="application/json" id="job-seed">' + json_seed + '</script>\n<script>' + inline_js + '</script>')
    if html.count('id="job-seed"') != 1:
        raise ValueError('Missing job data')
    (root / 'index.html').write_text(html, encoding='utf-8')
    config_path = root / 'netlify.toml'
    config = config_path.read_text(encoding='utf-8')
    config = re.sub(r"script-src 'self'(?: 'sha256-[A-Za-z0-9+/=]+')?;",
                    "script-src 'self' 'sha256-" + digest + "';", config)
    if "script-src 'self' 'sha256-" + digest + "';" not in config:
        raise ValueError('Failed to update Content Security Policy script hash')
    config_path.write_text(config, encoding='utf-8')
    return digest, html


if __name__ == '__main__':
    h, content = build()
    print(f'Built index.html: {len(content):,} characters (CSP script SHA256: {h})')
