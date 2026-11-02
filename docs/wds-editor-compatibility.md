# WDS editor comparison and menu investigation

The November 2, 2026 editor export was compared, as parsed JSON, against every manifest-listed repository file plus version.json at release 34. Before the reference experiment, all files matched except tokens.json: the repository had 16 records and the editor exported an empty list. terrains.json still matched the complete repository even though the editor displayed zero terrain entries. No editor upload to Git was performed.

An editor draft must not be treated as the authoritative repository. Download it first and run:

```sh
python scripts/compare-wds-export.py /path/to/Starcraft_data.zip
```

This read-only comparison exits unsuccessfully on differences and lists missing, added and changed IDs. It never extracts the ZIP or overwrites game files. It compares game data, not the separately published shared skins or hosted asset binaries. Review intended edits and merge them into the source generators before regenerating and pushing. Preserve unrelated repository files.

## Reference entries created through the editor

Selecting an already-published custom token produced:

```json
{"Id":"Starcraft - Token - Activation - blue - movement","Name":"Starcraft - Token - Activation - blue - movement","Type":"Token"}
```

Selecting the already-published High Ground skin produced:

```json
{"Id":"Starcraft - Terrain - High Ground - 087d53","Name":"Starcraft - Terrain - High Ground - 087d53","Type":"Terrain","Width":10.16,"Length":10.16,"Shape":0}
```

The form defaults to four inches and serializes centimeters. It does not insert a SkinId. The reference exports contained only the one selected token and one selected terrain: writing this draft over the repo would remove the other records and break maps/deployments. The exported snapshots are retained in ignored `.cache/editor-before-comparison.zip`, `.cache/editor-token-reference.zip` and `.cache/editor-reference.zip`.

Our generated records use stable IDs with shared catalogue assignments rather than skin-name IDs. Read-only checks of the downloaded shared catalogue confirmed canonical item IDs and default skins for both sample records. The installed client resolves menu entries using WDS item IDs and shared default assignments, so changing every ID to a skin name is not an established fix. It would require migrating maps, deployments and shared associations together. Keep current IDs, dimensions, placements and shared assignments intact.

## Confirmed client defects (Warhall Test 2.08)

`TerrainPanel.CreateNewButton` extracts a bundle/prefab name from the first model resource and immediately calls `GetObjectReference(bundleName, gameObjectName).GetComponent<AssetUIConfig>()`. It does not check whether the returned object is null. Hosted GLB/OBJ resources are URLs, not installed addressable prefabs. This path can fail before the terrain button is attached or its uploaded thumbnail is considered. The menu needs the same null-safe prefab handling already present in TokenPanel.

Both TokenPanel and TerrainPanel then await the skin thumbnail before attaching the button. AllSkinData returns uploaded thumbnails as relative `user-models/...` paths, while the catalogue website resolves them to absolute URLs. The client's sprite downloader passes the relative path directly to UnityWebRequest. Resolve it against the configured Warhall origin, catch download errors and attach the button with a fallback image even if preview loading fails.

Suggested client logic:

```csharp
var prefab = addressables.GetObjectReference(bundleName, prefabName);
var ui = prefab != null ? prefab.GetComponent<AssetUIConfig>() : null;
// Attach/configure the button before optional asynchronous preview loading.
// Prefer ui.UISprite when present; otherwise resolve the thumbnail against
// the configured test/prod origin, then load it with exception handling.
```

A server-side absolute-thumbnail serialization fix helps tokens, but terrain still needs the null-safe prefab lookup. No WDS field observed in the reference editor records bypasses these client paths. No client binary, shared skin or game-data ID was changed during this investigation. An offline comparison and code inspection are not a successful live menu/placement test. Retest both menus after the editor/client fixes.

## Actual editor-to-Git roundtrip

The user subsequently authorized and completed a real editor upload. The saved baseline is `0a3733e`; the editor produced commits `18d03ce` (manifest), `98fee41` (terrain), and `401432f` (tokens). See [the machine-readable comparison](editor-roundtrip-report.json). Only these three game-data files changed. The manifest file set stayed identical, but its version became 35 while version.json stayed 34. The terrain array shrank from 30 to 1 and tokens from 16 to 1. No extra JSON fields were inserted by upload.

The upload also changed shared catalogue state: readback confirmed new default assignments from skin 13228 to `Starcraft - Token - Activation - blue - movement` and skin 13207 to `Starcraft - Terrain - High Ground - 087d53`, in addition to the original canonical assignments. These two additive aliases are retained as experiment references; no skin was replaced or deleted. The Git rollback alone does not remove catalogue aliases.

Inspection of the official editor frontend explains both behaviors. `TokensEditor.initFromValue` matches records only by numeric SkinId, skin-name Id, or skin-name Name, then immediately emits `buildTokensJson()` if normalization differs. That builder always writes `Id: skin.name` and omits Description, SkinId and other fields. `TerrainsEditor` similarly rewrites Id and dimensions, omits Height/Description, and cannot resolve the canonical `sc_terrain_*` IDs against skin names. Opening the panels is therefore an edit, not a read-only operation. The parent editor's `assignCatalogueSkins()` registers skin-name IDs with `/AssignCatalogueSkin` using override mode on upload.

Adding only SkinId would let the forms find skins, but would not preserve stable IDs or map/deployment references on serialization. A lossless editor fix must retain each original record/Id and its additional fields, match shared catalogue assignments by profileId (or accept SkinId as a lookup hint), and preserve unmatched records. If the user deliberately changes a skin, update the association rather than silently replacing the record's identity. Do not migrate just the two JSON arrays to skin names without migrating all references and assignments.

The complete package is restored as release 36, advancing past the editor's release 35 without rewriting Git history. The original editor commits and the reference exports remain available for comparison. This restoration protects existing maps and deployments; it does not claim the client menu defects have been fixed.
