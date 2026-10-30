"""Render cached OBJ candidates with their diffuse textures for pose review."""
import json
import math
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path('.cache/tts-preview')
FONT = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 15)

def load_obj(filename):
    vertices, uv, faces, texfaces = [], [], [], []
    for line in Path(filename).read_text(errors='replace').splitlines():
        parts = line.split()
        if not parts:
            continue
        if parts[0] == 'v':
            vertices.append([float(x) for x in parts[1:4]])
        elif parts[0] == 'vt':
            uv.append([float(x) for x in parts[1:3]])
        elif parts[0] == 'f':
            points = [x.split('/') for x in parts[1:]]
            for i in range(1, len(points)-1):
                triangle = [points[0], points[i], points[i+1]]
                faces.append([int(p[0])-1 if int(p[0]) > 0 else len(vertices)+int(p[0]) for p in triangle])
                texfaces.append([int(p[1])-1 if len(p)>1 and p[1] else 0 for p in triangle])
    return np.array(vertices), np.array(faces), np.array(uv), np.array(texfaces)

def render(v, f, uv, tf, texture, angle):
    width, height = 180, 210
    result = Image.new('RGB', (width, height), '#e8edf1')
    v = v - (v.max(axis=0) + v.min(axis=0))/2
    a = math.radians(angle)
    rotation = np.array([[math.cos(a),0,math.sin(a)],[0,1,0],[-math.sin(a),0,math.cos(a)]])
    v = v @ rotation.T
    a = math.radians(12)
    v = v @ np.array([[1,0,0],[0,math.cos(a),-math.sin(a)],[0,math.sin(a),math.cos(a)]]).T
    scale = min((width-14)/max(np.ptp(v[:,0]), 1e-6), (height-14)/max(np.ptp(v[:,1]),1e-6))
    p = np.stack([width/2+v[:,0]*scale, height/2-v[:,1]*scale], axis=1)
    normals = np.cross(v[f[:,1]]-v[f[:,0]], v[f[:,2]]-v[f[:,0]])
    normals /= np.maximum(np.linalg.norm(normals, axis=1, keepdims=True), 1e-10)
    light = np.array([-.4,.7,1.])
    light /= np.linalg.norm(light)
    shading = .48+.52*np.abs(normals@light)
    colors = np.tile([127,151,175], (len(f),1))
    if texture and Path(texture).exists() and len(uv):
        try:
            tex = np.array(Image.open(texture).convert('RGB'))
            coords = uv[tf].mean(axis=1) % 1
            colors = tex[np.clip(((1-coords[:,1])*(tex.shape[0]-1)).astype(int),0,tex.shape[0]-1), (coords[:,0]*(tex.shape[1]-1)).astype(int)]
        except Exception:
            pass
    colors = np.clip(colors*shading[:,None],0,255).astype(np.uint8)
    draw = ImageDraw.Draw(result)
    projected = p[f]
    for index in np.argsort(v[f,2].mean(axis=1)):
        draw.polygon([tuple(x) for x in projected[index]], fill=tuple(colors[index]))
    return result

candidates = json.loads((ROOT/'candidates.json').read_text())
selected = '--selected' in sys.argv
if selected:
    selections = json.loads(Path('model-selections.json').read_text())['models']
    selected_ids = {ref['candidateId'] for model in selections for ref in ([model['model']] if 'model' in model else []) + model.get('attachments', [])}
    candidates = [model for model in candidates if model['id'] in selected_ids]
unique = {}
for candidate in candidates:
    unique.setdefault((candidate['meshFile'], candidate['textureFile']) if selected else candidate['meshFile'], candidate)
records = []
for candidate in unique.values():
    filename = candidate['meshFile']
    if not Path(filename).exists():
        continue
    try:
        v,f,uv,tf = load_obj(filename)
        if not len(f):
            continue
        tile = Image.new('RGB',(380,250),'white')
        for i, angle in enumerate([35,145]):
            tile.paste(render(v,f,uv,tf,candidate['textureFile'], angle),(i*190,35))
        label = f"#{candidate['id']} {candidate['name']}"
        ImageDraw.Draw(tile).text((5,5),label[:48],font=FONT,fill='black')
        tile.save(ROOT/f"model-{candidate['id']:03d}.png")
        records.append({**candidate,'vertices':len(v),'faces':len(f),'dimensions':np.ptp(v,axis=0).tolist()})
        if len(records)%10==0:
            print(f'Rendered {len(records)}/{len(unique)} meshes',flush=True)
    except Exception as error:
        print(filename, error,flush=True)
for start in range(0,len(records),16):
    sheet = Image.new('RGB',(1520,1000),'white')
    for i, record in enumerate(records[start:start+16]):
        sheet.paste(Image.open(ROOT/f"model-{record['id']:03d}.png"),((i%4)*380,(i//4)*250))
    sheet.save(ROOT/f'{"selected" if selected else "sheet"}-{start//16+1:02d}.jpg')
with (ROOT/('selected-rendered.json' if selected else 'rendered.json')).open('w', encoding='utf-8', newline='\n') as output:
    output.write(json.dumps(records,indent=2) + '\n')
print(f'Saved {len(records)} previews and {math.ceil(len(records)/16)} sheets',flush=True)
