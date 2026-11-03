---
name: warhall-deployments
description: Add or revise official StarCraft deployment choices and battlefield overlays for Warhall.
---

# Deployments

Compare the official deployment face with deployment-templates.json and the current Test layouts. Follow docs/shared-deployments.md and docs/mission-markers.md, using current source data for counts. On the 54×36 board, verify entry borders, orientation and marker coordinates. Preserve IDs and menu order. Keep the native template and spawned overlay bindings consistent.

Run npm run deployments:update and node scripts/update-deployments.mjs --check. Review the map and deployment together in Test. Use warhall-card-artwork for the reference face and warhall-publish-skins for changed overlays. Keep scoring missions separate. Native flip behavior is tracked in docs/warhall-flip-limitations.md.
