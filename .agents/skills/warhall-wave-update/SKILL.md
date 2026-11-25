---
name: warhall-wave-update
description: Prepare a StarCraft miniature game wave for Warhall Test from official releases. Route unit rules, models, deployments, scenarios, layout and publication to their respective workflows.
---

# StarCraft wave update

For a request such as “update Wave 4”, start with an inventory on main and preserve pending local work. As explicitly requested on 2026-11-25, use only the public Command Center DB for unit stats, weapons, abilities, upgrades, squad costs and tactical cards. Run npm run wave:update; it downloads army_units/tactical_cards and creates an audited candidate under .cache/wave-update without changing Starcraft/. Do not fetch rules_sections or update the general rulebook/glossary. See docs/command-center-updates.md. New Recruit is an optional cross-check, not the update source. Record new, revised, unchanged and unavailable content; continue independent work when part is missing.

The sole PDF fallback is missing base footprints: npm run wave:bases -- --pdf-dir PATH --apply reads identity and printed dimensions only. Preserve existing command-center-mapping.json IDs and reviewed sizes. Do not guess unknown bases or reimport PDF unit rules. Missing bases or source conflicts block application. The user has authorized required Wave-4 tokens. Audit reserve models and token needs from DB wording; model/artwork availability remains a separate publication requirement.

- **Units and upgrades.** Use the DB wave importer and warhall-unit-rules. Review the generated report, preserve stable identifiers and obtain separate blue/green approvals before applying. Pass the approved snapshot fingerprint to --approve-blue/--approve-green with --apply; flags are not a substitute for human approval. Application saves the source and advances manifest/version together when data changes. Legacy converters must not overwrite Starcraft/.
- **Model extraction.** Use warhall-model-extraction to select, inspect and prepare portable assets. Flag unavailable models.
- **Model upload.** Use warhall-publish-skins for calibration, thumbnails and shared assignments.
- **Markers and tokens.** Ask during wave inventory whether new tokens are needed. Use warhall-markers-tokens for token artwork, catalogue bindings, editor order and objective marker changes.
- **Importer reserve models.** For every wave, use warhall-importer-reserve-models to audit new and revised unit rules, upgrades and cards for required reserve models, then update native WDS ExtraItems definitions.
- **Deployments.** Use warhall-deployments for official entry layouts and marker placement. Update maps only when official map changes are in scope.
- **Scenarios.** Use warhall-scenarios for scoring cards and mission choices.
- **Card artwork.** Use warhall-card-artwork when non-unit faces or text change.
- **Layout.** Use warhall-profile-layout when the request involves visual grouping, spacing or wrapping.
- **Delivery.** Use warhall-wave-release for validation, Test publication and playtesting. Promote to live only when the user requests it.

Keep the module boundaries. When a new instruction changes an established workflow, follow it for the current task. If it is unclear whether the change should become a standing convention, ask whether to save it in the relevant skill. After confirmation, record the decision and its scope in that module. Extract another skill when a recurring workflow needs its own instructions.

## Tools

Use the npm scripts in package.json for the main workflows. The relevant project docs show direct invocations for specialist checks and repairs. Python is needed when rebuilding PDF card artwork or extracting geometry from Unity bundles. The TTS preview renderer and WDS editor export comparison are Python tools used on demand. See docs/cards.md, docs/model-calibration.md and docs/wds-editor-compatibility.md.
