"""Check tracked files and all reachable history without printing secret values."""
import re
import subprocess
from pathlib import Path

def git(*args):
    return subprocess.check_output(['git', *args])

patterns = {
    'JWT': rb'eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}',
    'GitHub token': rb'(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})',
    'private key': rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
}
failures = []
files = git('ls-files', '-z').decode().split('\0')
for name in filter(None, files):
    if any(part in {'.secrets', '.venv', 'runtime', '.qa-browser'} for part in Path(name).parts) or name.endswith(('.dpapi', '.token', '.env')):
        failures.append((name, 'excluded file'))
    path = Path(name)
    if path.is_file():
        for label, pattern in patterns.items():
            if re.search(pattern, path.read_bytes()): failures.append((name, label))
objects = git('rev-list', '--objects', '--all').decode().splitlines()
for entry in objects:
    parts = entry.split(' ', 1)
    if len(parts) != 2: continue
    oid, name = parts
    if git('cat-file', '-t', oid).strip() != b'blob': continue
    content = git('cat-file', 'blob', oid)
    for label, pattern in patterns.items():
        if re.search(pattern, content): failures.append((oid[:8] + ':' + name, label))
for name, label in failures:
    print('BLOCKED:', label, 'in', name)
if failures: raise SystemExit(1)
print('PASS: tracked files and reachable history contain no matched credential patterns.')
