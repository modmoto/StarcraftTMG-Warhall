# Objective marker tokens

The five objectives are native Token records in tokens.json. DeploymentTerrains places them with IsToken=true at the existing coordinates. They are absent from terrains.json. Their existing exact shared skin-name IDs (which retain the historical Terrain word), canonical sc_mission_* bindings and visuals are preserved to reuse working published skins.

Each objective sets RadiusBaseDiameterMm=32: a 32 mm diameter and 16 mm radius. Native radius rings and minimum-distance measurement use this circular footprint instead of the token centre. The field does not resize the visual mesh or follow user scaling. ImageToken does not support it. Do not derive the footprint from the decorative outer control ring.

The same reviewed skin still contains its decorated centre and open 184.4 mm outer control outline (three inches beyond the 32 mm base). The front geometry, materials and transforms remain unchanged. Native flip support adds a mirrored reverse side and requires replacement shared skins with refreshed thumbnails.

Use src/deployments/markers.mjs for identities and footprints, src/deployments/package.mjs for deployment placement, and src/deployments/marker-assets.mjs for artwork. nativeTokens includes objectives and token-menu-order.json retains the exact menu IDs. The deployment updater replaces prior objective records rather than duplicating them.

Validate token references, absence from terrain, deployment IsToken flags, unchanged coordinates and shared defaults. In Warhall Test reload game data and create a fresh deployment; check appearance, movement and base-edge measurement. Offline validation does not establish client behavior.

## Deployment locking limitation

The current DeploymentTerrainEntry supports IsToken but has no per-item lock field, and AddToken does not apply a movement lock. Automatic objective locking while retaining selection and measurement requires native client support. Do not invent a WDS Locked field, disable colliders or convert objectives back to terrain as a workaround. Objectives currently remain movable and measurable.
