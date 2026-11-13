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
DATA = ('opportunities', 'live_jobs', 'careers', 'places', 'tasks', 'geo', 'snapshot')


def fallback(data: dict) -> str:
    """Useful accessible job listings even if a browser blocks JavaScript."""
    now = datetime.now(ZoneInfo('America/Los_Angeles')).date()
    jobs = data['opportunities']
    visible = [j for j in jobs if not j.get('deadline') or j['deadline'] >= str(now)]
    if not visible:
        visible = jobs[:6]
    parts = [
        '<section class="hero"><div><span class="eyebrow">Job watch · Southern California</span>',
        '<h1>Find work <span>closer to home.</span></h1>',
        '<p>Job opportunities in and around the San Gabriel Valley, with published pay, location, posting dates and source links.</p>',
        '</div><div class="hero-aside"><strong>San Gabriel Valley first</strong>',
        '<p>Start in the valley and expand outward. Details are checked daily; verify open positions with each employer.</p></div></section>',
        '<section class="job-section"><h2 class="band-title">Job listings</h2><div class="job-grid">',
    ]
    for j in visible:
        source = escape(j.get('sourceUrl') or '#', quote=True)
        title = escape(j.get('title') or 'Job listing')
        city = escape(j.get('city') or 'Location unavailable')
        employer = escape(j.get('employer') or 'Employer unavailable')
        salary = escape(j.get('salary') or 'Pay not provided')
        schedule = escape(j.get('schedule') or 'Not specified')
        posted = escape(j.get('postedAt') or 'Date not provided')
        deadline = escape(j.get('deadline') or 'Not specified')
        note = escape(j.get('note') or 'Confirm details with the employer.')
        parts.append(
            f'<article class="job-card"><h3 class="job-title"><a href="{source}" target="_blank" rel="noopener noreferrer">{title}</a></h3>'
            f'<p class="employer">{employer} · {city}</p><div class="pay-box"><strong>{salary}</strong></div>'
            '<div class="job-facts">'
            f'<div class="fact"><label>Posted</label><span>{posted}</span></div>'
            f'<div class="fact"><label>Closing</label><span>{deadline}</span></div>'
            f'<div class="fact"><label>Schedule</label><span>{schedule}</span></div></div>'
            f'<p class="job-description">{note}</p><div class="job-actions"><a class="btn btn-primary" href="{source}" target="_blank" rel="noopener noreferrer">View listing ↗</a></div></article>'
        )
    parts.append('</div></section>')
    return ''.join(parts)


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
