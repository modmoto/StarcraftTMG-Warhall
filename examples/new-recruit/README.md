# StarCraft list importer

The community patch registers `WdsUnitParserStarcraft` in Warhall's native parser factory as `ListParsingAlgorithmMode.Starcraft = 7`. Select that mode in the StarCraft WDS game configuration. Warhall can integrate the parser class directly and call its deployment and placement helpers at the same points used by the patch.

The parser accepts New Recruit text lists with a Units section. It resolves full unit names and options, including Nova's Stealth and Assault variants. It resolves draft and tactical cards separately. Deployment names without the Skirmish suffix fall back to the matching Skirmish card after exact matching.

Import from the Archon app is still pending. Its list export uses a different format and needs a dedicated adapter before it can use the same deployment and placement logic.

The deployment wrapper preserves the standard army import and stages the resulting squads in one centered row with a 32 mm gap. Models form compact rows with the last row centered. Draft cards occupy a separate block to the left of the centered tactical and faction cards. The reserve mappings place additional models below their source unit or at the bottom edge of their source card.

For regression checks, import the Terran list in [the test fixture](../../test/fixtures/lists/terran-anti-toss-ravager.txt). Also check both Nova modes, a Zerg list with Dirt Side and Frontier, a Corpser Roach reserve group, and a list containing Raynor's Raiders. Check the arrangement from both player sides. Follow the [reserve model skill](../../.agents/skills/warhall-importer-reserve-models/SKILL.md) when rules change.

See the [patch build instructions](../../tools/client-patch/README.md) and the [list format notes](../../docs/new-recruit-import.md).
