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

## Open outline and numbers (release 26)

Five marker skins replace the former three unnumbered color skins: red 1/3, blue 2/4, green 5. Existing profile IDs represent 1 (`sc_mission_red`), 2 (`sc_mission_blue`) and 5 (`sc_mission_green`). New profiles `sc_mission_red_3` and `sc_mission_blue_4` distinguish the remaining numbers. Deployment coordinates and the 32 mm measurement/selection footprint are unchanged.

The large marker is now actual outline geometry: a 4.4 mm outer stroke, paired angular 2.8 mm sci-fi rails, and a beveled digital numeral. There is no annular face, transparent texture background, center disc or center plate spanning the open areas. All visible geometry is opaque with tiny solid-color textures; the empty space is genuinely absent geometry, so alpha/material import differences cannot tint the large interior. Materials request standard glTF unlit rendering. Numerals fit inside the 32 mm center. Warhall's own native 32 mm selection base is a separate client-rendered element; this skin change does not add a client hide-base option.

Generate with `npm run models:catalogue`, then inspect the numbered previews. After pushing the immutable asset URLs and version 26 data, use the marker-only publisher. It replaces the three owned unnumbered skins and creates two additional numbered assignments. The protected native sword skins are retained. Refresh the shared catalogue, update Starcraft and create a fresh deployment to load numbers 1–5.

## Unnumbered outlines (release 27)

The user removed the numerals again. All five stable deployment profile assignments remain so existing references stay valid, but same-color profiles now share identical open outline geometry. There is no center disc or numeral. Red, blue and green retain the sci-fi outer stroke and rails, 32 mm selection footprint and 184.4 mm outer diameter.

Rebuild the catalogue and publish the five changed marker assignments with their regenerated thumbnails after pushing the hosted assets. Ordinary fingerprint reconciliation replaces the obsolete owned numbered skins; no full-catalogue replacement is needed.
