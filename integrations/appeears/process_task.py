"""Check a submitted task and, when complete, download and summarize its real data."""
import argparse
from datetime import datetime, timezone
import json
import time
from pathlib import Path
from urllib.parse import quote
from appeears import AppEEARS, APIError, ROOT, save
from download_task import download
from summarize_rasters import summarize


def process(task_id, year, end_year=None, wait_seconds=0):
    api = AppEEARS()
    deadline = time.monotonic() + wait_seconds
    while True:
        task = api.request('/task/' + quote(task_id, safe=''), auth=True)
        save(ROOT / 'runtime' / 'pipeline-status.json', {
            'checked_at': datetime.now(timezone.utc).isoformat(), 'task_id': task_id,
            'task_name': task.get('task_name'), 'task_status': task.get('status'),
            'year': year, 'end_year': end_year or year, 'authentication_verified': True,
            'statistics_status': 'pending'})
        print(json.dumps({'task_status': task.get('status'), 'checked_at': datetime.now(timezone.utc).isoformat()}), flush=True)
        if task.get('status') in ['done', 'error', 'failed'] or time.monotonic() >= deadline:
            break
        time.sleep(min(30, max(0, deadline - time.monotonic())))
    status = {'checked_at': datetime.now(timezone.utc).isoformat(), 'task_id': task_id,
              'task_name': task.get('task_name'), 'task_status': task.get('status'),
              'year': year, 'end_year': end_year or year, 'authentication_verified': True, 'statistics_status': 'pending'}
    if task.get('status') == 'processing':
        try:
            progress = api.request('/status/' + quote(task_id, safe=''), auth=True)
            entries = progress if isinstance(progress, list) else [progress]
            matching = [entry for entry in entries if entry.get('progress')]
            if matching:
                status['progress'] = matching[-1]['progress']
        except APIError:
            pass  # A status transition can make the progress endpoint redirect; task state remains usable.
    save(ROOT / 'runtime' / 'pipeline-status.json', status)
    if task.get('status') != 'done':
        print(json.dumps(status), flush=True)
        return
    folder = download(task_id)
    for current_year in range(year, (end_year or year) + 1):
        layers = {}
        for layer in ['LC_Type1', 'QC']:
            matches = list(folder.rglob('*' + layer + '_doy' + str(current_year) + '*.tif'))
            if len(matches) != 1:
                raise APIError('Expected one complete annual GeoTIFF for ' + layer + ' ' + str(current_year) + '; inspect the bundle before mosaicking.')
            layers[layer] = matches[0]
        result = summarize(layers['LC_Type1'], ROOT / 'boundaries' / 'chn-national.geojson', current_year, layers['QC'])
        result['sources']['appeears_task_id'] = task_id
        save(ROOT / 'runtime' / f'national-{current_year}.json', result)
        print(json.dumps({'year': current_year, 'statistics_status': result['status']}), flush=True)
    status['statistics_status'] = result['status']
    status['result_years'] = list(range(year, (end_year or year) + 1))
    save(ROOT / 'runtime' / 'pipeline-status.json', status)
    print(json.dumps(status), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--task-id', required=True)
    parser.add_argument('--year', type=int, required=True)
    parser.add_argument('--end-year', type=int)
    parser.add_argument('--wait-seconds', type=int, default=0, help='Bounded polling before downloading; default check once')
    args = parser.parse_args()
    try:
        process(args.task_id, args.year, args.end_year, args.wait_seconds)
    except (APIError, RuntimeError, ValueError, OSError) as error:
        parser.exit(1, str(error) + '\n')
