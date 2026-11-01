# Shared deployment registration

The current Warhall Test client loads template geometry from the shared `DeploymentDB` before it reads the game deployment references. It skips references whose template ID is absent. The inspected Mac cache contains only native IDs 0–15; none of these custom Starcraft IDs is registered there.

Register the eight records from `deployment-templates.json` in the shared test deployment catalogue. Keep each ID unchanged so `Starcraft/deployments.json` and the marker indices continue to match. The game is exact-case `Starcraft`; game data release 18 enables deployments and disables objectives.

| Menu index | Deployment | Template ID |
| --- | --- | --- |
| 1 | ACROPOLIS | 16231390 |
| 2 | BREACH | 16130426 |
| 3 | GAUNTLET | 5379036 |
| 4 | MEETING ENGAGEMENT | 16426918 |
| 5 | ONE BRIDGE TOO CLOSE | 5995631 |
| 6 | PROVING GROUNDS | 4030768 |
| 7 | TYPHOON | 14025690 |
| 8 | 3-INCH GRID (54x36) | 8634166 |

The final entry is a 54×36-inch three-inch grid: vertical lines at X=-27,-24,…,27 and horizontal lines at Z=-18,-15,…,18. It includes the border (32 lines total) and places no mission markers. The seven official deployments retain their existing indices and marker placements.

The authenticated web editor exposes the deployment references/name/parameters, but no shared-template registration control was found. Its visible Upload to Git action publishes WDS files, which does not update DeploymentDB. No unsupported API endpoint is assumed here. Shared registration is still an external prerequisite; a local cache installer is not a universal fix.

After registration, refresh Warhall Test’s shared catalogue, update Starcraft to version 18, set the board to 54×36 inches, and open a fresh room to verify all eight options. Do not publish a stale browser editor buffer over the current repository data.
