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
