using System;
using System.IO;
using System.Collections.Generic;
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
                // Transforms are baked by assembleTerrain; all prefab children stay at identity.
                // Preserve the complete visible body for native obstacle detection. Only
                // upward-facing surfaces within the movement slope limit supply heights.
                var walkableTriangles = new List<int>();
                var blockingTriangles = new List<int>();
                for (int i=0;i<n;i+=3)
                {
                    var normal = Vector3.Cross(vertices[i+1]-vertices[i], vertices[i+2]-vertices[i]).normalized;
                    if (normal.y >= Mathf.Cos(45*Mathf.Deg2Rad))
                        walkableTriangles.AddRange(new[]{i,i+1,i+2});
                    else blockingTriangles.AddRange(new[]{i,i+1,i+2});
                }
                if (walkableTriangles.Count == 0) continue;
                var walkable = new Mesh {name="Walkable surface "+p, indexFormat=IndexFormat.UInt32,
                    vertices=vertices, triangles=walkableTriangles.ToArray()};
                walkable.RecalculateNormals(); walkable.RecalculateBounds();
                AssetDatabase.DeleteAsset(prefix+"-walkable.asset");
                AssetDatabase.CreateAsset(walkable,prefix+"-walkable.asset");
                var blocking = new Mesh {name="Blocking body "+p, indexFormat=IndexFormat.UInt32,
                    vertices=vertices, uv=uv, triangles=blockingTriangles.ToArray()};
                blocking.RecalculateNormals(); blocking.RecalculateBounds();
                AssetDatabase.DeleteAsset(prefix+"-blocking.asset");
                AssetDatabase.CreateAsset(blocking,prefix+"-blocking.asset");
                visual.GetComponent<MeshFilter>().sharedMesh=blocking;
                // The optional prefix identifies just the walkable renderer, never the root.
                var top=new GameObject("LMWalkable surface "+p);top.transform.SetParent(root.transform,false);
                walkable.uv=uv;
                top.AddComponent<MeshFilter>().sharedMesh=walkable;
                top.AddComponent<MeshRenderer>().sharedMaterial=material;
                var surface=new GameObject("Walkable collider only "+p);surface.transform.SetParent(top.transform,false);
                surface.layer=15;
                var collider=surface.AddComponent<MeshCollider>();
                collider.isTrigger=false; collider.convex=false; collider.sharedMesh=walkable;
                // Do not call UploadMeshData(true): movement and collider cooking need CPU data.
            }
        }
        AssetDatabase.SaveAssets();
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
        int hits=0, slopes=0, plateaus=0;float min=Single.MaxValue,max=0;
        // Sample the complete footprint after simulating Warhall's layer reassignment.
        for(float x=-18;x<=18;x+=0.5f)for(float z=-10;z<=10;z+=0.5f)
            if(Physics.Raycast(new Vector3(x,100,z),Vector3.down,out var hit,200,1<<15))
            {
                if (hit.normal.y < Mathf.Cos(45*Mathf.Deg2Rad)-0.0001f)
                    throw new Exception("Non-walkable normal in height surface");
                if (hit.normal.y < 0.99f) slopes++;
                if (hit.point.y > 6.3f && hit.normal.y > 0.99f) plateaus++;
                hits++;min=Mathf.Min(min,hit.point.y);max=Mathf.Max(max,hit.point.y);
            }
        foreach(var c in instance.GetComponentsInChildren<MeshCollider>())
            if(c.gameObject.layer!=15||c.GetComponent<Renderer>()||c.isTrigger||c.convex||!c.sharedMesh.isReadable)throw new Exception("Invalid collider hierarchy");
        foreach(var filter in instance.GetComponentsInChildren<MeshFilter>())
            if(!filter.sharedMesh.isReadable || filter.transform.localScale!=Vector3.one ||
               filter.transform.localRotation!=Quaternion.identity || filter.transform.localPosition!=Vector3.zero)
                throw new Exception("Unreadable mesh or unbaked transform");
        // A horizontal ray must not hit the height-only surface at the raised cliff.
        // The visible cliff remains in the renderer mesh for native body intersection.
        if(Physics.Raycast(new Vector3(-25,3,-5),Vector3.right,50,1<<15))
            throw new Exception("Vertical side incorrectly included in walkable collider");
        float previous=0, maxRise=0; int routeSamples=0;
        for(float x=18.7f;x>=-10;x-=0.25f)
        {
            if(!Physics.Raycast(new Vector3(x,20,4.92f),Vector3.down,out var step,40,1<<15))
                throw new Exception("Gap in ramp-to-platform route at "+x);
            maxRise=Mathf.Max(maxRise,Mathf.Abs(step.point.y-previous));
            previous=step.point.y; routeSamples++;
        }
        // Units are centimetres. Preserve the authored shallow stone lips (<5 mm),
        // but reject a missing ramp or a cliff in the intended approach route.
        if(maxRise>0.5f || previous<6.3f) throw new Exception("Broken ramp approach");
        if(Physics.Raycast(new Vector3(-10,20,-10.3f),Vector3.down,40,1<<15) ||
           !Physics.Raycast(new Vector3(-10,20,-9.8f),Vector3.down,out var edge,40,1<<15) || edge.point.y<6.3f)
            throw new Exception("Missing elevated side boundary");
        Debug.Log("HIGH_GROUND_APPROACH_OK samples="+routeSamples+" maxRiseCm="+maxRise+" sideHeightCm="+edge.point.y);
        if(hits<100||max-min<1||slopes<100||plateaus<100)throw new Exception("Missing slope or elevated platform");
        Debug.Log("HIGH_GROUND_COLLIDER_OK hits="+hits+" min="+min+" max="+max+" slopes="+slopes+" plateaus="+plateaus);
        UnityEngine.Object.DestroyImmediate(instance);bundle.Unload(true);
    }
}
