#!/usr/bin/env python3
"""Daily static-data refresh, Python standard library only.

Checks source URL reachability (never claims a job is open), recalculates deadline
states, and optionally populates Adzuna job-search results with user-provided
GitHub Actions secrets. Designed to be safe when a provider is unavailable.
"""
from __future__ import annotations
import argparse
import concurrent.futures
from datetime import date, datetime, timedelta, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import ssl
import urllib.error
import urllib.parse
import urllib.request
from zoneinfo import ZoneInfo

USER_AGENT = 'FieldnotesCareerAtlas/1.0 (+static source verification; contact repository owner)'
CONTEXT = ssl.create_default_context()
CANDIDATE_TERMS = ('museum','historic','historical','interpreter','interpretive','park','recreation','garden','horticultur','arboretum','auction','consign','coin','numismatic','bullion','book','library','docent','exhibit','heritage','education coordinator','outdoor educator')
EXCLUDED_CITY_TOKENS = ('los angeles','santa monica','long beach','beverly hills','west hollywood','culver city','hollywood','santa clarita','simi valley','irvine','san diego','anaheim')
ALLOWED_CITY_TOKENS = ('arcadia','monrovia','san marino','pasadena','whittier','claremont','pomona','upland','ontario','riverside','jurupa','rancho cucamonga','la verne','west covina','glendora','azusa','san dimas','covina','walnut','chino','chino hills','montclair','redlands','temple city','alhambra','monterey park','brea','la habra','fullerton')

def read_json(path: Path):
    with path.open(encoding='utf-8') as f: return json.load(f)

def write_json(path: Path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2, sort_keys=False)+'\n', encoding='utf-8')

def pacific_today(now: datetime | None = None):
    now = now or datetime.now(timezone.utc)
    return now.astimezone(ZoneInfo('America/Los_Angeles')).date()

def deadline_state(iso, now_date: date | None = None):
    now_date = now_date or pacific_today()
    if not iso: return {'state': 'unknown', 'daysRemaining': None}
    try: delta = (date.fromisoformat(iso) - now_date).days
    except (ValueError, TypeError): return {'state': 'unknown', 'daysRemaining': None}
    if delta < 0: status = 'passed'
    elif delta == 0: status = 'today'
    elif delta <= 7: status = 'soon'
    else: status = 'future'
    return {'state': status, 'daysRemaining': delta}

def fetch_bytes(url: str, timeout=8):
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme not in ('http','https') or not parsed.hostname:
        raise ValueError('Invalid HTTP(S) URL')
    req = urllib.request.Request(url, headers={'User-Agent':USER_AGENT, 'Accept':'text/html,application/json;q=0.8,*/*;q=0.5'})
    with urllib.request.urlopen(req, timeout=timeout, context=CONTEXT) as response:
        return response.status, response.read(250_000)

def check_link(item):
    try:
        code, _ = fetch_bytes(item['sourceUrl'])
        outcome = 'reachable' if 200 <= code < 400 else 'unreachable'
        return item['id'], {'result': outcome, 'httpStatus': code}
    except urllib.error.HTTPError as exc:
        return item['id'], {'result':'blocked' if exc.code in (401,403,429) else 'unreachable', 'httpStatus':exc.code}
    except (urllib.error.URLError,TimeoutError,OSError,ValueError) as exc:
        return item['id'], {'result':'unknown', 'httpStatus':None, 'error':type(exc).__name__}

def relevant_title(title):
    t=(title or '').lower()
    return any(keyword in t for keyword in CANDIDATE_TERMS)

def permitted_area(location):
    value=(location or '').lower()
    return bool(any(city in value for city in ALLOWED_CITY_TOKENS)) and not any(city in value for city in EXCLUDED_CITY_TOKENS)

