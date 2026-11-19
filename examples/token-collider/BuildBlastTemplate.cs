using System;
using System.IO;
using System.Collections.Generic;
using UnityEditor;
using UnityEngine;
using UnityEngine.Rendering;

public static class BuildBlastTemplate
{
    public static void Run()
    {
        const string dir="Assets/TokenColliderInput/Token5Inch";
        const string prefab=dir+"/BlastTemplate.prefab";
        // Match Warhall's existing renderer Token tag slot; never declare a new slot.
        var tags=new SerializedObject(AssetDatabase.LoadAllAssetsAtPath("ProjectSettings/TagManager.asset")[0]).FindProperty("tags");
        if(tags.arraySize<=20 || tags.GetArrayElementAtIndex(20).stringValue!="Token")
            throw new Exception("Expected native Token tag at slot 20");
        var root=new GameObject("Blast Template 130mm");
        using(var reader=new BinaryReader(File.OpenRead(dir+"/geometry.bytes")))
        {
            float diameter=reader.ReadSingle();
            if(Mathf.Abs(diameter-13)>0.0001f)throw new Exception("Expected 130mm diameter");
            int parts=reader.ReadInt32();
            for(int part=0;part<parts;part++)
            {
                int count=reader.ReadInt32();var vertices=new Vector3[count];var uv=new Vector2[count];var indices=new int[count];
                for(int i=0;i<count;i++){vertices[i]=new Vector3(reader.ReadSingle(),reader.ReadSingle(),reader.ReadSingle());uv[i]=new Vector2(reader.ReadSingle(),reader.ReadSingle());indices[i]=i;}
                var mesh=new Mesh {indexFormat=IndexFormat.UInt32,vertices=vertices,uv=uv,triangles=indices};
                mesh.RecalculateNormals();mesh.RecalculateBounds();
                string stem=dir+"/blast-part"+part;
                AssetDatabase.DeleteAsset(stem+".asset");AssetDatabase.CreateAsset(mesh,stem+".asset");
                var material=new Material(Shader.Find(part>0 ? "Unlit/Transparent" : "Unlit/Texture"));
                var texturePath=dir+"/"+part+".png";
                var importer=(TextureImporter)AssetImporter.GetAtPath(texturePath);
                importer.alphaSource=TextureImporterAlphaSource.FromInput;
                importer.alphaIsTransparency=true;
                importer.textureCompression=TextureImporterCompression.Uncompressed;
                importer.mipmapEnabled=false;
                importer.wrapMode=TextureWrapMode.Clamp;
                importer.SaveAndReimport();
                material.mainTexture=AssetDatabase.LoadAssetAtPath<Texture2D>(texturePath);
                if(!material.mainTexture)throw new Exception("Missing texture");
                AssetDatabase.DeleteAsset(stem+".mat");AssetDatabase.CreateAsset(material,stem+".mat");
                var visual=new GameObject(part==0 ? "Visual orange rim" : part==1 ? "Template contact surface" : "Visual fading cylinder");visual.tag="Token";visual.transform.SetParent(root.transform,false);
                visual.AddComponent<MeshFilter>().sharedMesh=mesh;visual.AddComponent<MeshRenderer>().sharedMaterial=material;
            }
            // A filled circular selection surface, independent of the open visual ring.
            const int segments=128;var circle=new Vector3[segments+1];circle[0]=new Vector3(0,0.08f,0);
            var triangles=new List<int>();
            for(int i=0;i<segments;i++){float a=i*2*Mathf.PI/segments;circle[i+1]=new Vector3(Mathf.Cos(a)*diameter/2,0.08f,Mathf.Sin(a)*diameter/2);triangles.AddRange(new[]{0,(i+1)%segments+1,i+1});}
            var collision=new Mesh {vertices=circle,triangles=triangles.ToArray()};collision.RecalculateNormals();collision.RecalculateBounds();
            AssetDatabase.DeleteAsset(dir+"/blast-selection.asset");AssetDatabase.CreateAsset(collision,dir+"/blast-selection.asset");
            var collider=root.AddComponent<MeshCollider>();collider.sharedMesh=collision;collider.isTrigger=false;collider.convex=false;
        }
        AssetDatabase.SaveAssets();PrefabUtility.SaveAsPrefabAsset(root,prefab);UnityEngine.Object.DestroyImmediate(root);
        Directory.CreateDirectory("Output/BlastTemplate");
        var build=new AssetBundleBuild {assetBundleName="blast-template-130mm.unity3d",assetNames=new[]{prefab}};
        if(BuildPipeline.BuildAssetBundles("Output/BlastTemplate",new[]{build},BuildAssetBundleOptions.ForceRebuildAssetBundle|BuildAssetBundleOptions.StrictMode|BuildAssetBundleOptions.ChunkBasedCompression|BuildAssetBundleOptions.AssetBundleStripUnityVersion,BuildTarget.StandaloneWindows64)==null)throw new Exception("Build failed");
        var bundle=AssetBundle.LoadFromFile("Output/BlastTemplate/"+build.assetBundleName);
        var instance=UnityEngine.Object.Instantiate(bundle.LoadAsset<GameObject>(prefab));Physics.SyncTransforms();
        var selection=instance.GetComponent<MeshCollider>();
        if(!selection || !selection.sharedMesh.isReadable || selection.isTrigger)throw new Exception("Invalid selection collider");
        var bounds=selection.bounds;
        if(Mathf.Abs(bounds.size.x-13)>0.0001f || Mathf.Abs(bounds.size.z-13)>0.0001f)throw new Exception("Wrong diameter");
        foreach(var r in instance.GetComponentsInChildren<Renderer>())if(!r.CompareTag("Token"))throw new Exception("Missing Token tag");
        foreach(var x in new[]{0f,6.4f})if(!Physics.Raycast(new Vector3(x,5,0),Vector3.down,10))throw new Exception("Circle click missed");
        if(Physics.Raycast(new Vector3(6.4f,5,6.4f),Vector3.down,10))throw new Exception("Square corner must not count as circle");
        var wall=instance.transform.Find("Visual fading cylinder").GetComponent<MeshFilter>().sharedMesh;
        if(!wall.isReadable || Mathf.Abs(wall.bounds.size.y-4)>0.0001f)throw new Exception("Expected 40mm fading cylinder");
        var wallMaterial=instance.transform.Find("Visual fading cylinder").GetComponent<MeshRenderer>().sharedMaterial;
        if(wallMaterial.shader.name!="Unlit/Transparent")throw new Exception("Cylinder must alpha blend");
        Debug.Log("BLAST_CYLINDER_OK heightMm="+wall.bounds.size.y*10+" alphaBlend=true");
        Debug.Log("BLAST_TEMPLATE_130MM_OK diameterCm="+bounds.size.x+" centerAndEdgeClicks=true outsideCorner=false");
        UnityEngine.Object.DestroyImmediate(instance);bundle.Unload(true);
    }
}
