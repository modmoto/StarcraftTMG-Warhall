namespace UnityEngine { public static class Time { public static float unscaledTime; } }
namespace ExitGames.Client.Photon {
public class Hashtable : Dictionary<object,object> {
public new object this[object key] { get => TryGetValue(key,out var value) ? value : null; set => base[key]=value; }
public Hashtable Copy() { var result=new Hashtable(); foreach(var pair in this)result[pair.Key]=pair.Value; return result; }
}}
namespace Photon.Pun {
public class PhotonView { public int ViewID=77; }
public static class PhotonNetwork {
public static bool InRoom=true,OfflineMode=false,IsMasterClient=true;
public static Photon.Realtime.Room CurrentRoom=new();
}}
namespace Photon.Realtime {
using H=ExitGames.Client.Photon.Hashtable;
public class Room {
public H CustomProperties=new();
public Queue<(H value,H expected)> Requests=new();
public bool SetCustomProperties(H value,H expected=null) { Requests.Enqueue((value.Copy(),expected?.Copy())); return true; }
public void Flush() { while(Requests.Count>0) { var r=Requests.Dequeue(); if(r.expected!=null && r.expected.Any(x=>!Equals(CustomProperties[x.Key],x.Value)))continue; foreach(var x in r.value)CustomProperties[x.Key]=x.Value; }}
}}
