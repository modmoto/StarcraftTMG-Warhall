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
