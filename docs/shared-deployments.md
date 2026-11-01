# Shared deployments (release 19)

The seven official deployments and the three-inch grid now use built-in deployment template 12 with X=0 and Y=0. Its eight native corner segments have zero length at those settings, so the client can create every menu entry without requiring custom DeploymentDB records. Duplicate template IDs are intentional: each entry has its own name and one-based menu index.

The original border-only entry geometry remains in `deployment-templates.json`. The Node builder converts it into eight portable textured GLB overlays under `model-assets/`, registered as shared skins against `sc_deployment_<original-template-id>` terrain profiles. `DeploymentTerrains` places the matching overlay alongside the existing mission markers. These are thin lines on the battlefield border, not filled influence zones. The grid overlay contains the original 32 lines, including the board border.

Use a 54×36-inch board. The seven official deployment indices and marker coordinates are unchanged; index 8 is the grid. Objectives remain hidden. Cosmetic overlays have a tiny central terrain footprint, not a board-sized collision box. They are spawned terrain, so do not assume the deployment-line visibility toggle also hides them; verify selection, switching and flipping in the client.

## Publish

Push release 19 and its content-addressed GLBs to GitHub, then run:

```sh
npm run models:publish -- --kind deployment --apply --login --accept-publication-terms
```

The default target is Warhall Test. This publishes only the eight line-overlay skins, including generated thumbnails. Refresh the shared catalogue, update Starcraft, and create a fresh room to verify all eight deployments. Publish the three marker skins separately with `--kind marker` if still pending.

The old Windows cache installer is a legacy test helper. It is not needed by this path. No authenticated upload or live client verification has been performed for this release yet. Do not upload a stale browser editor buffer over the current repository files; force sync only after the new files are pushed.
