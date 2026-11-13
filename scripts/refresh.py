#!/usr/bin/env python3
"""Daily source checks and optional San Gabriel Valley job discovery. Standard library only.

Employer posting dates are curated in data/opportunities.json. Adzuna creation dates
are provider-reported. A responsive URL does not confirm an open vacancy.
"""
from __future__ import annotations
import argparse
import concurrent.futures
from datetime import date, datetime, timezone
import html
import json
import math
import os
from pathlib import Path
import re
import ssl
import urllib.error
import urllib.parse
import urllib.request
from zoneinfo import ZoneInfo

USER_AGENT='FieldnotesJobWatch/2.0 (source status check)'
CONTEXT=ssl.create_default_context()
SEARCHES=[
    ('museum','El Monte, California',25),('recreation','El Monte, California',25),
    ('park','El Monte, California',35),('library','El Monte, California',30),
    ('museum educator','Pasadena, California',35),('historic','Pasadena, California',30),
    ('auction','Monrovia, California',30),('book','Pasadena, California',30),
    ('horticulture','Covina, California',40),('recreation','Covina, California',45),
    ('coin','Arcadia, California',40),('outdoor educator','Claremont, California',35)
]
TERMS=('museum','historic','historical','heritage','interpreter','interpretive','park','recreation','garden','horticultur','arboretum','auction','consign','coin','numismatic','bullion','book','library','docent','exhibit','education','educator','tutor','outdoor','trail','maintenance','visitor','antique','archiv','public program')


