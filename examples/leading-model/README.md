# Leading-model movement for Warhall

This is the source-level integration of the locally tested Unity prototype. Copy [LeadingMovement.cs](LeadingMovement.cs) into the game assembly. It uses the existing `GameItem`, `Soldier`, `Unit`, `Cloud`, `CornerMarker`, `UndoRedo`, Photon synchronization and radius drawing APIs. The developer integration uses source edits and requires no DLL patcher.

## Behavior

- Click a model and press **L** to select it as leader. Press **L** on the same model to disable leader mode.
- Alternatively, right-press an owned model, hold and drag, then release. This selects the leader, moves it, and distributes its followers in one gesture. Right-click on empty ground retains camera rotation.
- Only moving the leader redistributes the unit. Every model can still be dragged individually. The leader's circle persists until changed or disabled.
- Radius is **3 inches**, or **4 inches for Squadron**, detected from the active model/unit rules. Display and placement use the same value.
- The triangle reset restores the unit and every model's original world position, rotation, and the original leader.

## Hook locations

Add the following calls inside the existing methods, preserving their native bodies.

| Class and method | Insertion |
| --- | --- |
| `InputManager.MouseDown(GameItem gameItem)` | First line `LeadingMovement.Click(gameItem);` |
| `InputManager.MouseEnter(GameItem gameItem)` | First line `LeadingMovement.Hover(gameItem);` |
| `InputManager.MouseExit(GameItem gameItem)` | First line `LeadingMovement.Leave(gameItem);` |
| `InputManager.Update()` | First line `LeadingMovement.Update();` and `LeadingMovement.AfterInput(this);` before **every return**, including GUI early exits |
| `Soldier.StartDrag(Vector3 position)` | First line `LeadingMovement.Begin(this);` |
| `Soldier.EndDrag()` | `LeadingMovement.Finish(this);` after the native body, on every normal exit |
| `CornerMarker.OnPhotonInstantiate(PhotonMessageInfo info)` | At the end, after `_myUnit` is resolved, `LeadingMovement.CaptureMarker(this);` |
| `CornerMarker.OnMouseDown()` | First line `if (LeadingMovement.RestoreMarker(this)) return;` |

`AfterInput` must run after the native input handling resets `CameraScrollInputAllowed`. It disables camera rotation only during the prototype's right-button drag. For source integration, a `try/finally` can cover all update exits.

```csharp
private void Update()
{
    LeadingMovement.Update();
    try
    {
        // Existing Update body, including early returns.
    }
    finally
    {
        LeadingMovement.AfterInput(this);
    }
}
```

## Single-model selection

The prototype overrides four reads of `_isSoldierSelectionCurrentMode`. Equivalent source edits are as follows. Scope them to the enabled movement feature in the production client.

- In `Soldier.OnMouseDown()` and `Soldier.OnMouseEnter()`, delegate to the parent only for `_parentUnit.IsSingleModel()`. Multi-model units use the existing base implementation immediately.
- In `Soldier.OnDoubleClick()`, retain `base.OnDoubleClick()` and remove the subsequent parent-unit selection triggered by `!_inputManager._isSoldierSelectionCurrentMode`.
- In `InputManager.DoubleClick()`, replace the current-mode toggle with `_isSoldierSelectionCurrentMode = true;`. Keep the remaining ownership, hover and selection handling.

Use **Cloud/group formation with SoldierMagnet disabled**. The helper checks this before enabling a leader.

## Placement and reset semantics

`Finish` plans all follower positions before moving anything. On a 1.5 mm grid, it places larger bases first, prioritizes forward projection along the leader's movement, then separation. Entire bases fit inside the leader's range with a 0.2 mm minimum gap. Round leaders measure range from their base edge. Oval/rectangular bases use the larger axis as a circular approximation. If packing fails, followers stay put and the manual leader move remains. Terrain, other units and battlefield boundaries are currently ignored.

The triangle snapshot is captured when the marker is created. If no leader exists then, the first subsequent leader movement records it. Later leader changes do not replace that snapshot. Reset restores model transforms using `SyncSoldierLocalTransform` and records move/rotate actions in an Undo group. It does not resurrect removed models. Snapshots are local session state, not saved-game data.

## Checks before shipping

Verify L on/off, right-drag versus ground-camera drag, individual follower adjustment, 3/4-inch rules, reset after a leader change, and undo/redo in a two-client room. Escape/focus loss cancels right-drag. The local user tested the movement prototype, but full multiplayer, saved-game persistence and collision validation remain open. Integrate the shortcut through Warhall's input bindings, gate the feature by game system, and store state per game instead of the prototype's static state before general release.