def load_adzuna(app_id, app_key, checked_at):
    """Optional source; all results are labeled external and must be verified manually."""
    if not app_id or not app_key:
        return {'generatedAt': checked_at, 'status':'not-configured', 'message':'Add ADZUNA_APP_ID and ADZUNA_APP_KEY as GitHub Actions secrets to enable daily new-job discovery.', 'jobs':[]}
    searches=[('museum educator','Arcadia, California'),('park ranger','Pasadena, California'),('recreation coordinator','Pomona, California'),('auction','Monrovia, California'),('numismatic','Arcadia, California'),('horticulture','Claremont, California'),('library assistant','Claremont, California'),('historic','Riverside, California')]
    found={}; errors=[]
    for what,where in searches:
        params=urllib.parse.urlencode({'app_id':app_id,'app_key':app_key,'what':what,'where':where,'distance':30,'sort_by':'date','results_per_page':20,'content-type':'application/json'})
        url='https://api.adzuna.com/v1/api/jobs/us/search/1?'+params
        try:
            status, content=fetch_bytes(url,timeout=10)
            response=json.loads(content.decode('utf-8'))
            for job in response.get('results',[]):
                title=job.get('title',''); loc=job.get('location',{}).get('display_name',''); uri=job.get('redirect_url','')
                if not relevant_title(title) or not permitted_area(loc) or not uri.startswith('https://'):continue
                raw_id=str(job.get('id',''))
                if not raw_id:continue
                job_id='adzuna-'+re.sub(r'[^\w-]','',raw_id)[:55]
                if job_id in found:continue
                created=job.get('created','')
                try:
                    day=date.fromisoformat(created[:10]);fresh=(pacific_today()-day).days<=30
                except ValueError:fresh=False
                if not fresh:continue
                lo=job.get('salary_min');hi=job.get('salary_max')
                annual=(f'${int(lo):,}–${int(hi):,}/yr' if isinstance(lo,(int,float)) and isinstance(hi,(int,float)) and lo>0 else 'Check employer for pay')
                found[job_id]={'id':job_id,'title':title[:180], 'employer':job.get('company',{}).get('display_name','Employer not specified')[:120], 'city':loc[:130], 'category':'Third-party feed', 'salary':annual, 'schedule':'See original listing','sourceUrl':uri,'seenAt':created[:10] or pacific_today().isoformat(), 'note':'External Adzuna listing; details, availability and geography require independent confirmation.'}
        except Exception as e:  # Optional remote feed failure must not break the established research snapshot.
            errors.append(f'{what}: {type(e).__name__}')
    status='ok' if not errors else ('partial' if found else 'error')
    return {'generatedAt':checked_at,'status':status, 'message':f'{len(found)} relevant listings; {len(errors)} failed queries.', 'errors':errors[:8], 'jobs':list(found.values())[:35]}

def refresh(root: Path, offline=False, now: datetime | None = None):
    data=root/'data'
    opportunities=read_json(data/'opportunities.json')
    prev_path=data/'snapshot.json'
    previous=read_json(prev_path) if prev_path.exists() else {}
    now=now or datetime.now(timezone.utc)
    stamped=now.replace(microsecond=0).isoformat().replace('+00:00','Z')
    status={item['id']:deadline_state(item.get('deadline'),pacific_today(now)) for item in opportunities}
    if offline:
        links={item['id']:{'result':'not-checked','httpStatus':None} for item in opportunities}
    else:
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            pairs=executor.map(check_link,opportunities)
            links=dict(pairs)
    # A checksum flags a source change for human review; it does NOT rewrite personal inferences.
    source={'url':'https://vectorle.xyz/','state':'not-checked','changed':None}
    if not offline:
        try:
            _, payload=fetch_bytes(source['url'])
            digest=hashlib.sha256(payload).hexdigest()
            old=(previous.get('source') or {}).get('sha256')
            source.update({'state':'reachable','sha256':digest,'changed':bool(old and old!=digest)})
        except Exception as exc:
            source.update({'state':'unknown','error':type(exc).__name__})
    snapshot={'generatedAt':stamped,'timezone':'America/Los_Angeles','method':'Date arithmetic plus URL reachability; HTTP success never proves a position is open.','deadlines':status,'links':links,'source':source}
    write_json(prev_path,snapshot)
    feed=load_adzuna(os.environ.get('ADZUNA_APP_ID'),os.environ.get('ADZUNA_APP_KEY'),stamped) if not offline else {'generatedAt':stamped,'status':'not-configured','message':'Optional feed not checked in offline mode.','jobs':[]}
    write_json(data/'live_jobs.json',feed)
    print(f'Refreshed {len(opportunities)} deadlines, {len(links)} URL checks; feed: {feed["status"]}; {stamped}')
    return snapshot,feed

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1],help='Dashboard directory containing data/')
    ap.add_argument('--offline',action='store_true',help='Build a snapshot without network access (for tests / seed)')
    args=ap.parse_args();refresh(args.root,args.offline)
if __name__=='__main__': main()
