using System;
using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEditorInternal;
using UnityEngine;
using UnityEngine.Rendering;

public static class BuildTokenColliders
{
    public static void Run() { Build(false); }

    public static void RunActivationTokens() { Build(true); }

    public static void RunMarkerHighlights() { Build(false, true); }

    private static void Build(bool activationOnly, bool markerHighlightsOnly = false)
    {
        InternalEditorUtility.AddTag("Token");
        // The native Warhall token renderer serializes Token as 20000 + 20.
        const int warhallTokenTagIndex = 20;
        var tagManager = new SerializedObject(AssetDatabase.LoadAllAssetsAtPath("ProjectSettings/TagManager.asset")[0]);
        var tags = tagManager.FindProperty("tags");
        int tokenIndex = 0;
        while (tags.GetArrayElementAtIndex(tokenIndex).stringValue != "Token")
            tokenIndex++;
        while (tags.arraySize <= warhallTokenTagIndex)
        {
            int index = tags.arraySize;
            tags.InsertArrayElementAtIndex(index);
            tags.GetArrayElementAtIndex(index).stringValue = "WarhallTagSlot" + index;
        }
        if (tokenIndex != warhallTokenTagIndex)
        {
            tags.MoveArrayElement(tokenIndex, warhallTokenTagIndex);
            tagManager.ApplyModifiedPropertiesWithoutUndo();
            AssetDatabase.SaveAssets();
            throw new Exception("Warhall Token tag configured. Restart Unity and run the builder again.");
        }
        var builds = new List<AssetBundleBuild>();
        var activeIds = new HashSet<string>(File.ReadAllLines("Assets/TokenColliderInput/active-ids.txt"));
        foreach (var directory in Directory.GetDirectories("Assets/TokenColliderInput"))
        {
            var id = Path.GetFileName(directory);
            if (!activeIds.Contains(id) || (id == "Token5Inch" || id == "sc_token_fire_wall" || id == "sc_token_flamer_template")) continue; // Dedicated template builder.
            if (markerHighlightsOnly && !id.StartsWith("sc_mission_") && id != "sc_token_infestation") continue;
            if (activationOnly && id != "sc_token_activation_blue_arrow" && id != "sc_token_activation_red_arrow") continue;
            var highlightParts = new HashSet<string>(File.ReadAllLines(directory + "/highlight-parts.txt"));
            var root = new GameObject(id);
            using (var input = new BinaryReader(File.OpenRead(directory + "/geometry.bytes")))
            {
                var diameter = input.ReadSingle();
                var collider = root.AddComponent<BoxCollider>();
                collider.size = new Vector3(diameter, 0.16f, diameter);
                collider.center = Vector3.zero;
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
                    visual.tag = highlightParts.Contains(part.ToString()) ? "Token" : "Untagged";
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
            BuildAssetBundleOptions.ForceRebuildAssetBundle | BuildAssetBundleOptions.StrictMode | BuildAssetBundleOptions.ChunkBasedCompression |
            BuildAssetBundleOptions.AssetBundleStripUnityVersion, BuildTarget.StandaloneWindows64) == null)
            throw new Exception("Token bundle build failed.");
        foreach (var build in builds)
        {
            var bundle = AssetBundle.LoadFromFile(output + "/" + build.assetBundleName);
            if (!bundle) throw new Exception("Token bundle load failed: " + build.assetBundleName);
            var instance = UnityEngine.Object.Instantiate(bundle.LoadAsset<GameObject>(build.assetNames[0]));
            var collider = instance.GetComponent<BoxCollider>();
            if (!collider) throw new Exception("Missing root collider: " + build.assetBundleName);
            var expectedTags = new HashSet<string>(File.ReadAllLines(Path.GetDirectoryName(build.assetNames[0]) + "/highlight-parts.txt"));
            foreach (var renderer in instance.GetComponentsInChildren<Renderer>())
                if (renderer.CompareTag("Token") != expectedTags.Contains(renderer.name.Replace("Visual ", "")))
                    throw new Exception("Wrong selection tag: " + build.assetBundleName);
            Physics.SyncTransforms();
            foreach (var direction in new[] { Vector3.zero, Vector3.right, Vector3.forward, Vector3.left, Vector3.back })
            {
                var origin = Vector3.up * 2 + direction * (collider.size.x * 0.46f);
                if (!Physics.Raycast(origin, Vector3.down, out var hit, 4f) || hit.collider != collider)
                    throw new Exception("Token edge raycast missed: " + build.assetBundleName);
            }
            if (Mathf.Abs(collider.size.x - 3.2f) > 0.0001f || collider.center != Vector3.zero)
                throw new Exception("Gameplay token must be centred and 32mm: " + build.assetBundleName);
            instance.transform.rotation = Quaternion.Euler(0, 0, 180);
            Physics.SyncTransforms();
            if (!collider.Raycast(new Ray(new Vector3(0, 2, 0), Vector3.down), out var reverseHit, 4) ||
                Mathf.Abs(reverseHit.point.y - 0.08f) > 0.0001f)
                throw new Exception("Token flip changed collider height: " + build.assetBundleName);
            instance.transform.rotation = Quaternion.identity;
            Physics.SyncTransforms();
            Debug.Log("TOKEN_FLIP_OK " + build.assetBundleName + " diameterMm=32 heightStable=true");
            if(activationOnly)
            {
                if(Mathf.Abs(collider.size.x-3.2f)>0.0001f || collider.center!=Vector3.zero)
                    throw new Exception("Activation token must be centred and 32mm");
                instance.transform.rotation=Quaternion.Euler(0,0,180);Physics.SyncTransforms();
                if(!Physics.Raycast(new Vector3(0,2,0),Vector3.down,out var flipped,4) || flipped.collider!=collider || Mathf.Abs(flipped.point.y-0.08f)>0.0001f)
                    throw new Exception("Flipped activation token changed table height");
                var renderers=instance.GetComponentsInChildren<MeshRenderer>();
                if(renderers.Length!=3)throw new Exception("Expected front, rim and back meshes");
                var back=renderers[2].GetComponent<MeshFilter>().sharedMesh;
                if(instance.transform.TransformDirection(back.normals[0]).y<0.99f)
                    throw new Exception("Back face points away after native Z flip");
                Debug.Log("ACTIVATION_FLIP_OK "+build.assetBundleName+" diameterMm=32 heightStable=true backFacesUp=true");
            }
            UnityEngine.Object.DestroyImmediate(instance);
            bundle.Unload(true);
        }
        Debug.Log("TOKEN_COLLIDERS_OK " + builds.Count);
    }
}
