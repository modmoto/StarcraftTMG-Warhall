# Leading-model movement: Unity implementation handoff

Highest-priority Warhall feature. This is a standalone planning example, **not an installed game feature**.

![Numbered leading-model formation and previous unit position](../../docs/images/leading-model-placement.png)

## Movement workflow

1. Select a model and press **L** to mark it as the unit's **leading model**. This remains the leader until explicitly changed.
2. Drag that leading model to its new position. This **one drag** also places the rest of the unit around it. Before moving anything, snapshot the whole unit for ghosts and undo. The leader's drag direction defines forward.
3. Place follower **1** at the forward-most point on the allowed circular boundary. Continue around the front semicircle alternating **left, right, left, right**, with touching, non-overlapping bases. The exact circular outer arc takes priority over compact rows.
4. Once the front outer rank is full, fill inward gaps from larger radii to smaller radii, favoring forward placement. Use the rear half only if needed. Label the leader **L** and followers **1–17** in placement order for the illustrated 18-model unit.
5. Both players see the coherency circle, dotted outlines of the unit's previous positions, the old leader marked L and its movement arrow. Turn the circle red whenever the actual unit is out of coherency.
6. After automatic placement, drag individual **non-leading** models to fine-adjust them. These drags move only that model: no new leader, no additional circle and no rearrangement of the rest of the unit.
7. **Ctrl+Z undoes the whole unit move**, restoring the pre-drag snapshot as one undo/network transaction. Later individual adjustments are separate undo actions.

## Alternative input workflow: automatically mark the dragged model

Instead of requiring an L keypress first:

1. Click and drag any model normally. **That exact clicked model automatically becomes the leading model**. Move it to the destination and place the whole unit using the same algorithm, ghosts, coherency feedback and undo behavior described above.
2. Once the unit has been placed, **Shift-click and drag**, or alternatively **Ctrl-click and drag**, an individual **non-leading** model to fine-adjust only that model. The modifier prevents a new leader from being assigned and prevents the whole unit from moving again. Choose one modifier binding during integration.

This is an alternative to the explicit L workflow, not an extra prerequisite for it. In this alternative, do not substitute the closest model or a previously marked leader for the model the player actually clicked.

## Inputs and a minimal call

`LeadingModelPlacement.cs` has no Unity or Warhall dependencies. It uses `System.Numerics.Vector2` for tabletop coordinates and returns positions instead of changing scene objects. Array indices identify models in a stable, shared unit order. This version supports **equal circular bases**; mixed or rectangular bases require additional collision geometry.

```csharp
using System.Numerics;
using Starcraft.Warhall.Examples;

// Read these BEFORE moving any scene transforms.
Vector2[] oldPositionsMm = ReadUnitPositionsInMillimetres();
int leaderIndex = GetMarkedLeaderIndex();
Vector2 destinationMm = ReadLeaderDragDestinationInMillimetres();

var plan = LeadingModelPlacement.Build(
    oldPositionsMm, leaderIndex, destinationMm,
    baseDiameterMm: 32f,
    coherencyMm: 4f * 25.4f,
    whollyWithin: true, // Explicit diagram convention; confirm the actual rule below.
    fallbackForward: new Vector2(1f, 0f),
    canPlace: (center, radius) => IsBasePositionLegal(center, radius));

// Apply only after validating the COMPLETE plan. Also save rotations and heights.
CommitWholeUnitMove(plan.Before, plan.After, plan.Ordered);
// Ctrl+Z: restore the saved whole-unit snapshot through the network/undo system.
```

`ReadUnitPositionsInMillimetres`, `IsBasePositionLegal` and `CommitWholeUnitMove` above are integration placeholders, not included methods. For the illustrated unit, the input contains **18 models total: L plus 17 followers**.

## Measurement must be explicit

The illustration uses a 4-inch ring extending from the leader's base edge, with follower bases fully inside that ring. For 32 mm bases:

