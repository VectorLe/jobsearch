"""Make sure Netlify's single-file output does not silently regress."""
import base64
import hashlib
import json
from pathlib import Path
import re
import sys
import tomllib
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from build import build

class BuildTests(unittest.TestCase):
    def test_inline_assets_and_source_data(self):
        html=(ROOT/'index.html').read_text(encoding='utf-8')
        self.assertIn('<style>', html)
        self.assertIn('id="job-seed"', html)
        self.assertIn('class="job-card"', html)
        self.assertNotIn('src="./js/app.js"', html)
        self.assertNotIn('href="./styles.css"', html)
        m=re.search(r'<script type="application/json" id="job-seed">([\s\S]*?)</script>',html)
        self.assertIsNotNone(m)
        seed=json.loads(m.group(1))
        self.assertEqual(len(seed['opportunities']),len(json.loads((ROOT/'data/opportunities.json').read_text())))
    def test_inline_script_is_authorized_by_csp_hash(self):
        html=(ROOT/'index.html').read_text(encoding='utf-8')
        m=re.search(r'<script>([\s\S]*?)</script>\s*</body>',html)
        self.assertIsNotNone(m)
        digest=base64.b64encode(hashlib.sha256(m.group(1).encode('utf-8')).digest()).decode('ascii')
        config=tomllib.loads((ROOT/'netlify.toml').read_text())
        csp=config['headers'][0]['values']['Content-Security-Policy']
        self.assertIn("'sha256-"+digest+"'",csp)
        self.assertIn('base = "."',(ROOT/'netlify.toml').read_text())
        self.assertIn('publish = "."',(ROOT/'netlify.toml').read_text())

if __name__=='__main__': unittest.main()