def read_json(path):return json.loads(Path(path).read_text(encoding='utf-8'))
def write_json(path,obj):Path(path).write_text(json.dumps(obj,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
def local_today(now=None):return (now or datetime.now(timezone.utc)).astimezone(ZoneInfo('America/Los_Angeles')).date()

def deadline_state(iso,today=None):
    today=today or local_today()
    if not iso:return {'state':'unknown','daysRemaining':None}
    try:days=(date.fromisoformat(iso)-today).days
    except (ValueError,TypeError):return {'state':'unknown','daysRemaining':None}
    return {'state': 'passed' if days<0 else 'today' if days==0 else 'soon' if days<=7 else 'future','daysRemaining':days}

def fetch_bytes(url,timeout=10):
    parsed=urllib.parse.urlsplit(url)
    if parsed.scheme!='https' or not parsed.hostname:raise ValueError('Expected HTTPS URL')
    req=urllib.request.Request(url,headers={'User-Agent':USER_AGENT,'Accept':'application/json,text/html;q=0.9,*/*;q=0.5'})
    with urllib.request.urlopen(req,timeout=timeout,context=CONTEXT) as res:
        return res.status,res.read(500_000)

def check_link(job):
    try:
        status,_=fetch_bytes(job['sourceUrl'],timeout=8)
        result='reachable' if 200<=status<400 else 'unreachable'
        return job['id'],{'result':result,'httpStatus':status}
    except urllib.error.HTTPError as e:
        return job['id'],{'result':'blocked' if e.code in (401,403,429) else 'unreachable','httpStatus':e.code}
    except (urllib.error.URLError,OSError,TimeoutError,ValueError) as e:
        return job['id'],{'result':'unknown','httpStatus':None,'error':type(e).__name__}

def relevant_title(title):return any(t in str(title or '').lower() for t in TERMS)

def identify_city(location,geo):
    cities=geo['cities']
    if isinstance(location,dict):
        area=location.get('area') or []
        if isinstance(area,list):
            for item in reversed(area):
                for city in cities:
                    if str(item).strip().casefold()==city.casefold():return city
        raw=location.get('display_name','')
    else:raw=str(location or '')
    first=str(raw).split(',')[0].strip().casefold()
    for city in cities:
        if first==city.casefold():return city
    return None

def permitted_area(location,geo):return identify_city(location,geo) is not None

def distance_miles(a,b):
    radius=3958.76
    lat1,lon1=(math.radians(v) for v in a)
    lat2,lon2=(math.radians(v) for v in b)
    delta_lat=lat2-lat1;delta_lon=lon2-lon1
    h=math.sin(delta_lat/2)**2+math.cos(lat1)*math.cos(lat2)*math.sin(delta_lon/2)**2
    return round(radius*2*math.atan2(math.sqrt(h),math.sqrt(max(0,1-h))))

def group_for(title):
    t=title.lower()
    if any(w in t for w in ('museum','historic','heritage','archive','interpret','docent')):return 'Heritage'
    if any(w in t for w in ('library','book','tutor','education','educator','teacher')):return 'Education & books'
    if any(w in t for w in ('coin','numismatic','auction','antique','bullion','consign')):return 'Objects & collectibles'
    return 'Outdoors & movement'

def clean_description(value):
    text=html.unescape(re.sub(r'<[^>]+>',' ',str(value or '')))
    return re.sub(r'\s+',' ',text).strip()[:280]

def salary_display(job):
    low=job.get('salary_min');high=job.get('salary_max')
    if not isinstance(low,(int,float)) or low<=0:return 'Pay not provided','Pay not verified'
    if not isinstance(high,(int,float)) or high<low:high=low
    predicted=bool(job.get('salary_is_predicted'))
    label='Adzuna estimated pay (verify)' if predicted else 'Provider-reported pay (verify)'
    return f'${low:,.0f}–${high:,.0f}/yr',label

def load_adzuna(app_id,app_key,checked_at,geo,previous=None):
    if not app_id or not app_key:
        return {'generatedAt':checked_at,'status':'not-configured','message':'Add ADZUNA_APP_ID and ADZUNA_APP_KEY in GitHub Actions secrets to enable daily discovery.','jobs':[]}
    previous=previous or []
    first_seen={x['id']:x.get('seenAt') for x in previous if isinstance(x,dict) and x.get('id')}
    base=geo['cities'][geo['reference']]
    found={};errors=[];today=local_today().isoformat()
    for what,where,radius in SEARCHES:
        params=urllib.parse.urlencode({'app_id':app_id,'app_key':app_key,'what':what,'where':where,'distance':radius,'sort_by':'date','results_per_page':20,'content-type':'application/json'})
        try:
            _,payload=fetch_bytes('https://api.adzuna.com/v1/api/jobs/us/search/1?'+params)
            for job in json.loads(payload.decode('utf-8')).get('results',[]):
                title=str(job.get('title') or '');city=identify_city(job.get('location') or {},geo)
                uri=str(job.get('redirect_url') or '')
                if not relevant_title(title) or not city or not uri.startswith('https://'):continue
                if distance_miles(base,geo['cities'][city])>75:continue
                raw_id=re.sub(r'[^a-zA-Z0-9-]','',str(job.get('id','')))[:55]
                if not raw_id:continue
                key='adzuna-'+raw_id
                date_text=str(job.get('created') or '')[:10]
                try:age=(local_today()-date.fromisoformat(date_text)).days
                except ValueError:continue
                if not 0<=age<=30:continue
                pay,source=salary_display(job)
                record={'id':key,'title':title[:180],'employer':str((job.get('company') or {}).get('display_name') or 'Employer not specified')[:130],
                    'city':city,'category':group_for(title),'salary':pay,'payType':source,
                    'schedule':'Check original listing','postedAt':date_text,'seenAt':first_seen.get(key) or today,
                    'sourceUrl':uri,'sourceType':'Adzuna feed','requirements':'See employer posting for required experience, education and certification.',
                    'note':clean_description(job.get('description')) or 'Verify the original employer listing for duties and availability.'}
                found[key]=record
        except (ValueError,KeyError,urllib.error.URLError,TimeoutError,OSError,UnicodeError) as e:
            errors.append(f'{what}: {type(e).__name__}')
    jobs=sorted(found.values(),key=lambda x:(distance_miles(base,geo['cities'][x['city']]),-date.fromisoformat(x['postedAt']).toordinal()))[:60]
    state='ok' if not errors else 'partial' if jobs else 'error'
    return {'generatedAt':checked_at,'status':state,'message':f'{len(jobs)} geographically matched jobs; {len(errors)} query errors.','errors':errors[:12],'jobs':jobs}

def refresh(root,offline=False,now=None):
    root=Path(root);data=root/'data';geo=read_json(data/'geo.json');jobs=read_json(data/'opportunities.json')
    stamp=(now or datetime.now(timezone.utc)).replace(microsecond=0).isoformat().replace('+00:00','Z')
    if offline:links={j['id']:{'result':'not-checked','httpStatus':None} for j in jobs}
    else:
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:links=dict(pool.map(check_link,jobs))
    snapshot={'generatedAt':stamp,'timezone':'America/Los_Angeles','center':geo['reference'],
              'method':'Deadline date checks and source URL reachability; reachable does not mean accepting applications.',
              'deadlines':{j['id']:deadline_state(j.get('deadline'),local_today(now)) for j in jobs},'links':links}
    write_json(data/'snapshot.json',snapshot)
    old_path=data/'live_jobs.json'
    previous=read_json(old_path).get('jobs',[]) if old_path.exists() else []
    feed=load_adzuna(os.environ.get('ADZUNA_APP_ID'),os.environ.get('ADZUNA_APP_KEY'),stamp,geo,previous) if not offline else {'generatedAt':stamp,'status':'not-configured','message':'Offline test: job API not queried.','jobs':[]}
    write_json(old_path,feed)
    print(f'Refreshed {len(jobs)} curated jobs; feed status: {feed["status"]}; {stamp}')
    return snapshot,feed

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1])
    parser.add_argument('--offline',action='store_true')
    options=parser.parse_args();refresh(options.root,options.offline)
if __name__=='__main__':main()
