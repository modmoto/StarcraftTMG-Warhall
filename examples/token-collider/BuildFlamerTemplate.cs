using System;
using System.IO;
using System.Collections.Generic;
using UnityEditor;
using UnityEngine;
using UnityEngine.Rendering;

public static class BuildFlamerTemplate
{
    public static void Run()
    {
        const string dir="Assets/TokenColliderInput/sc_token_flamer_template";
        const string prefab=dir+"/FlamerTemplate.prefab";
        // Match Warhall's existing renderer Token tag slot; never declare a new slot.
        var tags=new SerializedObject(AssetDatabase.LoadAllAssetsAtPath("ProjectSettings/TagManager.asset")[0]).FindProperty("tags");
        if(tags.arraySize<=20 || tags.GetArrayElementAtIndex(20).stringValue!="Token")
            throw new Exception("Expected native Token tag at slot 20");
        var root=new GameObject("Flamer Template");
        using(var reader=new BinaryReader(File.OpenRead(dir+"/geometry.bytes")))
        {
            float diameter=reader.ReadSingle();
            if(Mathf.Abs(diameter-21.0482563f)>0.0001f)throw new Exception("Expected TTS flamer length");
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
                // Render the ring through a native one-bone SkinnedMeshRenderer.
                // TemplateArea then uses its supported circular-collider fallback
                // instead of mistaking the visible annulus for the entire template.
                var weights=new BoneWeight[count];
                for(int i=0;i<count;i++){weights[i].boneIndex0=0;weights[i].weight0=1;}
                mesh.boneWeights=weights;mesh.bindposes=new[]{Matrix4x4.identity};
                var renderer=visual.AddComponent<SkinnedMeshRenderer>();
                renderer.sharedMesh=mesh;renderer.sharedMaterial=material;
                renderer.bones=new[]{root.transform};renderer.rootBone=root.transform;
                renderer.localBounds=mesh.bounds;renderer.updateWhenOffscreen=true;
            }
            // A filled circular selection surface, independent of the open visual ring.
            Vector3[] circle;var triangles=new List<int>();
            using(var outline=new BinaryReader(File.OpenRead(dir+"/outline.bytes"))){
                int segments=outline.ReadInt32();circle=new Vector3[segments+1];
                for(int i=0;i<segments;i++){circle[i+1]=new Vector3(outline.ReadSingle(),0.08f,outline.ReadSingle());circle[0]+=circle[i+1]/segments;}
                for(int i=0;i<segments;i++)triangles.AddRange(new[]{0,(i+1)%segments+1,i+1});
            }
            var collision=new Mesh {vertices=circle,triangles=triangles.ToArray()};collision.RecalculateNormals();collision.RecalculateBounds();
            AssetDatabase.DeleteAsset(dir+"/flamer-selection.asset");AssetDatabase.CreateAsset(collision,dir+"/flamer-selection.asset");
            var collider=root.AddComponent<MeshCollider>();collider.sharedMesh=collision;collider.isTrigger=false;collider.convex=false;

        }
        AssetDatabase.SaveAssets();PrefabUtility.SaveAsPrefabAsset(root,prefab);UnityEngine.Object.DestroyImmediate(root);
        Directory.CreateDirectory("Output/FlamerTemplate");
        var build=new AssetBundleBuild {assetBundleName="flamer-template-tts.unity3d",assetNames=new[]{prefab}};
        if(BuildPipeline.BuildAssetBundles("Output/FlamerTemplate",new[]{build},BuildAssetBundleOptions.ForceRebuildAssetBundle|BuildAssetBundleOptions.StrictMode|BuildAssetBundleOptions.ChunkBasedCompression|BuildAssetBundleOptions.AssetBundleStripUnityVersion,BuildTarget.StandaloneWindows64)==null)throw new Exception("Build failed");
        var bundle=AssetBundle.LoadFromFile("Output/FlamerTemplate/"+build.assetBundleName);
        var instance=UnityEngine.Object.Instantiate(bundle.LoadAsset<GameObject>(prefab));Physics.SyncTransforms();
        var selection=instance.GetComponent<MeshCollider>();
        if(!selection || !selection.sharedMesh.isReadable || selection.isTrigger)throw new Exception("Invalid selection collider");
        var bounds=selection.bounds;
        if(Mathf.Abs(bounds.size.x-6.1293054f)>0.0001f || Mathf.Abs(bounds.size.z-21.0482563f)>0.0001f)throw new Exception("Wrong diameter");
        foreach(var r in instance.GetComponentsInChildren<Renderer>())if(!r.CompareTag("Token"))throw new Exception("Missing Token tag");
        foreach(var x in new[]{0f,1f})if(!Physics.Raycast(new Vector3(x,5,0),Vector3.down,10))throw new Exception("Circle click missed");
        if(Physics.Raycast(new Vector3(2.9f,5,-10f),Vector3.down,10))throw new Exception("Square corner must not count as circle");
        if(instance.GetComponentsInChildren<MeshFilter>().Length!=0)
            throw new Exception("TemplateArea must use the circular collider fallback");
        var ring=instance.GetComponentInChildren<SkinnedMeshRenderer>();
        if(!ring || ring.sharedMesh==null || !ring.sharedMesh.isReadable)
            throw new Exception("Missing native ring renderer");
        var baked=new Mesh();ring.BakeMesh(baked);
        if(Mathf.Abs(baked.bounds.size.x-6.1293054f)>0.0001f || Mathf.Abs(baked.bounds.size.z-21.0482563f)>0.0001f || baked.bounds.size.y>0.0001f)
            throw new Exception("Ring skinning changed flat 130mm footprint");
        // An opaque shader cannot expose an interior face: none exists.
        ring.sharedMaterial.shader=Shader.Find("Standard");
        foreach(var v in baked.vertices)
            if((v.x*v.x+v.z*v.z)<0.0001f)throw new Exception("Unexpected interior geometry");
        if(instance.GetComponentsInChildren<Renderer>().Length!=1)throw new Exception("Unexpected fill or cylinder renderer");
        UnityEngine.Object.DestroyImmediate(baked);
        Debug.Log("FLAMER_RING_ONLY_OK circularColliderFallback=true visibleFill=false");
        Debug.Log("FLAMER_TEMPLATE_TTS_OK diameterCm="+bounds.size.x+" centerAndEdgeClicks=true outsideCorner=false");
        UnityEngine.Object.DestroyImmediate(instance);bundle.Unload(true);
    }
}
