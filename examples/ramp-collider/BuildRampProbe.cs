using System;
using UnityEditor;
using UnityEngine;

public static class BuildRampProbe
{
    public static void Run()
    {
        var root = new GameObject("Ramp Collider Probe");
        var mesh = new Mesh();
        mesh.vertices = new[] {
            new Vector3(-5,0,-3), new Vector3(5,0,-3),
            new Vector3(-5,2,1), new Vector3(5,2,1),
            new Vector3(-5,2,3), new Vector3(5,2,3),
        };
        mesh.triangles = new[] { 0,2,1, 1,2,3, 2,4,3, 3,4,5 };
        mesh.RecalculateNormals();
        AssetDatabase.CreateAsset(mesh, "Assets/Ramp.asset");
        var material = new Material(Shader.Find("Standard"));
        material.color = new Color(0.15f,0.65f,0.8f,1);
        AssetDatabase.CreateAsset(material, "Assets/Ramp.mat");
        var visual = new GameObject("Visible ramp");
        visual.transform.SetParent(root.transform,false);
        visual.AddComponent<MeshFilter>().sharedMesh = mesh;
        visual.AddComponent<MeshRenderer>().sharedMaterial = material;
        var surface = new GameObject("Walkable collider only");
        surface.transform.SetParent(root.transform,false);
        surface.layer = 15;
        surface.AddComponent<MeshCollider>().sharedMesh = mesh;
        PrefabUtility.SaveAsPrefabAsset(root, "Assets/RampProbe.prefab");
        UnityEngine.Object.DestroyImmediate(root);
        var build = new AssetBundleBuild {
            assetBundleName = "ramp-probe.unity3d",
            assetNames = new[] { "Assets/RampProbe.prefab" },
        };
        var flags = BuildAssetBundleOptions.StrictMode
            | BuildAssetBundleOptions.ForceRebuildAssetBundle
            | BuildAssetBundleOptions.ChunkBasedCompression
            | BuildAssetBundleOptions.AssetBundleStripUnityVersion;
        if (BuildPipeline.BuildAssetBundles("Output",new[]{build},flags,BuildTarget.StandaloneWindows64)==null)
            throw new Exception("Bundle build failed");
        var bundle = AssetBundle.LoadFromFile("Output/ramp-probe.unity3d");
        if (!bundle) throw new Exception("Built bundle failed local load");
        var prefab = bundle.LoadAsset<GameObject>("Assets/RampProbe.prefab");
        var collider = prefab.GetComponentInChildren<MeshCollider>();
        if (!collider || collider.gameObject.layer != 15 || collider.GetComponent<Renderer>())
            throw new Exception("Collider hierarchy invalid");
        var instance = UnityEngine.Object.Instantiate(prefab);
        // Match the client's reassignment of the root and renderers.
        instance.layer = 0;
        foreach (var renderer in instance.GetComponentsInChildren<Renderer>())
            renderer.gameObject.layer = 0;
        Physics.SyncTransforms();
        var samples = new[] { new Vector2(-2, 0.5f), new Vector2(0, 1.5f), new Vector2(2, 2) };
        foreach (var sample in samples)
        {
            if (!Physics.Raycast(new Vector3(0, 10, sample.x), Vector3.down, out var hit, 20, 1 << 15))
                throw new Exception("No elevated-ground hit at " + sample.x);
            if (Mathf.Abs(hit.point.y - sample.y) > 0.01f)
                throw new Exception("Incorrect ramp height at " + sample.x + ": " + hit.point.y);
            Debug.Log("RAMP_HEIGHT_OK z=" + sample.x + " height=" + hit.point.y);
        }
        UnityEngine.Object.DestroyImmediate(instance);
        Debug.Log("RAMP_PROBE_LOCAL_LOAD_OK");
        bundle.Unload(true);
    }
}
