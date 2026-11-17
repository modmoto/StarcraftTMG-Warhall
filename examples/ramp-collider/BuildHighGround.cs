using System;
using System.IO;
using UnityEditor;
using UnityEngine;
using UnityEngine.Rendering;

public static class BuildHighGround
{
    public static void Run()
    {
        var root = new GameObject("Starcraft High Ground");
        using (var reader = new BinaryReader(File.OpenRead("Assets/HighGroundInput/geometry.bytes")))
        {
            int count = reader.ReadInt32();
            for (int p=0;p<count;p++)
            {
                int n = reader.ReadInt32();
                var vertices=new Vector3[n]; var uv=new Vector2[n]; var triangles=new int[n];
                for(int i=0;i<n;i++)
                {
                    vertices[i]=new Vector3(reader.ReadSingle(),reader.ReadSingle(),reader.ReadSingle());
                    uv[i]=new Vector2(reader.ReadSingle(),reader.ReadSingle()); triangles[i]=i;
                }
                var mesh=new Mesh {indexFormat=IndexFormat.UInt32,vertices=vertices,uv=uv,triangles=triangles};
                mesh.RecalculateNormals(); mesh.RecalculateBounds();
                string prefix="Assets/HighGroundInput/part"+p;
                AssetDatabase.DeleteAsset(prefix+".asset"); AssetDatabase.CreateAsset(mesh,prefix+".asset");
                var material=new Material(Shader.Find("Standard"));
                material.mainTexture=AssetDatabase.LoadAssetAtPath<Texture2D>("Assets/HighGroundInput/"+p+".png");
                material.SetFloat("_Glossiness",0); material.SetFloat("_Metallic",0);
                AssetDatabase.DeleteAsset(prefix+".mat"); AssetDatabase.CreateAsset(material,prefix+".mat");
                var visual=new GameObject("Visible part "+p);visual.transform.SetParent(root.transform,false);
                visual.AddComponent<MeshFilter>().sharedMesh=mesh;visual.AddComponent<MeshRenderer>().sharedMaterial=material;
                var surface=new GameObject("Walkable collider only "+p);surface.transform.SetParent(root.transform,false);
                surface.layer=15;surface.AddComponent<MeshCollider>().sharedMesh=mesh;
            }
        }
        PrefabUtility.SaveAsPrefabAsset(root,"Assets/HighGround.prefab");
        UnityEngine.Object.DestroyImmediate(root);
        var flags=BuildAssetBundleOptions.StrictMode|BuildAssetBundleOptions.ForceRebuildAssetBundle|BuildAssetBundleOptions.ChunkBasedCompression|BuildAssetBundleOptions.AssetBundleStripUnityVersion;
        var build=new AssetBundleBuild {assetBundleName="high-ground-windows.unity3d",assetNames=new[]{"Assets/HighGround.prefab"}};
        if(BuildPipeline.BuildAssetBundles("Output",new[]{build},flags,BuildTarget.StandaloneWindows64)==null)throw new Exception("Build failed");
        var bundle=AssetBundle.LoadFromFile("Output/high-ground-windows.unity3d");
        if(!bundle)throw new Exception("Bundle load failed");
        var instance=UnityEngine.Object.Instantiate(bundle.LoadAsset<GameObject>("Assets/HighGround.prefab"));
        instance.layer=0;foreach(var r in instance.GetComponentsInChildren<Renderer>())r.gameObject.layer=0;
        Physics.SyncTransforms();
        int hits=0;float min=Single.MaxValue,max=0;
        // Sample the complete footprint after simulating Warhall's layer reassignment.
        for(float x=-18;x<=18;x+=0.5f)for(float z=-10;z<=10;z+=0.5f)
            if(Physics.Raycast(new Vector3(x,100,z),Vector3.down,out var hit,200,1<<15))
            { hits++;min=Mathf.Min(min,hit.point.y);max=Mathf.Max(max,hit.point.y); }
        foreach(var c in instance.GetComponentsInChildren<MeshCollider>())
            if(c.gameObject.layer!=15||c.GetComponent<Renderer>())throw new Exception("Invalid collider hierarchy");
        if(hits<100||max-min<1)throw new Exception("Missing slope or elevated platform");
        Debug.Log("HIGH_GROUND_COLLIDER_OK hits="+hits+" min="+min+" max="+max);
        UnityEngine.Object.DestroyImmediate(instance);bundle.Unload(true);
    }
}
