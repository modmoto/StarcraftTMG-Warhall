# Empty native Tokens menu: investigation

Read-only checks on November 2, 2026 confirmed that release 33's tokens.json contains all 16 native Token records and the Mac test client downloaded them. The live shared catalogue and the client's own catalogue cache both contain all 16 matching items and modifier-free default skin assignments. All 16 skins have model layers. No game-data release or skin reupload is needed to restore those records.

A verified compatibility issue exists in the thumbnail path:

- GetCatalogueSkins returns absolute thumbnailUrl values. All 16 token preview URLs respond successfully.
- AllSkinData stores Thumbnail as a relative `user-models/<owner>/<filename>.jpg` path, also present in the native client's downloaded cache.
- DBHSQL.CacheSkinData and GetSkinThumbnail pass that relative string through unchanged.
- TokenPanel.CreateNewButton awaits AssetDownloadController.LoadSpriteFromURLAsync before attaching the button to the panel. The downloader passes the string directly to UnityWebRequest.Get without resolving it to an HTTPS URL.

The appropriate server fix is to serialize absolute thumbnail URLs in AllSkinData using the same public-URL resolver as GetCatalogueSkins. A client fix can additionally resolve relative media paths and ensure preview failure always completes its task, allowing the token button to appear with a fallback image. Relative thumbnails are a confirmed defect; correlating the empty panel with its activation logs is still required before declaring this the complete cause.

The native TokenPanel component is present and enabled in the battlefield scene. A separate missing script logged on SpellPanel belongs to another panel; that warning alone does not establish a Tokens menu failure. The inspected log has no TokenPanel button-creation messages, so the exact menu route and panel activation remain to be confirmed.

No application binary, scene, catalogue cache or credentials were modified during this investigation. Do not mask the issue by installing machine-local mappings or repeatedly republishing unchanged skins. After a server/client fix, refresh the shared catalogue, reopen the battlefield token placement panel and verify all 16 buttons and token creation.

## Release 40 preview recheck

Rechecked all 16 owned token catalogue entries against the live test service. Every catalogue thumbnail URL was absolute HTTPS, returned HTTP 200, and decoded through sharp as a valid 512x512 PNG. Uploaded files use .jpg names despite PNG contents; this is not sufficient evidence of a Unity decode failure. Missing files, invalid image bytes and zero-sized images are ruled out at the hosted catalogue URL. Raw results are retained locally in .cache/token-preview-checks.json.

The public catalogue frontend exposes model-transform editing but no observed thumbnail-path override. The existing upload contract takes thumbnail_data_url and lets the service choose the stored path. WDS token UIConfig images are not read by TokenPanel.CreateNewButton, so adding an ImageURL there cannot repair this particular menu. No skin was replaced or unsupported API fields sent. The relative AllSkinData path remains the identified client compatibility issue; these checks are not a successful native preview test.

## Release 41: built-in purple comparison

Added TokenWarhallPurple as a native reference alongside the 16 custom tokens. models:menus resolves its exact public skin name on the selected server and assigns it as the reference default without uploading or modifying the native skin. The test catalogue confirms skin 4583. Cached native model metadata uses Tokens/TokenWarhallPurple; custom token resources are hosted GLB URLs. TokenPanel looks for a built-in token prefab first and uses AssetUIConfig.UISprite when available, so native previews can bypass thumbnail downloads entirely. The fallback requests mySkinParts.thumbnail. The native skin also has a relative WarhallCatalogue/... thumbnail path, showing that a working native preview does not prove relative URL downloads work.

The reference is ready for a fresh native client comparison; adding it and inspecting code are not a completed in-game visual test. Do not replace custom meshes with the native prefab just to obtain a preview.
