# Flip behavior in the inspected Warhall client

The current client code explains both reported failures. These buttons cannot be repaired through Starcraft's WDS JSON alone.

`TerrainController.FlipTerrain` changes every terrain position from (x,y,z) to (-x,y,-z), but leaves its rotation unchanged. Asymmetric walls and ramps therefore cease to form the correctly rotated layout. A proper 180-degree map rotation must update both world position and world yaw, preserving pitch and roll, and synchronize both transforms to other players.

`DeploymentsAndObjectives.RPCFlipDeployment` calls `DeploymentController.FlipDeployments`, which rotates only the native children of AllDeploymentLines. Starcraft's border overlays and mission markers are spawned DeploymentTerrains. They are outside that hierarchy, so the button rotates the empty native template while the visible deployment remains stationary.

Warhall must apply the deployment's flip state to its spawned terrain positions and rotations, including when switching or reloading deployments. Map flipping must distinguish battlefield terrain from deployment decorations so independent flip actions do not rotate a deployment twice.

Verification for a client fix: use an asymmetric L wall and ramp; flip once and verify a rigid 180-degree rotation; flip twice and verify every position and rotation returns to its original value. Repeat with deployment border lines, all mission markers, switching deployments, reload and a second connected player. This repository does not modify application binaries or private client caches. Neither native button is claimed fixed by release 27.
