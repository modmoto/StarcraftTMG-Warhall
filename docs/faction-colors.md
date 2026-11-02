# Shared faction materials and flight height

Unit skins use blue Terran (hue 220°), yellow/gold Protoss (48°) and purple Zerg (280°). The catalogue builder recolors chromatic texture pixels while retaining brightness, saturation, transparency and neutral details. Dark pixels below value 20/255 and low-saturation pixels below 22% remain unchanged. This also covers weapons, attachments and embedded Unity-prefab materials. Terrain and scenario markers keep their existing materials.

`npm run models:catalogue` writes content-addressed PNG textures and portable GLBs into `model-assets/`. Original source URLs remain unchanged in `model-selections.json`. Previews use the same palette transformation. Regeneration is deterministic, and remote skins use hosted HTTPS assets rather than client-cache patches.

Units whose WDS Categories include `Flying` receive a shared 30 mm clearance from the base plane to the lowest point of the complete model assembly. The builder derives one vertical lift for all parts after their authored scale/rotation/offsets, preserving assembly geometry and dimensions. New flying units inherit this rule automatically. Raven and Point Defense Drone are the current flyers. This is a visual skin offset, not an elevated collision surface or gameplay measurement change.

After reviewing previews and running checks, push assets before publishing only units:

```sh
npm run models:publish -- --kind unit --apply --login --replace --accept-publication-terms
```

Windows saved authentication uses user-bound DPAPI; see [local authentication](local-authentication.md). A new publisher machine reconciles an unambiguous owned shared default by game/profile before replacing it, so it can retire the old owned upload after assignment even without the other machine's checkpoint. Ambiguous defaults stop publication. Preserve checkpoints for interrupted requests.

A shared-skin-only change needs no WDS version bump. Refresh the shared catalogue and create fresh models to inspect the update; existing spawned models can retain their previous skin.