- Leader radius = 16 mm.
- Ring radius = 16 + 101.6 = **117.6 mm**.
- Maximum follower-center distance for `whollyWithin: true` = 117.6 − 16 = **101.6 mm**.
- If the rule instead requires only **any part** of a follower's base to be within 4 inches of the leader's base, choose `whollyWithin: false`; the maximum center distance is **133.6 mm**. Its bases may cross the displayed ring. Confirm the intended rules before integration.

This example does not assert which convention the game requires. Rendering and the red out-of-coherency test must use the same selected convention.

## How the placement search works

- The outer centers lie on a single exact circle. Angular spacing is `2 * asin(baseRadius / outerCenterRadius)`, making adjacent bases touch.
- The first pass scans angles `0, +step, -step, +2step, -2step…`, stopping at ±90 degrees. Positive angles mean left relative to the drag direction.
- A deterministic inward search fills available gaps using 0.2 mm radial steps and 0.5 degree angular steps. Every candidate is checked against the leader, all previously placed followers and the optional legality callback. Adjust resolution for performance.
- The rear half is a fallback after the entire front search. If a complete placement is not found, the function throws **without modifying the inputs or any scene objects**. Keep the unit at its previous position or offer manual placement.
- Model identities are assigned to the ordered slots by nearest old position, with stable index tie-breaking. Numbering indicates slot order, not model identity or movement distance.

This is a **greedy placement heuristic**, not proof of globally optimal packing or maximum legal travel for every model. Inward rows approximate available gaps rather than guaranteeing exact tangent packing. Obstacles can require a different arrangement even if this search fails. Per-model movement allowance, paths, enemy engagement, elevation, board bounds and line of sight are the caller's responsibility. A destination-only legality callback cannot validate an entire movement path.

## Unity wiring

- **Explicit L mode:** pressing L marks the selected model, replacing the previous leader. Call the planner only when `draggedModelId == unit.LeaderModelId`; all other drags remain individual moves.
- **Alternative modifier mode:** normal left-drag invokes whole-unit placement; Shift-drag or Ctrl-drag bypasses the planner for individual adjustment. No prior L keypress is required. Assign `leaderIndex = draggedModelIndex` on a normal drag and use that exact model as the anchor. Modifier-dragging a follower preserves the current leader and moves only that follower. Do not apply this rule together with explicit L-mode drag gating.
- Convert Unity X/Z coordinates to millimetres before calling; convert back afterward. Do not assume one Unity unit equals one metre—use Warhall's existing board conversion.
- Preserve each model's identity, rotation and height in the actual undo snapshot. Project planned positions onto legal ground/elevated-ground surfaces separately; the algorithm is 2D.
- During a drag, preview locally. At commit, the authoritative client/server validates and sends one final plan plus the ghost snapshot to both players. Do not independently recompute approximate packing on each peer.
- Label `Order == 0` as L; display the other `Order` values for placement previews.
- Reuse `Before` for dotted base ghosts and the leader arrow. The old formation's 90-degree rotation was only an explanatory drawing: **never rotate real history**.
- Coherency ring visibility and red invalid-state feedback must be shared. Manual movement of a follower updates validity without calling `Build` again.

## Acceptance checks

- 18 × 32 mm bases: exactly one L and followers 1–17, no base overlaps.
- Outer rank follows a circular arc and fills before inward positions.
- Left/right ordering rotates with the drag direction; zero-length drags use an explicit fallback.
- Both players see the old bases, old leader, movement arrow and coherency state.
- Ctrl+Z restores the entire unit, including rotations/heights, as one transaction.
- An impossible/blocked placement changes nothing. Mixed bases are handled by a future extension rather than passed as equal circles.

`PlacementChecks.cs` contains a standalone console test runner (exclude it when copying the planner into Unity). Compile it together with LeadingModelPlacement.cs in a .NET console project. It checks the 18-model count, numbering, snapshots, no overlaps, circular outer rank, left/right ordering, rotation invariance, determinism, blocked placement and both measurement conventions. It has been compiled and run with .NET 8.
