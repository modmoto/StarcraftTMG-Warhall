import json
import sys
from pathlib import Path

import numpy as np
import UnityPy
from UnityPy.export.MeshRendererExporter import get_mesh
from UnityPy.helpers.MeshHelper import MeshHandler

source, destination = map(Path, sys.argv[1:3])
environment = UnityPy.load(str(source), *sys.argv[3:])
transforms = {}
for obj in environment.objects:
    if obj.type.name == 'Transform':
        transform = obj.read()
        transforms[transform.m_GameObject.path_id] = transform


def local_matrix(transform):
    q = transform.m_LocalRotation
    x, y, z, w = q.x, q.y, q.z, q.w
    rotation = np.array([
        [1 - 2*y*y - 2*z*z, 2*x*y - 2*z*w, 2*x*z + 2*y*w],
        [2*x*y + 2*z*w, 1 - 2*x*x - 2*z*z, 2*y*z - 2*x*w],
        [2*x*z - 2*y*w, 2*y*z + 2*x*w, 1 - 2*x*x - 2*y*y],
    ])
    scale, position = transform.m_LocalScale, transform.m_LocalPosition
    matrix = np.eye(4)
    matrix[:3, :3] = rotation @ np.diag([scale.x, scale.y, scale.z])
    matrix[:3, 3] = [position.x, position.y, position.z]
    return matrix


world_cache = {}


def world(transform):
    key = transform.m_GameObject.path_id
    if key not in world_cache:
        world_cache[key] = (world(transform.m_Father.read()) @ local_matrix(transform)
                            if transform.m_Father else np.eye(4))
    return world_cache[key]


def material_texture(renderer, index):
    materials = renderer.m_Materials or []
    if index >= len(materials) or not materials[index]:
        return None
    try:
        material = materials[index].read()
    except FileNotFoundError:
        return None
    textures = material.m_SavedProperties.m_TexEnvs
    textures = sorted(textures, key=lambda item: 0 if str(item[0]) in ('_MainTex', '_BaseMap') else 1)
    for _, value in textures:
        if not value.m_Texture:
            continue
        texture = value.m_Texture.read()
        filename = destination.with_name(destination.stem + f'-texture-{value.m_Texture.path_id}.png')
        if not filename.exists():
            texture.image.save(filename)
        return str(filename)
    return None


meshes = []
for obj in environment.objects:
    if obj.type.name not in ('MeshRenderer', 'SkinnedMeshRenderer'):
        continue
    renderer = obj.read()
    if not getattr(renderer, 'm_Enabled', True) or not renderer.m_GameObject.read().m_IsActive:
        continue
    mesh = get_mesh(renderer)
    if mesh is None:
        continue
    handler = MeshHandler(mesh)
    handler.process()
    vertices = np.array(handler.m_Vertices, dtype=float)
    if vertices.size == 0:
        continue
    points = np.column_stack([vertices[:, :3], np.ones(len(vertices))])
    bones = getattr(renderer, 'm_Bones', None)
    indices, weights = handler.m_BoneIndices, handler.m_BoneWeights
    if bones and indices and weights and mesh.m_BindPose:
        matrices = []
        for bone, bind in zip(bones, mesh.m_BindPose):
            binding = np.array([[getattr(bind, f'e{r}{c}') for c in range(4)] for r in range(4)])
            matrices.append(world(bone.read()) @ binding)
        posed = np.zeros_like(points)
        for i, (bone_ids, bone_weights) in enumerate(zip(indices, weights)):
            total = 0
            for bone_id, weight in zip(bone_ids, bone_weights):
                if weight and 0 <= bone_id < len(matrices):
                    posed[i] += weight * (matrices[bone_id] @ points[i])
                    total += weight
            if total == 0:
                posed[i] = points[i]
        points = posed
    else:
        transform = transforms.get(renderer.m_GameObject.path_id)
        if transform:
            points = points @ world(transform).T
    uv = np.array(handler.m_UV0, dtype=float).tolist() if handler.m_UV0 else []
    for index, triangles in enumerate(handler.get_triangles()):
        faces = np.array(triangles, dtype=int).tolist()
        if not faces:
            continue
        meshes.append({
            'vertices': points[:, :3].tolist(), 'uv': uv, 'faces': faces,
            'textureFile': material_texture(renderer, index),
        })
if not meshes:
    raise RuntimeError('Unity bundle contains no visible mesh renderers')
destination.write_text(json.dumps(meshes, separators=(',', ':')))
