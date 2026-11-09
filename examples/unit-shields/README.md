# Shared StarCraft shields

Copy `StarcraftShields.cs` into the client assembly. All helpers, including the shield pool, Undo action and Photon room state, live in this one file. Included in Warhall Production Patch 1.0.4.

## Integration

- Call `StarcraftShields.Tick()` at the beginning of `InputManager.Update()`, before scoreboard/input early returns.
- Start `InputManager.RemoveHealthPoint()` with `if (StarcraftShields.Damage(this)) return;`.
- Start `InputManager.AddHealthPoint()` with `if (StarcraftShields.Heal(this)) return;`.
- Keep native damage/healing methods unchanged. The hook delegates hull damage, casualties and resurrection to them.

The hook only handles owned StarCraft Cloud units with a numeric positive `Shd` profile attribute. Both squad and single-model selection resolve to the parent squad. `Shd` is one shared pool, never multiplied by model count. Damage depletes shields before applying native wounds. Healing repairs hull damage and casualties first, then replenishes shields up to the profile maximum. Excess healing does nothing.

A code-generated solid blue shield with a white outline, a raised center at the top and a rounded lower bowl (no split fill, surrounding circle or lock symbol) and blue remaining-shield count sits at the unit wound-billboard anchor and faces the camera. Glyph height, icon height and the gap between icon and number are derived from the native wound billboard geometry, so the shield display matches the wounds instead of using a smaller fixed scale. The patch reads the existing `_skullText` reference; a source integration can expose that reference directly through a getter. It has no collider or raycast target and needs no asset upload. Native white model wound displays remain unchanged. At zero the entire shield indicator is hidden; healing or Undo restores it when the pool becomes positive again.

Shield/hull bookkeeping and native actions share the Undo group. Photon room properties use `sc.shields.v1.<unit view ID>`; native RPCs continue to synchronize hull wounds. Other patched clients and late joiners read the room state. Unpatched clients can still see native wounds, but cannot display shields or apply the shield-aware damage policy. The shield pool is not included in native saved-game serialization, so a newly opened room initializes a fresh pool. A new room starts with full shields; shield persistence across saved games is not implemented.

## Verification

Compiled against the reviewed production Warhall assemblies; the shield appearance was accepted in the local Test app. Executable state checks cover a 2-shield/3-HP Adept casualty after five damage, healing back to full, maximum clamping and zero-shield damage. Existing scoreboard transport and movement selection simulations still pass. Real multiplayer, native casualty Undo/Redo and billboard appearance still require playtesting; the arithmetic checks do not verify those client behaviors.

The shared shield display follows the centroid of active model transforms each frame, with the native wound billboard offset. This keeps it attached during movement before Warhall recenters the unit at drag completion.
