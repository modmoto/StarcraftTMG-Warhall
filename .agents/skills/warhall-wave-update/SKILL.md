---
name: warhall-wave-update
description: Prepare a StarCraft miniature game wave for Warhall Test from official releases. Route unit rules, models, deployments, scenarios, layout and publication to their respective workflows.
---

# StarCraft wave update

For a request such as “update Wave 4”, start with an inventory. Find the checkout on main and preserve pending local work. Use the official Archon Studio downloads index configured in src/sources/pdf/downloads.mjs. Compare available card sheets and rulebook revisions with the existing source manifests and import reports. Use New Recruit to cross-check option names and references. Record new, revised, unchanged and unavailable content. Continue independent work when part of a wave is missing.

- **Units and upgrades.** Use the PDF converter and warhall-unit-rules. Preserve stable identifiers. Prepare the separate blue and green approval lists before applying those rule display changes.
- **Model extraction.** Use warhall-model-extraction to select, inspect and prepare portable assets. Flag unavailable models.
- **Model upload.** Use warhall-publish-skins for calibration, thumbnails and shared assignments.
- **Markers and tokens.** Ask during wave inventory whether new tokens are needed. Use warhall-markers-tokens for token artwork, catalogue bindings, editor order and objective marker changes.
- **Deployments.** Use warhall-deployments for official entry layouts and marker placement. Update maps only when official map changes are in scope.
- **Scenarios.** Use warhall-scenarios for scoring cards and mission choices.
- **Card artwork.** Use warhall-card-artwork when non-unit faces or text change.
- **Layout.** Use warhall-profile-layout when the request involves visual grouping, spacing or wrapping.
- **Delivery.** Use warhall-wave-release for validation, Test publication and playtesting. Promote to live only when the user requests it.

Keep the module boundaries. When a new instruction changes an established workflow, follow it for the current task. If it is unclear whether the change should become a standing convention, ask whether to save it in the relevant skill. After confirmation, record the decision and its scope in that module. Extract another skill when a recurring workflow needs its own instructions.

## Tools

Use the npm scripts in package.json for the main workflows. The relevant project docs show direct invocations for specialist checks and repairs. Python is needed when rebuilding PDF card artwork or extracting geometry from Unity bundles. The TTS preview renderer and WDS editor export comparison are Python tools used on demand. See docs/cards.md, docs/model-calibration.md and docs/wds-editor-compatibility.md.
