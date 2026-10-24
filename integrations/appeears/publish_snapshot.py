"""Create credential-free web snapshots and nearest-neighbour raster previews."""
import argparse
import json
from pathlib import Path
import numpy as np
import rasterio
from rasterio.transform import from_bounds
from rasterio.warp import reproject, Resampling
from appeears import ROOT


def export(site):
    dest = Path(site) / 'dist'
    records = []
    for file in sorted((ROOT / 'runtime').glob('national-*.json')):
        result = json.loads(file.read_text(encoding='utf-8'))
        year = result['year']
        grids = {}
        for layer, key in [('lc', 'lc_path'), ('qc', 'qc_path')]:
            grid = np.full((800, 1300), 255, dtype='uint8')
            with rasterio.open(result['sources'][key]) as source:
                reproject(source=rasterio.band(source, 1), destination=grid,
                          src_transform=source.transform, src_crs=source.crs,
                          dst_transform=from_bounds(72, 15, 137, 55, 1300, 800),
                          dst_crs='EPSG:4326', src_nodata=255, dst_nodata=255,
                          resampling=Resampling.nearest)
            grids[layer] = grid
        valid = (grids['lc'] >= 1) & (grids['lc'] <= 17) & np.isin(grids['qc'], [0, 2, 4, 5, 6, 7, 8, 9])
        forest = valid & (grids['lc'] <= 5)
        water = valid & (grids['lc'] == 17)
        rgba = np.zeros((4, 800, 1300), dtype='uint8')
        rgba[:, valid] = np.array([226, 230, 220, 255])[:, None]
        rgba[:, forest] = np.array([32, 112, 78, 255])[:, None]
        rgba[:, water] = np.array([158, 195, 214, 255])[:, None]
        with rasterio.open(dest / f'forest-{year}.png', 'w', driver='PNG', width=1300, height=800, count=4, dtype='uint8') as output:
            output.write(rgba)
        result['sources'] = {key: value for key, value in result['sources'].items() if not key.endswith('_path')}
        records.append(result)
    status = json.loads((ROOT / 'runtime' / 'pipeline-status.json').read_text(encoding='utf-8'))
    provenance = json.loads((ROOT / 'boundaries' / 'provenance.json').read_text(encoding='utf-8'))
    payload = {'records': records, 'pipeline': status, 'boundary': provenance,
               'preview': {'bounds': [72, 15, 137, 55], 'method': 'nearest neighbour', 'purpose': 'display only; areas calculated from native full resolution'}}
    (dest / 'real-data.js').write_text('window.FOREST_REAL_DATA=' + json.dumps(payload, ensure_ascii=False) + ';\n', encoding='utf-8')
    (dest / 'national-statistics.json').write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'exported_years': [r['year'] for r in records]}))


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--site', required=True, type=Path)
    export(p.parse_args().site)
