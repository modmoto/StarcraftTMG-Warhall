using System;
using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEditorInternal;
using UnityEngine;
using UnityEngine.Rendering;

public static class BuildTokenColliders
{
    public static void Run()
    {
        InternalEditorUtility.AddTag("Token");
        var builds = new List<AssetBundleBuild>();
        foreach (var directory in Directory.GetDirectories("Assets/TokenColliderInput"))
        {
            var id = Path.GetFileName(directory);
            var root = new GameObject(id);
            using (var input = new BinaryReader(File.OpenRead(directory + "/geometry.bytes")))
            {
                var diameter = input.ReadSingle();
                var collider = root.AddComponent<BoxCollider>();
                collider.size = new Vector3(diameter, 0.16f, diameter);
                collider.center = Vector3.up * 0.08f;
                var parts = input.ReadInt32();
                for (var part = 0; part < parts; part++)
                {
                    var count = input.ReadInt32();
                    var vertices = new Vector3[count];
                    var uv = new Vector2[count];
                    var indices = new int[count];
                    for (var i = 0; i < count; i++)
                    {
                        vertices[i] = new Vector3(input.ReadSingle(), input.ReadSingle(), input.ReadSingle());
                        uv[i] = new Vector2(input.ReadSingle(), input.ReadSingle());
                        indices[i] = i;
                    }
                    var mesh = new Mesh { indexFormat = IndexFormat.UInt32, vertices = vertices, uv = uv, triangles = indices };
                    mesh.RecalculateNormals();
                    var material = new Material(Shader.Find("Standard"));
                    material.mainTexture = AssetDatabase.LoadAssetAtPath<Texture2D>(directory + "/" + part + ".png");
                    if (!material.mainTexture) throw new Exception("Missing token texture: " + id);
                    var prefix = directory + "/part-" + part;
                    AssetDatabase.DeleteAsset(prefix + ".asset");
                    AssetDatabase.DeleteAsset(prefix + ".mat");
                    AssetDatabase.CreateAsset(mesh, prefix + ".asset");
                    AssetDatabase.CreateAsset(material, prefix + ".mat");
                    var visual = new GameObject("Visual " + part);
                    visual.tag = "Token";
                    visual.transform.SetParent(root.transform, false);
                    visual.AddComponent<MeshFilter>().sharedMesh = mesh;
                    visual.AddComponent<MeshRenderer>().sharedMaterial = material;
                }
            }
            var prefab = directory + "/Token.prefab";
            PrefabUtility.SaveAsPrefabAsset(root, prefab);
            UnityEngine.Object.DestroyImmediate(root);
            builds.Add(new AssetBundleBuild { assetBundleName = id + ".unity3d", assetNames = new[] { prefab } });
        }
        const string output = "Output/TokenColliders";
        Directory.CreateDirectory(output);
        if (BuildPipeline.BuildAssetBundles(output, builds.ToArray(),
            BuildAssetBundleOptions.StrictMode | BuildAssetBundleOptions.ChunkBasedCompression |
            BuildAssetBundleOptions.AssetBundleStripUnityVersion, BuildTarget.StandaloneWindows64) == null)
            throw new Exception("Token bundle build failed.");
        foreach (var build in builds)
        {
            var bundle = AssetBundle.LoadFromFile(output + "/" + build.assetBundleName);
            if (!bundle) throw new Exception("Token bundle load failed: " + build.assetBundleName);
            var instance = UnityEngine.Object.Instantiate(bundle.LoadAsset<GameObject>(build.assetNames[0]));
            var collider = instance.GetComponent<BoxCollider>();
            if (!collider) throw new Exception("Missing root collider: " + build.assetBundleName);
            foreach (var renderer in instance.GetComponentsInChildren<Renderer>())
                if (!renderer.CompareTag("Token"))
                    throw new Exception("Missing selection tag: " + build.assetBundleName);
            Physics.SyncTransforms();
            foreach (var direction in new[] { Vector3.zero, Vector3.right, Vector3.forward, Vector3.left, Vector3.back })
            {
                var origin = Vector3.up * 2 + direction * (collider.size.x * 0.46f);
                if (!Physics.Raycast(origin, Vector3.down, out var hit, 4f) || hit.collider != collider)
                    throw new Exception("Token edge raycast missed: " + build.assetBundleName);
            }
            UnityEngine.Object.DestroyImmediate(instance);
            bundle.Unload(true);
        }
        Debug.Log("TOKEN_COLLIDERS_OK " + builds.Count);
    }
}
