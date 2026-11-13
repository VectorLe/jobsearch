"""Test public feed conversion using deterministic fixtures, no network required."""
import json
import sys
import unittest
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import public_feeds as feeds


class PublicFeedTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.geo = json.loads((ROOT / 'data/geo.json').read_text())

    def test_local_greenhouse_source(self):
        raw = {'id': 5432, 'title': 'Aftersales Engineer',
               'absolute_url': 'https://job-boards.greenhouse.io/ridemobilityllc/jobs/5432',
               'location': {'name': 'Pasadena, CA'},
               'first_published': '2026-11-11T16:00:00Z',
               'content': '<h3>Qualifications</h3><ul><li>Associate degree and two years in field service.</li></ul>'}
        out = feeds.normalize_greenhouse(raw, 'ridemobilityllc', 'RIDE Mobility', self.geo, date(2026, 11, 13), {})
        self.assertEqual(out['city'], 'Pasadena')
        self.assertEqual(out['postedAt'], '2026-11-11')
        self.assertEqual(out['provider'], 'greenhouse')
        self.assertIn('Associate degree', out['requirements'])
        self.assertIsNone(feeds.normalize_greenhouse({**raw, 'location': {'name': 'Los Angeles, CA'}},
                                                    'ridemobilityllc', 'RIDE Mobility', self.geo, date(2026, 11, 13), {}))

    def test_local_postings_handle_street_addresses_and_geographic_boundaries(self):
        self.assertEqual(feeds.local_city('666 Huntington Drive, Monrovia, CA', self.geo), 'Monrovia')
        self.assertEqual(feeds.local_city('La Canada Flintridge, CA', self.geo), 'La Cañada Flintridge')
        self.assertIsNone(feeds.local_city('Los Angeles Metropolitan Area', self.geo))
        self.assertIsNone(feeds.local_city('Pasadena, Texas', self.geo))
        self.assertIsNone(feeds.local_city('Pasadena, TX', self.geo))
        self.assertEqual(feeds.local_city('Pasadena, CA', self.geo), 'Pasadena')
        self.assertFalse(feeds.relevant('Senior Software Engineer', feeds.REMOTE_TITLES))

    def test_remote_jobicy_qualifications_and_published_pay(self):
        raw = {'id': 998, 'url': 'https://jobicy.com/jobs/shopify-specialist',
               'jobTitle': 'Shopify Support Specialist', 'companyName': 'Sample Shop',
               'jobGeo': 'USA', 'jobLevel': 'Mid-Level', 'jobType': ['Full-Time'],
               'jobExcerpt': 'Support store owners and solve platform issues.',
               'jobDescription': '<h3>Requirements</h3><p>Two years of Shopify support and clear customer writing.</p>',
               'pubDate': '2026-11-12T08:00:00Z', 'salaryMin': 50000, 'salaryMax': 70000,
               'salaryCurrency': 'USD', 'salaryPeriod': 'yearly'}
        job = feeds.normalize_jobicy(raw, date(2026, 11, 13), {})
        self.assertEqual(job['city'], 'Remote')
        self.assertEqual(job['salary'], '$50,000 to $70,000/yr')
        self.assertIn('Shopify support', job['requirements'])
        self.assertEqual(job['postedAt'], '2026-11-12')
        self.assertIsNone(feeds.normalize_jobicy({**raw, 'pubDate': '2026-10-01T08:00:00Z'},
                                                 date(2026, 11, 13), {}))
        self.assertIsNone(feeds.normalize_jobicy({**raw, 'jobTitle': 'Principal Software Engineer'},
                                                 date(2026, 11, 13), {}))
        self.assertIsNone(feeds.normalize_jobicy({**raw, 'jobGeo': 'Europe only'},
                                                 date(2026, 11, 13), {}))

    def test_fetch_fails_gracefully_and_retains_short_lived_stale_record(self):
        previous = [{'id': 'jobicy-998', 'provider': 'jobicy', 'city': 'Remote',
                     'observedAt': '2026-11-12', 'postedAt': '2026-11-11', 'title': 'Shopify Specialist'}]
        def fail(*args, **kwargs):
            raise OSError('Fixture outage')
        jobs, sources, errors = feeds.load_public_jobs(self.geo, '2026-11-13T08:00:00Z', previous, fail)
        self.assertEqual(sources['greenhouse'], 0)
        self.assertEqual(sources['jobicy'], 0)
        self.assertTrue(errors)
        self.assertEqual(len(jobs), 1)
        self.assertTrue(jobs[0]['feedStale'])
        jobs, _, _ = feeds.load_public_jobs(self.geo, '2026-11-20T08:00:00Z', previous, fail)
        self.assertEqual(jobs, [])

    def test_greenhouse_and_jobicy_pagination_no_secrets(self):
        calls = []
        def fixture(url, timeout=16):
            calls.append(url)
            if 'greenhouse' in url:
                return {'jobs': [{'id': 999, 'title': 'Technical Support Specialist',
                                  'location': {'name': 'Arcadia, CA'},
                                  'absolute_url': 'https://job-boards.greenhouse.io/sample/jobs/999',
                                  'first_published':'2026-11-12T14:00:00Z',
                                  'content': '<p>Provide technical assistance.</p>'}]}
            if 'remotive' in url:
                return {'jobs': [{'id': 123, 'title': 'E-commerce Support Specialist', 'company_name': 'Test', 'url':'https://remotive.com/remote-jobs/customer-support/test-123','publication_date':'2026-11-12T14:00:00', 'candidate_required_location':'USA'}]}
            return {'success': True, 'jobs': [{'id': 100, 'url': 'https://jobicy.com/jobs/customer-support',
                                              'jobTitle': 'Customer Support Specialist',
                                              'companyName': 'Sample Co', 'pubDate': '2026-11-12T12:00:00Z',
                                              'jobGeo': 'USA'}], 'nextCursor': None}
        jobs, counts, errors = feeds.load_public_jobs(self.geo, '2026-11-13T00:00:00Z', [], fixture)
        self.assertEqual(len(jobs), len(feeds.GREENHOUSE_BOARDS)+2)
        self.assertEqual(counts['greenhouse'],len(feeds.GREENHOUSE_BOARDS))
        self.assertEqual(counts['jobicy'],1)
        self.assertEqual(counts['remotive'],1)
        self.assertFalse(errors)
        self.assertTrue(any('geo=usa' in u for u in calls))

    def test_old_or_undated_greenhouse_and_remotive_are_excluded(self):
        raw={'id': 66, 'title':'Maintenance Technician', 'location':{'name':'Arcadia, CA'},
             'absolute_url':'https://job-boards.greenhouse.io/test/jobs/66',
             'content':'Repair equipment.'}
        self.assertIsNone(feeds.normalize_greenhouse(raw,'test','Test',self.geo,date(2026,11,13),{}))
        self.assertIsNone(feeds.normalize_greenhouse({**raw,'first_published':'2026-10-01'},'test','Test',self.geo,date(2026,11,13),{}))
        self.assertIsNone(feeds.normalize_remotive({'id':77,'title':'Shopify Support Specialist','url':'https://remotive.com/remote-jobs/test','publication_date':'2026-11-12','candidate_required_location':'UK only'},date(2026,11,13),{}))

    def test_markup_and_external_em_dash_are_sanitized(self):
        raw = 'Required Skills: Shopify ' + chr(8212) + ' two years experience'
        self.assertNotIn(chr(8212), feeds.plain_html('<p>'+raw+'</p>'))
        self.assertNotIn(chr(8212), feeds.qualifications(raw))


if __name__ == '__main__':
    unittest.main()
