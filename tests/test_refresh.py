import json
import sys
import unittest
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT/'scripts'))
import refresh

class RefreshTests(unittest.TestCase):
    def test_deadline_future(self):
        self.assertEqual(refresh.deadline_state('2026-11-30',date(2026,11,11)),{'state':'future','daysRemaining':19})
    def test_deadline_today(self):
        self.assertEqual(refresh.deadline_state('2026-11-11',date(2026,11,11))['state'],'today')
    def test_deadline_passed(self):
        self.assertEqual(refresh.deadline_state('2026-11-10',date(2026,11,11))['state'],'passed')
    def test_deadline_unknown(self):
        self.assertEqual(refresh.deadline_state(None,date(2026,11,11))['state'],'unknown')
    def test_candidate_filter(self):
        self.assertTrue(refresh.relevant_title('Museum Education Coordinator'))
        self.assertFalse(refresh.relevant_title('Senior AWS Architect'))
    def test_geo_filter(self):
        self.assertTrue(refresh.permitted_area('Arcadia, California'))
        self.assertFalse(refresh.permitted_area('Santa Monica, California'))
    def test_career_data_unique_and_scored(self):
        records=json.loads((ROOT/'data/careers.json').read_text())
        ids=[x['id'] for x in records]
        self.assertEqual(len(ids),len(set(ids)))
        self.assertGreaterEqual(len(records),12)
        self.assertTrue(all(set(x['scores'])=={'subject','movement','entry','income','autonomy','learning'} for x in records))
        self.assertTrue(all(all(1<=v<=5 for v in x['scores'].values()) for x in records))
    def test_jobs_explicit_source_and_date(self):
        records=json.loads((ROOT/'data/opportunities.json').read_text())
        for row in records:
            self.assertTrue(row['sourceUrl'].startswith('https://'))
            self.assertRegex(row['observedAt'],r'^\d{4}-\d{2}-\d{2}$')
            self.assertNotIn('isOpen',row)

if __name__=='__main__': unittest.main()
