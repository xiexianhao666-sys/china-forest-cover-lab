"""Derive province series from verified national annual raster downloads."""
import json
from pathlib import Path
from appeears import ROOT, save
from boundary_names import normalize_features
from summarize_rasters import summarize, _hash_file


def process():
    source = ROOT / 'boundaries' / 'chn-adm1-source.geojson'
    digest = _hash_file(source)
    provenance = json.loads((ROOT / 'boundaries' / 'provenance.json').read_text(encoding='utf-8'))
    if digest != provenance['source_sha256']:
        raise ValueError('Boundary hash changed; review provenance before calculating.')
    doc = json.loads(source.read_text(encoding='utf-8'))
    names = normalize_features(doc['features'])
    folder = ROOT / 'runtime' / 'regions'
    folder.mkdir(parents=True, exist_ok=True)
    for file in sorted((ROOT / 'runtime').glob('national-*.json')):
        national = json.loads(file.read_text(encoding='utf-8'))
        year = national['year']
        for feature, name in zip(doc['features'], names):
            boundary = folder / (name['region_id'] + '.geojson')
            if not boundary.exists():
                save(boundary, feature)
            output = folder / f"{name['region_id']}-{year}.json"
            if output.exists():
                prior = json.loads(output.read_text(encoding='utf-8'))
                if prior.get('sources', {}).get('province_source_sha256') == digest and prior['sources'].get('appeears_task_id') == national['sources']['appeears_task_id']:
                    continue
            result = summarize(national['sources']['lc_path'], boundary, year, national['sources']['qc_path'])
            result['region_id'] = name['region_id']
            result['name_zh'] = name['name_zh']
            result['sources']['province_source_sha256'] = digest
            result['sources']['appeears_task_id'] = national['sources']['appeears_task_id']
            save(output, result)
            print(json.dumps({'year': year, 'region_id': name['region_id'], 'status': result['status']}), flush=True)


if __name__ == '__main__':
    process()
