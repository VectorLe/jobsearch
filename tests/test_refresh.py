import json
import sys
import unittest
from datetime import date
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
import refresh

class RefreshTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):cls.geo=refresh.read_json(ROOT/'data/geo.json')
    def test_deadline_states(self):
        self.assertEqual(refresh.deadline_state('2026-11-30',date(2026,11,12))['daysRemaining'],18)
        self.assertEqual(refresh.deadline_state('2026-11-11',date(2026,11,12))['state'],'passed')
        self.assertEqual(refresh.deadline_state(None,date(2026,11,12))['state'],'unknown')
    def test_title_matching(self):
        self.assertTrue(refresh.relevant_title('Museum education coordinator'))
        self.assertFalse(refresh.relevant_title('AWS cloud engineer'))
    def test_city_match_avoids_LA_county_false_positive(self):
        self.assertEqual(refresh.identify_city({'area':['US','California','Los Angeles County','Arcadia'],'display_name':'Arcadia, Los Angeles County'},self.geo),'Arcadia')
        self.assertFalse(refresh.permitted_area('Los Angeles, California',self.geo))
        self.assertTrue(refresh.permitted_area('West Covina, California',self.geo))
    def test_center_is_sgv_and_outward_range(self):
        self.assertEqual(self.geo['reference'],'El Monte')
        center=self.geo['cities']['El Monte']
        self.assertLess(refresh.distance_miles(center,self.geo['cities']['Arcadia']),15)
        self.assertGreater(refresh.distance_miles(center,self.geo['cities']['Riverside']),30)
    def test_salary_label_distinguishes_estimates(self):
        pay,origin=refresh.salary_display({'salary_min':43000,'salary_max':58000,'salary_is_predicted':True})
        self.assertIn('43,000',pay)
        self.assertIn('estimated',origin)
    def test_curated_dates_never_invented(self):
        jobs=refresh.read_json(ROOT/'data/opportunities.json')
        self.assertEqual(len(jobs),len({job['id'] for job in jobs}))
        for job in jobs:
            self.assertTrue(job['sourceUrl'].startswith('https://'))
            self.assertRegex(job['observedAt'],r'^\d{4}-\d{2}-\d{2}$')
            self.assertIn('postedAt',job)
            if job['postedAt']:date.fromisoformat(job['postedAt'])
            self.assertIn(job['city'],self.geo['cities'])
    def test_feed_without_credentials_is_explicit(self):
        feed=refresh.load_adzuna(None,None,'2026-11-12T22:00:00Z',self.geo)
        self.assertEqual(feed['status'],'not-configured')
        self.assertEqual(feed['jobs'],[])

    def test_entire_sgv_cities_and_suggestions(self):
        self.assertEqual(len(self.geo['centers']),31)
        self.assertEqual(len(self.geo['communities']),13)
        self.assertTrue(all(city in self.geo['cities'] for city in self.geo['centers']))
        roles=refresh.read_json(ROOT/'data/role_ideas.json')
        self.assertGreaterEqual(len(roles),40)
        self.assertGreaterEqual(len([r for r in roles if r['category'] in ('E-commerce & digital','Technical & IT')]),10)
        self.assertTrue(all(r['typicalQualifications'] for r in roles))
    def test_technical_and_shopify_matching(self):
        self.assertTrue(refresh.relevant_title('Shopify merchandising specialist'))
        self.assertTrue(refresh.relevant_title('Computer support specialist'))
        self.assertTrue(refresh.relevant_title('Field service technician'))
        self.assertFalse(refresh.relevant_title('Senior cloud architect'))
        self.assertEqual(refresh.group_for('E-commerce Operations Coordinator'),'E-commerce & digital')
        self.assertEqual(refresh.group_for('IT Support Specialist'),'Technical & IT')
        self.assertEqual(refresh.identify_city('La Canada Flintridge, California',self.geo),'La Cañada Flintridge')
    def test_qualifications_from_external_excerpt_are_marked_as_unverified(self):
        result=refresh.extract_qualifications('<p>Minimum Qualifications: Two years of experience in technical support and basic communication skills.</p>')
        self.assertIn('Provider excerpt',result)
        self.assertIn('Two years',result)
        self.assertIn('not supplied',refresh.extract_qualifications('Small introduction without any job qualifications.'))

if __name__=='__main__':unittest.main()
