# Client examples

Whenever movement or scoreboard behavior changes, update its C# example and README in the same change. The examples must match the locally installed prototype, not an earlier draft. Keep all scoreboard Photon helpers in StarcraftScoreboard.cs so developers copy one file. Record what was tested and distinguish simulated checks from real multiplayer verification. Token placement belongs to deployment/import data; never reintroduce runtime token arrangement or deduplication in the scoreboard.

The client patch must not replace native token or terrain asset loading. Fix missing shared catalogue assignments at their source instead of adding a runtime asset fallback.
