using System;
using UnityEditor;
using UnityEngine;

public static class BuildTokenColliderProbe
{
    public static void Run()
    {
        // Warhall expects centimetres with the catalog scale set to 1 / 2.54.
        const float diameter = 2.5f;
        const float height = 0.16f;
        var root = new GameObject("Shield Token Collider Probe");
        var collider = root.AddComponent<BoxCollider>();
        collider.center = Vector3.up * (height / 2);
        collider.size = new Vector3(diameter, height, diameter);
        var disc = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
        UnityEngine.Object.DestroyImmediate(disc.GetComponent<Collider>());
        disc.transform.SetParent(root.transform, false);
        disc.transform.localScale = new Vector3(diameter, height / 2, diameter);
        disc.transform.localPosition = collider.center;
        var material = new Material(Shader.Find("Standard"));
        material.mainTexture = AssetDatabase.LoadAssetAtPath<Texture2D>("Assets/TokenProbe.png");
        AssetDatabase.DeleteAsset("Assets/TokenProbe.mat");
        AssetDatabase.CreateAsset(material, "Assets/TokenProbe.mat");
        disc.GetComponent<Renderer>().sharedMaterial = material;
        PrefabUtility.SaveAsPrefabAsset(root, "Assets/TokenProbe.prefab");
        UnityEngine.Object.DestroyImmediate(root);
        var build = new AssetBundleBuild {
            assetBundleName = "shield-token-collider-windows.unity3d",
            assetNames = new[] { "Assets/TokenProbe.prefab" }
        };
        if (BuildPipeline.BuildAssetBundles("Output", new[] {build},
            BuildAssetBundleOptions.StrictMode | BuildAssetBundleOptions.ChunkBasedCompression |
            BuildAssetBundleOptions.AssetBundleStripUnityVersion, BuildTarget.StandaloneWindows64) == null)
            throw new Exception("Token bundle build failed.");
        var bundle = AssetBundle.LoadFromFile("Output/shield-token-collider-windows.unity3d");
        if (!bundle) throw new Exception("Token bundle load failed.");
        var instance = UnityEngine.Object.Instantiate(bundle.LoadAsset<GameObject>("Assets/TokenProbe.prefab"));
        if (!instance.GetComponent<Collider>()) throw new Exception("Missing root collider.");
        Physics.SyncTransforms();
        foreach (var point in new[] {Vector3.zero, Vector3.right * 1.15f, Vector3.forward * 1.15f, Vector3.left * 1.15f, Vector3.back * 1.15f})
            if (!Physics.Raycast(point + Vector3.up * 2f, Vector3.down, out var hit, 4f) ||
                hit.collider != instance.GetComponent<Collider>())
                throw new Exception("Token edge raycast missed: " + point);
        UnityEngine.Object.DestroyImmediate(instance);
        bundle.Unload(true);
        Debug.Log("TOKEN_COLLIDER_PROBE_OK");
    }
}
