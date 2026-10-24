"""Download completed AppEEARS bundles, verifying length and SHA256."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import time
from urllib.parse import quote, urlparse
import requests
from appeears import AppEEARS, APIError, BASE, ROOT, save
from credential_store import read_token


def safe_path(root, name):
    path = PurePosixPath(name)
    if path.is_absolute() or '..' in path.parts or '\\' in name or ':' in name or not path.parts:
        raise ValueError('Unsafe bundle filename')
    dest = (root / Path(*path.parts)).resolve()
    if not dest.is_relative_to(root.resolve()):
        raise ValueError('Bundle path outside download directory')
    return dest


def verified(path, item):
    if not path.is_file() or path.stat().st_size != item['file_size']:
        return False
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest() == item['sha256']


def download(task_id, destination=None):
    api = AppEEARS(read_token())
    task = api.request('/task/' + quote(task_id, safe=''), auth=True)
    if task.get('status') != 'done':
        raise APIError('Task not complete: ' + str(task.get('status')))
    bundle = api.request('/bundle/' + quote(task_id, safe=''), auth=True)
    destination = Path(destination or ROOT / 'runtime' / task_id)
    destination.mkdir(parents=True, exist_ok=True)
    # Bundle manifest contains hashes/filenames, never authentication or signed URLs.
    save(destination / 'bundle-manifest.json', bundle)
    for item in bundle['files']:
        target = safe_path(destination, item['file_name'])
        if verified(target, item):
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        partial = target.with_name(target.name + '.partial')
        for attempt in range(3):
            try:
                endpoint = BASE + '/bundle/' + quote(task_id, safe='') + '/' + quote(item['file_id'], safe='')
                with requests.get(endpoint, headers={'Authorization': 'Bearer ' + api.token}, allow_redirects=False, timeout=(20, 60), stream=True) as response:
                    if response.status_code != 302:
                        raise ValueError('Expected signed download redirect')
                    signed = response.headers.get('Location', '')
                    parsed = urlparse(signed)
                    if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password:
                        raise ValueError('Invalid HTTPS download URL')
                # Separate request without account Authorization; reject any further redirects.
                with requests.get(signed, allow_redirects=False, timeout=(20, 120), stream=True) as stream:
                    if stream.status_code != 200:
                        raise ValueError('Download failed')
                    with partial.open('wb') as output:
                        for chunk in stream.iter_content(1024 * 1024):
                            output.write(chunk)
                if not verified(partial, item):
                    raise ValueError('Downloaded size/checksum mismatch')
                partial.replace(target)
                print(json.dumps({'downloaded': item['file_name'], 'bytes': item['file_size'], 'sha256_verified': True}), flush=True)
                break
            except (requests.RequestException, ValueError, OSError):
                if attempt == 2:
                    raise APIError('Download failed after three attempts; rerun to reuse verified files. File: ' + item['file_name']) from None
                time.sleep(3)
    save(destination / 'download-status.json', {'task_id': task_id, 'status': 'verified', 'files': len(bundle['files'])})
    return destination


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--task-id', required=True)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    try:
        print(download(args.task_id, args.output))
    except (APIError, RuntimeError, ValueError) as error:
        parser.exit(1, str(error) + '\n')
