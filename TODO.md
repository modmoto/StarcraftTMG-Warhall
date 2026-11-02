# Warhall developer TODO

Prioritized client/editor requests for the Starcraft mod. Supporting code and investigation notes are linked below.

1. [ ] **Leading-model movement.** Select a model and press **L** to mark it as the unit's leading model. Normal **left-click and drag** moves/rearranges the whole unit, using the marked leader as the placement anchor. If another unit member is dragged normally, apply its drag displacement to the marked leader's destination. **Shift+drag** fine-adjusts individual models (or an explicitly selected subset) without creating another circle, changing the leader or moving the rest of the unit. Fill the exact forward circular arc first, alternating left/right, then fill inward gaps. Show the shared circle in red when coherency is invalid, dotted previous unit positions, the old leader's movement arrow and numbered placement slots. **Ctrl+Z** restores the whole pre-move unit as one undo transaction. Preserve manual follower adjustments as separate undo actions.

   ![Leading-model movement: numbered formation and dotted previous positions](docs/images/leading-model-placement.png)

   [Standalone C# planner](examples/leading-model/LeadingModelPlacement.cs) · [Unity integration and acceptance checks](examples/leading-model/README.md). Example: 18 models including the leader, 32 mm bases, 4-inch coherency. This is a proposed feature; the planner does not wire up game input, networking or undo.

2. [ ] **Platform collision.** Allow units to stand on imported ramps/platforms using mesh colliders on `ElevatedGround`, as they can on native Hill snow. Imported model collider generation is disabled; terrain selection height does not provide a walkable surface. Preserve elevated-ground collision when terrain is locked. [Client findings](docs/warhall-client-terrain-support.md).

3. [ ] **Token previews.** Resolve relative thumbnail paths to absolute URLs and provide a visible fallback on failure. Native tokens can use an embedded prefab `AssetUIConfig.UISprite`; custom GLB tokens need a reliable equivalent preview path. Keep custom artwork. [Investigation and native-token comparison](docs/token-menu-client-issue.md).

4. [ ] **32 mm marker measurement.** Measure from the circular base edge (16 mm radius), rather than a terrain corner or token center. Keep the decorative control ring separate from the measurement footprint.

5. [ ] **Hide terrain bases.** Add a per-terrain option to hide both base renderers while preserving necessary colliders. Do not hide unit bases. [Proposed client change](docs/warhall-client-terrain-support.md).

6. [ ] **Terrain locking/unlocking.** Loading deployments must not globally unlock map terrain. Preserve/restore the lock while spawning helpers, retain the manual lock toggle and test both map/deployment loading orders. [Client findings](docs/warhall-client-terrain-support.md).

7. [ ] **Cloud terrain menu.** Make `TerrainPanel` tolerate missing addressable prefabs for hosted GLB/OBJ models, create the button and then load a thumbnail with fallback. Native Hill snow works via `Frozen Tundra/Hill_FT`; the hosted ramp fails this lookup. [Comparison](docs/wds-editor-compatibility.md).

8. [ ] **Flip map.** Rotate terrain positions and orientations together by 180 degrees. Two flips must restore the original layout. [Client findings](docs/warhall-flip-limitations.md).

9. [ ] **Flip deployment.** Include mission markers and the red/blue border objects. Preserve their positions, colors and flip state when switching/reloading deployments. [Client findings](docs/warhall-flip-limitations.md).

10. [ ] **Lossless editor roundtrip.** Opening Tokens/Terrain must not silently edit data or drop unrecognized helpers. Preserve original IDs, dimensions, extra fields and references; emit changes only after an intentional edit. Keep manifest/version.json versions aligned on upload. [Roundtrip findings](docs/wds-editor-compatibility.md).
