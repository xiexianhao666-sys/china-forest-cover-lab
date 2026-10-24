"""Reproducibly union the pinned 34-feature research boundary."""
import hashlib
import json
from pathlib import Path
from shapely.geometry import shape, mapping
from shapely.ops import unary_union, transform
from pyproj import Transformer

root = Path(__file__).resolve().parent / 'boundaries'
source = root / 'chn-adm1-source.geojson'
digest = hashlib.sha256(source.read_bytes()).hexdigest()
assert digest == '3a00467a0db9b4136facb5f2f3d0edbfd96adb15651cfdf63991da9281030e85'
doc = json.loads(source.read_text(encoding='utf-8'))
assert len(doc['features']) == 34
geometries = [shape(f['geometry']) for f in doc['features']]
assert all(g.is_valid and not g.is_empty for g in geometries)
merged = unary_union(geometries)
assert merged.is_valid
names = [f['properties']['shapeName'] for f in doc['features']]
output = {'type': 'FeatureCollection', 'features': [{'type': 'Feature', 'properties': {'name': 'China_research_boundary'}, 'geometry': mapping(merged)}]}
(root / 'chn-national.geojson').write_text(json.dumps(output), encoding='utf-8')
projected = transform(Transformer.from_crs(4326, '+proj=sinu +R=6371007.181 +units=m', always_xy=True).transform, merged.segmentize(.05))
provenance = {'source_sha256': digest, 'source': 'https://www.geoboundaries.org/api/current/gbOpen/CHN/ADM1/', 'commit': '9469f09', 'boundary_year': 2019, 'license': 'Public Domain', 'attribution': 'geoBoundaries / Wikimedia Commons', 'feature_names': names, 'operation': 'unary_union; no simplification or repair', 'area_km2_native_modis_sphere': projected.area / 1e6, 'bounds': merged.bounds, 'limitations': 'Generalized research boundary, not an official standard map; narrow islands and coastal details may be omitted.'}
(root / 'provenance.json').write_text(json.dumps(provenance, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(provenance, ensure_ascii=True))
