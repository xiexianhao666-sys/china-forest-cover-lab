"""Normalize version-pinned boundary labels without editing source geometry."""
import json
from pathlib import Path

REGISTRY = Path(__file__).resolve().parent / 'boundaries' / 'region-names.json'

def normalize_features(features):
    registry = json.loads(REGISTRY.read_text(encoding='utf-8'))
    by_id = {row['source_shape_id']: row for row in registry}
    rows = []
    for feature in features:
        source = feature['properties']
        row = by_id.get(source['shapeID'])
        if row is None or row['source_name'] != source['shapeName']:
            raise ValueError('Unrecognized boundary version/name; review region mapping before statistics.')
        rows.append(dict(row))
    if len({row['region_id'] for row in rows}) != len(rows):
        raise ValueError('Duplicate region identifiers.')
    return rows
