import hashlib
import json
from pathlib import Path
import unittest
from boundary_names import normalize_features

class BoundaryNamesTests(unittest.TestCase):
    def test_pinned_source_unchanged_and_all_regions_mapped(self):
        path = Path(__file__).parent / 'boundaries' / 'chn-adm1-source.geojson'
        self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(), '3a00467a0db9b4136facb5f2f3d0edbfd96adb15651cfdf63991da9281030e85')
        rows = normalize_features(json.loads(path.read_text(encoding='utf-8'))['features'])
        self.assertEqual(len(rows), 34)
        guangdong = next(row for row in rows if row['region_id'] == '440000')
        self.assertEqual(guangdong['source_name'], 'Guangzhou Province')
        self.assertEqual(guangdong['canonical_name'], 'Guangdong Province')
        self.assertEqual(guangdong['name_zh'], '广东省')

    def test_unknown_source_fails_explicitly(self):
        with self.assertRaises(ValueError):
            normalize_features([{'properties':{'shapeID':'unknown','shapeName':'Guangzhou Province'}}])
