"""Extract printed card faces without redrawing them. Requires Pillow, pypdf and pdftoppm."""
import hashlib
import json
import math
from pathlib import Path
import re
import subprocess

from PIL import Image
from pypdf import PdfReader
from pypdf._text_extraction import mult

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / '.cache/pdf'
DPI = 360
RENDERS = ROOT / f'.cache/cards/{DPI}dpi'
ASSETS = ROOT / 'Starcraft/assets/cards'
for directory in [RENDERS, ASSETS]:
    directory.mkdir(parents=True, exist_ok=True)

def read(file):
    return json.loads((ROOT / file).read_text(encoding='utf-8'))

def write(file, value):
    (ROOT / file).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')

def slug(value):
    return re.sub(r'[^a-z0-9]+', '_', value.lower()).strip('_')

def tokens(page):
    result = []
    def visit(text, cm, tm, font, size):
        m = mult(tm, cm)
        if text.strip():
            result.append({'text': text.strip(), 'x': m[4], 'y': float(page.mediabox.height) - m[5],
                           'size': math.hypot(m[0], m[1]) * size})
    page.extract_text(visitor_text=visit)
    return result

def inside(t, box):
    x0,y0,x1,y1 = box
    return x0 <= t['x'] <= x1 and y0 <= t['y'] <= y1

def title(ts, box):
    return ' '.join(t['text'].replace('\n', ' ') for t in ts if inside(t,box) and 13.5 < t['size'] < 14.5).strip()

def describe(ts, box, name, mission=False):
    parts = []
    if mission:
        ts = sorted(ts, key=lambda t: round(t['y'],1))
    phase_positions = {}
    for t in ts:
        if inside(t,box) and re.fullmatch(r'(?:ANY|MOVEMENT|ASSAULT|COMBAT|SCORING) PHASE', t['text']):
            phase_positions[t['text'].title()] = t['x']
    for token in ts:
        if not inside(token,box): continue
        if mission and not box[1]+60 <= token['y'] <= box[3]-12: continue
        text = token['text'].strip()
        if ('©' in text or 'Blizzard' in text or 'Archon' in text
            or re.fullmatch(r'v\s*[\d.]+',text,re.I)
            or text in ['STANDARD ENGAGEMENT','SKIRMISH LEVEL']
            or text.replace('\n',' ').strip() == name): continue
        parts.append(text)
    costs = [p for p in parts if re.fullmatch(r'(?:CP|PE|BM):\s*\d+',p)]
    parts = [p for p in parts if p not in costs]
    sections = []; pending = []
    for part in parts:
        if re.fullmatch(r'(?:ANY|MOVEMENT|ASSAULT|COMBAT|SCORING) PHASE',part):
            sections.append(part.title() + '\n' + ' '.join(pending));pending=[]
        else: pending.append(part)
    if pending: sections.append(' '.join(pending))
    sections.sort(key=lambda s: phase_positions.get(s.split('\n')[0], 9999))
    text = '\n\n'.join(costs+sections)
    text = re.sub(r'[ \t]+',' ',text)
    text = re.sub(r' +([.,;:)])',r'\1',text)
    text = re.sub(r'([A-Z][A-Z !’\'0-9(),/–-]{2,}:)\s*',lambda m:'\n\n'+m[1]+'\n',text)
    text = re.sub(r'\n{3,}','\n\n',text)
    if mission:
        header = [t['text'] for t in ts if inside(t,box) and t['y'] < box[1]+60]
        number = lambda v: v[0] if len(v)==2 and v[0]==v[1] else v
        supply = next((number(v) for v in header if re.fullmatch(r'\d+',v)), None)
        bonus = next((re.search(r'\+\d+',v)[0] for v in header if re.search(r'\+\d+',v)), None)
        length = next((number(re.search(r'GAME LENGTH:\s*(\d+)',v)[1]) for v in header if re.search(r'GAME LENGTH:\s*(\d+)',v)), None)
        metadata = [label+value for label,value in [('Supply: ',supply),('Round bonus: ',bonus),('Game length: ',length)] if value]
        text = '\n'.join(metadata) + '\n\n' + text
    return re.sub(r'\n{3,}', '\n\n', '\n'.join(line.rstrip() for line in text.splitlines())).strip()

def render(file, number):
    stem = RENDERS / (Path(file).stem + f'-{number}')
    target = stem.with_suffix('.png')
    if not target.exists():
        subprocess.run(['pdftoppm', '-f', str(number), '-singlefile', '-r', str(DPI), '-png', str(CACHE/file), str(stem)], check=True, capture_output=True)
    return Image.open(target)

def face(file, number, page, box, rotate=0):
    im = render(file, number)
    sx = im.width / float(page.mediabox.width)
    sy = im.height / float(page.mediabox.height)
    crop = im.crop(tuple(round(v * (sx if i % 2 == 0 else sy)) for i,v in enumerate(box)))
    if rotate:
        crop = crop.rotate(rotate, expand=True)
    # Content-addressed images also invalidate Warhall's URL texture cache.
    digest = hashlib.sha256(crop.tobytes()).hexdigest()[:24]
    name = f'{digest}.png'
    crop.convert('RGB').save(ASSETS/name, optimize=True)
    return f'https://raw.githubusercontent.com/modmoto/StarcraftTMG-Warhall/main/Starcraft/assets/cards/{name}'

cards = {}
groups = {}
report = []
missions = {}

