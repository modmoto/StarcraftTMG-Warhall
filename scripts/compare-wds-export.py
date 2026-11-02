"""Read-only guard: compare a WDS editor ZIP with the checked-out Starcraft package.

Usage: python scripts/compare-wds-export.py EXPORT.zip
Exits 1 if editor data differs; never extracts files or overwrites repository data.
"""
import json
import sys
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parent.parent
manifest = json.loads((root / 'Starcraft/manifest.json').read_text(encoding='utf8'))
differences = []
with zipfile.ZipFile(sys.argv[1]) as archive:
    for name in sorted(set(manifest['files']) | {'version.json'}):
        expected = json.loads((root / 'Starcraft' / name).read_text(encoding='utf8'))
        if name not in archive.namelist():
            differences.append({'file': name, 'status': 'missing from editor'})
            continue
        actual = json.loads(archive.read(name))
        if expected == actual:
            continue
        item = {'file': name, 'status': 'different'}
        if isinstance(actual, list) and isinstance(expected, list):
            item.update(repoCount=len(expected), editorCount=len(actual))
            left = {r['Id']: r for r in expected if isinstance(r, dict) and 'Id' in r}
            right = {r['Id']: r for r in actual if isinstance(r, dict) and 'Id' in r}
            item.update(
                missingIds=sorted(left.keys() - right.keys()),
                extraIds=sorted(right.keys() - left.keys()),
                changedIds=sorted(k for k in left.keys() & right.keys() if left[k] != right[k]),
            )
        else:
            item.update(repo=expected, editor=actual)
        differences.append(item)
print(json.dumps({'repoVersion': manifest['version'], 'differences': differences}, indent=2))
sys.exit(bool(differences))
