# Mission marker control rings

Version 18 keeps the existing red, blue and green marker IDs and deployment positions. Each marker has a round 32 mm footprint and a single decorative skin containing the central disc and the TTS objective chevron ring. Three inches is measured outward from the disc edge, giving a 184.4 mm outside diameter.

The imported GLB has no colliders. Warhall builds the terrain collider and minimum-distance shape from WDS Width/Length (3.2 cm), so the ring does not create a separate selectable item or expand that footprint. Automatic minimum-distance measurement already uses the outside edge; no new WDS measurement setting is invented. Manual ruler behavior is unchanged. Verify selection and measurement in a fresh live room after publication.

The artwork comes from workshop 3662791369, deployment script d87518. Source URLs and generated geometry are maintained in `src/deployments/marker-assets.mjs`. `npm run models:catalogue` generates the three portable assets, and `npm run models:thumbnails` generates their previews.

After pushing the hosted assets and version 18 data, publish only marker skins:

```sh
npm run models:publish -- --kind marker --apply --login --replace --accept-publication-terms
```

Default target is Warhall Test. Native skins 6201–6203 remain intact; the publisher overrides their Starcraft profile assignments with the new custom skins. No authenticated publication has been performed for this change. Release 19 uses shared deployment overlay skins as described in `shared-deployments.md`; no custom DeploymentDB registration is required.

## Sword-token regression (release 25)

The original marker publication checkpoint still referenced native Excalibur skins 6201–6203. New ring GLBs must be created and assigned through `--kind marker`; uploading only `--kind terrain` does not include them. Generated marker terrain records no longer pin the native sword `SkinId`. Shared visuals resolve through the stable `sc_mission_red`, `sc_mission_blue` and `sc_mission_green` profiles. Native IDs remain only as protected replacement metadata for the publisher, never deletion targets.

After successful marker publication, push/update release 25, refresh the shared catalogue and spawn a fresh deployment. Existing room objects can retain the previous skin. A version bump alone does not upload the three shared skins.
