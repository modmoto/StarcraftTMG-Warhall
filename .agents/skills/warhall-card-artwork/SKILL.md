---
name: warhall-card-artwork
description: Extract and verify sharp non-unit Warhall cards from official StarCraft PDFs.
---

# Card Artwork

Use docs/cards.md and the existing cards:update workflow. Use the official PDF vector artwork. Locate each actual bleed rectangle, inset exactly 3 mm and verify front/back orientation. Mixed layouts can shift between pages. Render source pages at 600 DPI and export lossless RGBA PNG faces with a 2048-pixel maximum edge, transparent rounded corners and clean edges. Preserve stable WDS IDs and use readable card and face names with a content hash.

Review contact sheets for alignment, sharpness, stray white strips and face pairing. Check printed phases, activation types and costs. Record extraction exceptions in card-text-overrides.json after checking the face. Keep Color2 empty to suppress the white disc. Verify alpha in the files separately from the client material behavior described in docs/cards.md.

Run npm run cards:update, npm run convert -- --offline and npm run check:local. Keep unit cards outside this workflow. Regenerate only when card artwork or text changes.
