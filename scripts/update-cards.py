"""Extract printed card faces without redrawing them. Requires Pillow, pypdf and pdftoppm."""
import hashlib
import json
import math
from pathlib import Path
import re
import subprocess

from PIL import Image, ImageDraw
from pypdf import PdfReader
from pypdf._text_extraction import mult

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / '.cache/pdf'
DPI = 600
MAX_EDGE = 2048
RENDERS = ROOT / f'.cache/cards/{DPI}dpi'
ASSETS = ROOT / 'Starcraft-test/assets/cards'
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

trim_cache = {}

def trim_box(file, number, page, rough):
    key = (file, number)
    if key not in trim_cache:
        rectangles = []
        def visit(operator, arguments, cm, tm):
            if operator != b're':
                return
            x, y, width, height = map(float, arguments)
            corners = [(cm[0]*px + cm[2]*py + cm[4], cm[1]*px + cm[3]*py + cm[5])
                       for px, py in [(x,y),(x+width,y),(x,y+height),(x+width,y+height)]]
            left, right = min(p[0] for p in corners), max(p[0] for p in corners)
            bottom, top = min(p[1] for p in corners), max(p[1] for p in corners)
            if right-left > 180 and top-bottom > 170:
                rectangles.append((left, float(page.mediabox.height)-top, right, float(page.mediabox.height)-bottom))
        page.extract_text(visitor_operand_after=visit)
        trim_cache[key] = rectangles
    bleed = 3 * 72 / 25.4
    width, height = rough[2]-rough[0], rough[3]-rough[1]
    candidates = []
    for left, top, right, bottom in trim_cache[key]:
        if abs((right-left)-width-2*bleed) > 2.5 or abs((bottom-top)-height-2*bleed) > 2.5:
            continue
        distance = abs((left+right)-(rough[0]+rough[2])) + abs((top+bottom)-(rough[1]+rough[3]))
        if distance < 100:
            candidates.append((distance, (left+bleed,top+bleed,right-bleed,bottom-bleed)))
    assert candidates, f'Missing exact card trim: {file}:{number}:{rough}'
    return min(candidates)[1]

def face(file, number, page, box, rotate=0, label='card'):
    exact = trim_box(file, number, page, box)
    im = render(file, number)
    sx = im.width / float(page.mediabox.width)
    sy = im.height / float(page.mediabox.height)
    crop = im.crop(tuple(round(v * (sx if i % 2 == 0 else sy)) for i,v in enumerate(exact)))
    if rotate:
        crop = crop.rotate(rotate, expand=True)
    size = tuple(round(value * MAX_EDGE / max(crop.size)) for value in crop.size)
    assert max(crop.size) >= MAX_EDGE, f'Insufficient source resolution: {file}:{number}'
    crop = crop.convert('RGB')
    for side in ['left', 'right']:
        for _ in range(12):
            x = 0 if side == 'left' else crop.width - 1
            strip = list(crop.crop((x, crop.height//5, x+1, crop.height*4//5)).getdata())
            if sum(min(pixel) >= 252 for pixel in strip) < len(strip) * 0.98:
                break
            crop = crop.crop((1 if side == 'left' else 0, 0,
                              crop.width-1 if side == 'right' else crop.width, crop.height))
    crop = crop.resize(size, Image.Resampling.LANCZOS).convert('RGBA')
    mask = Image.new('L', (size[0]*2,size[1]*2), 0)
    radius = MAX_EDGE * (2.5 * 72 / 25.4) / max(exact[2]-exact[0], exact[3]-exact[1])
    ImageDraw.Draw(mask).rounded_rectangle((2,2,size[0]*2-3,size[1]*2-3), radius=radius*2, fill=255)
    crop.putalpha(mask.resize(size, Image.Resampling.LANCZOS))
    digest = hashlib.sha256(crop.tobytes()).hexdigest()[:12]
    name = f'{slug(label)}-{digest}.png'
    crop.save(ASSETS/name, optimize=True)
    return f'https://raw.githubusercontent.com/modmoto/StarcraftTMG-Warhall/main/Starcraft-test/assets/cards/{name}'

cards = {}
groups = {}
report = []
missions = {}

def add(group, name, front, back, width, length, source, text=''):
    identity = f'sc_card_{slug(group)}_{slug(name)}'
    record = {'Id': identity, 'Name': name.title(), 'Type': 'Card', 'Description': name.title() + ('\n\n' + text if text else ''),
              'UIConfig': {'ImageURL': front, 'ImageURLBack': back, 'Width': width, 'Length': length,
                           'IsRound': False, 'ShowInitials': False, 'Border': False, 'Color': '#FFFFFF', 'Color2': ''}}
    if identity in cards:
        assert cards[identity] == record, f'Conflicting card: {identity}'
        return
    cards[identity] = record
    groups.setdefault(group, []).append(identity)
    report.append({'id': identity, **source})

sources = read('.cache/pdf/sources.json')['cards']
documents = {s['file']: PdfReader(CACHE/s['file']) for s in sources}
units = read('Starcraft-test/import-report.json')['units']
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
                add(source['faction']+' tactics', name, face(file,number,page,reverse,-90,label=source['faction']+'-'+name+'-front'),
                    face(file,number,page,graphic,-90,label=source['faction']+'-'+name+'-back'), 63,88, {'file':file,'page':number,'url':source['url']},text)
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
            image = face(file,number,page,box,label='scenario-'+name+'-front')
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
    image = face(file,number,page,box,label='deployment-'+deployment['name']+'-front')
    add('Deployments',deployment['name'],image,image,88,63,src,'Standard engagement deployment.')

assert not any(g.endswith(' units') for g in groups)
assert len(groups['Deployments']) == 7
assert len(missions) == 7, f'Expected seven standard scoring missions, got {list(missions)}'
write('Starcraft-test/cards.json',sorted(cards.values(),key=lambda c:c['Id']))
hierarchy = read('Starcraft-test/hierarchy.json');hierarchy['Cards']={k:sorted(v) for k,v in sorted(groups.items())};write('Starcraft-test/hierarchy.json',hierarchy)
write('Starcraft-test/objectives.json',[])
write('cards-report.json',{'imageDpi':DPI,'maxImageEdge':MAX_EDGE,'cropMethod':'PDF bleed rectangles with exact 3mm trim inset','imageFormat':'lossless PNG','unitCards':False,'cards':report,'counts':{k:len(v) for k,v in sorted(groups.items())},'missions':len(missions)})
print(f'Extracted {len(cards)} cards and {len(missions)} scoring missions.')

# Remove only obsolete generated hash-named faces in the owned card directory.
used = {url.rsplit('/',1)[-1] for card in cards.values() for key,url in card['UIConfig'].items() if key in ('ImageURL','ImageURLBack')}
asset_root = ASSETS.resolve()
for file in ASSETS.iterdir():
    if re.fullmatch(r'(?:[a-f0-9]{24}|[a-z0-9_-]+-[a-f0-9]{12})\.(?:jpg|png)',file.name) and file.name not in used:
        assert file.resolve().parent == asset_root
        file.unlink()
