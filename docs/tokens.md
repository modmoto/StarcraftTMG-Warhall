# Tokens and faction icons

Release 33 moves all game tokens into Warhall's **Tokens** menu. They are native Token records backed by shared 25 mm round GLB skins. There are no token cards, Tokens card group, front/back faces or flipping.

Release 37 uses each shared skin's exact name as the WDS menu Id. Canonical `sc_token_*` publication IDs remain registered for compatibility; run `npm run models:menus -- --apply --login` to synchronize the menu aliases after publication. The publisher also updates aliases during future replacements. See [editor compatibility](wds-editor-compatibility.md) before saving any web-editor draft.

The menu contains 17 separate tokens:

- Blue movement arrow and blue assault crosshair.
- Red movement arrow and red assault crosshair.
- Terran blue/white, Protoss yellow/white and Zerg purple/white faction markers, with a separate inverted variant for each faction.
- Blue Buff and red Debuff lightning bolts.
- Stim syringe, Burrowed, Hidden and Siege Status reminders.
- Shield: blue with a lighter-blue, large-cell hexagonal raster for Protoss shields.

The artwork is generated in Node from SVG shapes and original faction logo paths in token-artwork/factions. The vectors come from [sc2-icons](https://github.com/sc2-pulse/sc2-icons), pinned to the revision and checksums in token-artwork/sources.json. Source headers and the MIT vectorization licence are retained. Paths render directly at final resolution for both token faces and faction dropdown logos.

Each skin is a thin circular mesh with an embedded unlit PNG texture. Geometry is authored in centimetres, converted through the existing shared-asset scale adapter, and uses a 25 mm diameter. Sizes are a presentation choice, not a claim about official physical tokens. Gameplay effects remain manual.

Run npm run tokens:update to regenerate artwork and token-artwork.json, then npm run convert to generate tokens.json and remove obsolete token cards. Run npm run models:catalogue to build the portable skins and previews. Push the generated assets before publishing only these skins:

```sh
npm run models:publish -- --kind token --apply --login --accept-publication-terms
```

Use the saved login; default target is Warhall Test. Normal fingerprint reconciliation preserves unchanged skins and replaces only changed owned uploads. The publisher supplies generated thumbnails and shared defaults for each token ID. Tokens require shared catalogue publication as well as the WDS update; a data version alone cannot populate their visual models.

The faction dropdown uses icons.json with Type faction and exact faction names. These PNGs load directly through HTTPS and do not need shared skin registration. Scenario markers are separate 32 mm terrain profiles.

After updating to release 33, refresh the shared catalogue and reopen the Tokens menu. Verify all 17 entries, single-face artwork, 25 mm size and placement on Mac/Windows. This does not claim a live client render test.

## Release 42: built-in Warhall tokens

The token menu contains 16 custom tokens plus the native blue, orange, black, white and purple Warhall tokens and native 3-inch/5-inch templates (23 total). builtinTokenNames in src/tokens/package.mjs owns the native list. models:menus resolves exact public native skin names on the selected server and verifies default bindings without reuploading their models or previews.

## Editor serialization compatibility

The generator emits only Id, Name and Type for native token records, matching TokensEditor.buildTokensJson. Explanatory descriptions remain in the source tokenDefinitions for artwork/documentation but are not emitted into tokens.json. token-menu-order.json records the actual 23-token catalogue order from the release-43 editor upload; nativeTokens sorts by that order rather than definition order. This prevents opening Tokens from creating a normalization-only draft for the current catalogue.

The editor orders selected skins by its public-then-shared catalogue response (deduplicated by skin ID), not alphabetically or by the incoming JSON order. Republishing skins can change this remote order. After a deliberate catalogue change, export the Tokens panel, compare all records and refresh token-menu-order.json from that reviewed token ID sequence. Do not upload unrelated terrain normalization. The regression test compares the generated token array with the actual editor-uploaded package. This change does not fix native thumbnail previews.

## Persist reviewed token bundles

`token-model-overrides.json` records the 20 reviewed Unity token bundle URLs. `createTokenAssets` preserves these when rebuilding the catalogue; generated GLB geometry remains the source/preview, not a replacement for tested collider/tag bundles. The live Test and production layer resources were compared before these overrides were recorded. Keep the existing immutable bundles and shared skins. Do not regress edge dragging and outlines by publishing the raw preview GLBs.

## Test data 158: native templates, two-sided activation and minimal trays

Blast Template keeps WDS Id `Token5Inch` and display name `Blast Template`, adds `IsTemplate: true`, and uses a custom shared 130 mm asset rather than the native 127 mm five-inch prefab. `src/tokens/blast-template.mjs` and `blast-template.json` generate its source/preview and pin the Unity bundle. Build with `BuildBlastTemplate.Run` after `prepare-token-colliders.mjs`. The visual includes a full translucent disc plus a rim: native TemplateArea uses mesh triangles, so an open ring alone would not highlight models entirely inside it. Its root collider is circular; no linking script or runtime code is added.

Only two activation definitions remain: blue Movement and red Movement. Each is 32 mm with Movement on top and Assault underneath. The native November 19 Test client rotates tokens 180 degrees about local Z; it does not swap skins. Both faces and the collider are centred on that pivot, with opposite outward normals and distinct textures. `BuildTokenColliders.RunActivationTokens` builds only the active pair and checks the underside after the native flip. Active input IDs are written by the preparation script so stale cache folders do not rebuild deleted Assault definitions.

Every map contains exactly two token stacks outside the standard board edge: 15 blue activation markers and 15 red. No faction, status, Bile, Creep or generic token is placed automatically. Those tokens remain available in the menu except Shield, which is removed from definitions, artwork, ordering and the active catalogue. This removal does not alter native shield stats/HUD counters. Old hash-named assets are retained for historic saves; remove only the inactive shared assignments for the current Test game, not other games' skins.

Local Unity checks verify the 130 mm template bounds, centre/edge hits and rejected square corners; both activation bundles retain 32 mm bounds, renderer Token tags and their table height after Z flipping. Data tests check exact IsTemplate scope, the absent Shield/Assault records and 15+15 placements on every map. Real client contact highlighting, no template attachment and multiplayer flip synchronization still need in-game confirmation. No client patch is used. Publish these new features on Test first; keep release/production unchanged until authorized.

## Test data 159: final token menu

Remove all built-in Warhall colour tokens and the old 3-inch template. The custom 130 mm Blast Template remains under its stable Token5Inch WDS ID; this is not the native five-inch skin. The maintained menu order is: Blast Template; blue/red two-sided activation; Terran, Protoss and Zerg faction pairs; Buff, Debuff; remaining effects alphabetically, except Corrosive Bile immediately follows Bile Bomb. There are 18 WDS token records. token-menu-order.json is authoritative. The converter explicitly removes legacy native records so old template inputs cannot restore them.

Inactive Test-game associations are removed through the website's observed POST /RemoveSkinUsage with itemInstanceId, skinId and costumeDefault, followed by GetMySkinUsages readback. Scope removal to the current exact Starcraft game on the Test server. Preserve the underlying shared skins and other games' bindings. The native five-inch catalogue asset must not be deleted globally. The 130 mm Template and both reversible activation skins are published on Test; production/release remains unchanged until authorized.

## Orange fading blast cylinder

The 130 mm template now has an orange rim and no visible interior fill. Its visual cylindrical shell rises 40 mm from the rim plane, tapers from 0.8 mm radial thickness to zero, and alpha-blends from opacity 190/255 to exactly zero at the top. The PNG gradient is clamped, uncompressed and imported with input alpha; Unlit/Transparent renders both shell surfaces. A completely invisible filled mesh retains the native TemplateArea footprint, while the existing circular selection collider remains at table level. There is no solid cap or new runtime behaviour. The portable preview explicitly uses glTF BLEND for the gradient and hidden contact surface; other assets keep their previous MASK default.

Unity bundle reload verifies 130 mm diameter, 40 mm shell height and the transparent shader. Independent serialized-bundle inspection verifies the gradient endpoints, orange pixels, readable meshes and native renderer Token tags. This is a shared-skin-only Test update; WDS version and production/release are unchanged. The shader's appearance and native contact highlighting still require a client check.

## Confirmed client blocker: forced opaque shader

The user tested the fading cylinder in Warhall Test and it rendered fully opaque, including the intended invisible floor. Read-only inspection of the installed November 19 Test client confirms why: AssetDownloadController.LoadUnityBundle instantiates the asset and unconditionally calls ApplyStandardDoubleSidedShader, which replaces every child Renderer's material shader with Custom/StandardDoubleSided_Lite_Opaque. This happens after the bundle's own correct transparent materials have loaded. The previous local checks validated the bundle but did not simulate this override; they do not establish in-client transparency.

A real alpha-blended cylinder and a 30%-opacity orange floor need the native loader to preserve transparent materials or choose an alpha-capable shader for them. Changing texture alpha, GLB BLEND, the bundle shader or renderQueue alone does not avoid the unconditional opaque-shader replacement. Do not repeatedly republish alpha-only variants as a fix and do not modify the client. A perforated geometry approximation is a visually different option requiring user agreement.

Suggested upstream report: "Unity-bundle token transparency is discarded by AssetDownloadController.ApplyStandardDoubleSidedShader: every Renderer material is switched to Custom/StandardDoubleSided_Lite_Opaque. Please preserve alpha-blended materials, or map transparent materials to a compatible transparent double-sided shader. Our 130mm blast template needs a 40mm fading cylindrical rim and an orange floor at 30% opacity."

## Flat orange ring after transparency rejection

The user chose a plain orange circle with no fill or cylinder. The template now renders only a flat 130 mm annulus. Remove the old translucent/hidden contact renderers: an alpha-zero fill becomes opaque in the client, and Renderer.forceRenderingOff did not survive bundle serialization in the local test.

The visible annulus uses a native single-bone SkinnedMeshRenderer with a static identity bind pose. The November 19 TemplateArea implementation only collects MeshFilter shapes; with none present it uses its existing collider-based path. A separate root circular MeshCollider supplies the full interior footprint and centre/edge selection. No invisible drawing surface, custom runtime script or client patch is included. The Unity-bundle loading path preserves this renderer type (the importer-side skinned-to-static conversion applies to imported model files, not this bundle path).

After bundle reload the builder asserts no MeshFilters, exactly one ring renderer, flat 130 mm baked bounds and no visible vertices inside the annulus. Replacing its shader with opaque Standard cannot reveal any fill. Collider raycasts hit the centre and rim and miss square corners. Native contact highlighting still needs an in-client check; the decision to use a flat circle does not establish that gameplay result.
