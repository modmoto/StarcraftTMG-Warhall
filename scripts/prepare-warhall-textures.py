"""Normalize TTS texture formats and faction accents in the local test cache.

Requires Pillow and numpy. Original CDN URLs stay in model-selections.json.
The shared Warhall catalogue needs compatible hosted textures for deployment.
"""
import argparse
import hashlib
import json
import shutil
import time
from pathlib import Path

import numpy as np
from PIL import Image

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('cache', type=Path)
parser.add_argument('--apply', action='store_true')
args = parser.parse_args()
cache = args.cache.resolve()
assert cache.name == 'TextureCache' and cache.parent.name == 'WarhallTest'
root = Path(__file__).resolve().parent.parent
models = json.loads((root / 'model-selections.json').read_text(encoding='utf8'))['models']
candidates = json.loads((root / '.cache/tts-preview/candidates.json').read_text(encoding='utf8'))
sources = {c['customMesh']['DiffuseURL']: root / c['textureFile'] for c in candidates}
backup = root / '.cache' / ('warhall-texture-backup-' + str(time.time_ns()))
seen = {}
for model in models:
    for part in [model['model'], *model.get('attachments', [])]:
        url = part.get('textureUrl')
        if not url:
            continue  # Raynor's bundle retains its embedded textures.
        faction = model['faction']
        assert url not in seen or seen[url] == faction, 'Cross-faction shared texture'
        if url in seen:
            continue
        seen[url] = faction
        filename = hashlib.sha256(url.encode()).hexdigest() + '.png'
        target = cache / filename
        source = sources.get(url)
        if not source or not source.is_file():
            raise FileNotFoundError(f'Original texture is not cached: {url}')
        original = Image.open(source).convert('RGBA')
        hsv = np.array(original.convert('RGB').convert('HSV'), copy=True)
        # Preserve neutral armour, dark outlines, skin, leather and brown chitin.
        hue, saturation, value = hsv[..., 0], hsv[..., 1], hsv[..., 2]
        accent = (saturation > 70) & (value > 40) & ((hue > 47) | (hue < 7))
        hsv[..., 0][accent] = {'Terran': 159, 'Zerg': 198, 'Protoss': 32}[faction]
        result = Image.fromarray(hsv, 'HSV').convert('RGBA')
        result.putalpha(original.getchannel('A'))
        if args.apply:
            backup.mkdir(parents=True, exist_ok=True)
            if target.exists():
                shutil.copy2(target, backup / filename)
            cache.mkdir(parents=True, exist_ok=True)
            result.save(target, format='PNG')
print(f'{"Applied" if args.apply else "Prepared"} {len(seen)} PNG textures; blue Terran, purple Zerg, gold Protoss.')
if args.apply:
    print(f'Backup: {backup}')
