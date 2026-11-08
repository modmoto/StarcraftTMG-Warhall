using Photon.Pun;
using UnityEngine;
using State=StarcraftScoreboard.ScoreboardState;
using Network=StarcraftScoreboard.ScoreboardNetwork;
void Check(bool condition,string label) { if(!condition)throw new Exception(label); Console.WriteLine("PASS "+label); }
var state=new State();
Check(state.Values[22]==6,"default global supply");
Check(state.Change(0,-1).Values[0]==0,"zero clamp");
var changed=state.Change(0,1).Change(20,1).Change(22,-1).Change(23,1);
Check(State.TryDecode(changed.Encode(),out var decoded) && decoded.Values.SequenceEqual(changed.Values),"state round trip");
Check(!State.TryDecode("0:bad",out _),"malformed state rejected");
Check(!State.TryDecode("0:"+string.Join(",",Enumerable.Repeat("-1",24)),out _),"negative state rejected");
var room=PhotonNetwork.CurrentRoom;
var a=new Network(new PhotonView());var b=new Network(new PhotonView());
a.Tick();room.Flush();a.Tick();PhotonNetwork.IsMasterClient=false;b.Tick();
a.Change(0,1);b.Change(0,1);a.Tick();b.Tick();room.Flush();a.Tick();b.Tick();
Time.unscaledTime=1;b.Tick();room.Flush();a.Tick();b.Tick();
Check(a.State.Values[0]==2 && b.State.Values[0]==2,"concurrent edits survive CAS conflict");
a.Change(0,1);a.Tick();Time.unscaledTime=2;a.Tick();room.Flush();a.Tick();b.Tick();
Check(a.State.Values[0]==3 && b.State.Values[0]==3,"retry is not double-counted");
var c=new Network(new PhotonView());c.Tick();
Check(c.State.Values[0]==3,"late join receives current score");
a.Change(23,1);a.Tick();room.Flush();a.Tick();b.Tick();
Check(b.State.Values[23]==1 && b.State.Values[0]==3,"color swap synchronized without changing scores");
Console.WriteLine("All scoreboard state/transport checks passed.");

var u=new MovementCheck.Unit();
var m1=new MovementCheck.Soldier{Parent=u};var m2=new MovementCheck.Soldier{Parent=u};
var input=new MovementCheck.InputManager{Selected=new(){m1,m2}};
UnityEngine.Object.Instance=input;
Check(ReferenceEquals(MovementCheck.LeadingMovement.SelectionTarget(m1),m1),"click retains selected model group");
MovementCheck.LeadingMovement.Pending(m1);MovementCheck.LeadingMovement.PrepareSingleDrag(input);
Check(input.Selected.Count==2 && input.Forced==0 && MovementCheck.LeadingMovement.multiDrag,"drag retains all selected models");
input.Selected=new(){u};
Check(ReferenceEquals(MovementCheck.LeadingMovement.SelectionTarget(m1),u),"plain click targets squad");
MovementCheck.LeadingMovement.Pending(m1);MovementCheck.LeadingMovement.PrepareSingleDrag(input);
Check(input.Selected.Count==1 && input.Selected[0]==m1 && input.Forced==1 && !MovementCheck.LeadingMovement.multiDrag,"single drag selects only touched model");
var u2=new MovementCheck.Unit();input.Selected=new(){u,u2};
MovementCheck.LeadingMovement.Pending(m1);MovementCheck.LeadingMovement.PrepareSingleDrag(input);
Check(input.Selected.Count==2 && MovementCheck.LeadingMovement.multiDrag,"selected unit group also retained");

var pool = (shields: 2, damage: 0);
for (int hit = 1; hit <= 5; hit++) {
    pool = ShieldPool.Step(2, pool.shields, pool.damage, false);
    Check(pool.damage == Math.Max(0, hit - 2), "shared Adept shields before hull hit " + hit);
}
Check(pool.damage == 3, "first 3HP casualty after five total damage");
for (int heal = 0; heal < 5; heal++) pool = ShieldPool.Step(2, pool.shields, pool.damage, true);
Check(pool == (2, 0), "healing reverses hull damage before restoring shared shields");
Check(ShieldPool.Step(2, 2, 0, true) == (2, 0), "healing cannot exceed shield maximum");
Check(ShieldPool.Step(0, 0, 0, false) == (0, 1), "no shields means immediate hull damage");

Check(!MovementCheck.LeadingMovement.ShouldRedraw(new MovementCheck.Token()), "drag redraw keeps hidden token radius hidden");
Check(MovementCheck.LeadingMovement.ShouldRedraw(new MovementCheck.Token {Visible=true}), "explicit token radius still redraws");
Check(MovementCheck.LeadingMovement.ShouldRedraw(m1), "soldier leader radius redraw unchanged");