def add(group, name, front, back, width, length, source, text=''):
    identity = f'sc_card_{slug(group)}_{slug(name)}'
    record = {'Id': identity, 'Name': name.title(), 'Type': 'Card', 'Description': name.title() + ('\n\n' + text if text else ''),
              'UIConfig': {'ImageURL': front, 'ImageURLBack': back, 'Width': width, 'Length': length,
                           'IsRound': False, 'ShowInitials': False, 'Border': False, 'Color': '#FFFFFF', 'Color2': '#FFFFFF'}}
    if identity in cards:
        assert cards[identity] == record, f'Conflicting card: {identity}'
        return
    cards[identity] = record
    groups.setdefault(group, []).append(identity)
    report.append({'id': identity, **source})

sources = read('.cache/pdf/sources.json')['cards']
documents = {s['file']: PdfReader(CACHE/s['file']) for s in sources}
units = read('Starcraft/import-report.json')['units']
unit_pages = {(u['card']['file'], u['card']['page']) for u in units}

for source in sources:
    file = source['file']
    for index,page in enumerate(documents[file].pages):
        number = index + 1
        if (file,number) in unit_pages:
            continue
        ts = tokens(page)
        # Tactical/faction/creep cards share a four-card print grid. Mixed pages
        # also contain deployments: only extract quadrants explicitly labelled as cards.
        for row in range(2):
            for col in range(2):
                x0 = 48 + col*249.5; y0 = 82 + row*357
                graphic = (x0,y0,x0+249.5,y0+178.5)
                labels = ' '.join(t['text'] for t in ts if inside(t,graphic))
                if not any(kind in labels for kind in ['TACTICAL CARD','FACTION CARD','CREEP CARD']):
                    continue
                name = title(ts,graphic)
                assert name, f'Missing tactical title: {file}:{number}:{row}:{col}'
                reverse = (x0,y0+178.5,x0+249.5,y0+357)
                text = describe(ts, reverse, name)
                add(source['faction']+' tactics', name, face(file,number,page,reverse,-90),
                    face(file,number,page,graphic,-90), 63,88, {'file':file,'page':number,'url':source['url']},text)
        # Standard missions occupy the left column; the right is skirmish.
        # Base missions repeat across factions, so use the Terran copy once.
        if source['wave'] == 1 and source['faction'] != 'Terran':
            continue
        for row in range(2):
            box = (98,98+row*340,297.5,438+row*340)
            labels = ' '.join(t['text'] for t in ts if inside(t,box))
            if 'SCORING CONDITIONS' not in labels or 'STANDARD ENGAGEMENT' not in labels:
                continue
            name = title(ts,box)
            assert name, f'Missing mission title: {file}:{number}'
            identity = slug(name)
            # Missions repeat between waves/factions; retain the first official copy.
            if identity in missions:
                continue
            image = face(file,number,page,box)
            text = describe(ts, box, name, mission=True)
            add('Missions',name,image,image,63,108,{'file':file,'page':number,'url':source['url']},text)
            missions[identity] = {'Id':f'sc_scoring_{identity}', 'Name':name.title(), 'Items':[]}

for deployment in read('deployment-report.json')['layouts']:
    src = deployment['sources'][0]
    file,number = src['file'],src['page']
    page = documents[file].pages[number-1]
    matches = [t for t in tokens(page) if re.sub(r'\s+',' ',t['text']).strip() == deployment['name']]
    assert len(matches) == 1, f"Ambiguous deployment title: {deployment['name']}"
    t = matches[0]
    col = int((t['x']-48)//249.5); row = int((t['y']-82)//178.5)
    assert col in (0,1) and row in (1,3), 'Unsupported standard deployment layout'
    box = (48+col*249.5,82+row*178.5,48+(col+1)*249.5,82+(row+1)*178.5)
    image = face(file,number,page,box)
    add('Deployments',deployment['name'],image,image,88,63,src,'Standard engagement deployment.')

assert not any(g.endswith(' units') for g in groups)
assert len(groups['Deployments']) == 7
assert len(missions) == 7, f'Expected seven standard scoring missions, got {list(missions)}'
write('Starcraft/cards.json',sorted(cards.values(),key=lambda c:c['Id']))
hierarchy = read('Starcraft/hierarchy.json');hierarchy['Cards']={k:sorted(v) for k,v in sorted(groups.items())};write('Starcraft/hierarchy.json',hierarchy)
existing = [o for o in read('Starcraft/objectives.json') if not o['Id'].startswith('sc_scoring_')]
write('Starcraft/objectives.json',existing+sorted(missions.values(),key=lambda m:m['Name']))
write('cards-report.json',{'imageDpi':DPI,'imageFormat':'lossless PNG','unitCards':False,'cards':report,'counts':{k:len(v) for k,v in sorted(groups.items())},'missions':len(missions)})
print(f'Extracted {len(cards)} cards and {len(missions)} scoring missions.')

# Remove only obsolete generated hash-named faces in the owned card directory.
used = {url.rsplit('/',1)[-1] for card in cards.values() for key,url in card['UIConfig'].items() if key in ('ImageURL','ImageURLBack')}
asset_root = ASSETS.resolve()
for file in ASSETS.iterdir():
    if re.fullmatch(r'[a-f0-9]{24}\.(?:jpg|png)',file.name) and file.name not in used:
        assert file.resolve().parent == asset_root
        file.unlink()
