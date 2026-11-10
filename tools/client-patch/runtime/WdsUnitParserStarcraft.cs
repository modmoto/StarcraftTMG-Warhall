using System.Globalization;
using System.Text.RegularExpressions;
using UnityEngine;

public sealed class WdsUnitParserStarcraft : WdsUnitParser
{
    private sealed class ImportLayout
    {
        public readonly List<Unit> Units = new();
        public readonly Dictionary<string, Vector3> Cards = new();
        public float DraftCursor;
        public float CardCursor;
    }

    private static ImportLayout activeLayout;

    public static void TrackImportedUnit(Unit unit) => activeLayout?.Units.Add(unit);

    private static readonly Regex UnitsHeading = new(@"^#*\s*Units\s*:?\s*$", RegexOptions.IgnoreCase);
    private static readonly Regex CardHeading = new(
        @"^#*\s*(?<section>Faction(?: Card)?|Tactical(?: Cards)?|Deployment Maps?|Mission Cards?)\s*(?::\s*(?<names>.*))?$",
        RegexOptions.IgnoreCase);
    private static readonly Regex CardLine = new(
        @"^(?:(?<count>\d{1,3})\s*[x×]\s+)?(?<name>.+?)(?:\s+\([^)]*\bGas\))?$",
        RegexOptions.IgnoreCase);
    private static readonly Regex UnitLine = new(
        @"^(?:(?<count>\d{1,3})\s*[x×]\s+)?(?<name>.+?)(?:\s+\((?<points>\d+)\s*,\s*\d+S\))?(?:\s*:\s*(?<options>.+))?$",
        RegexOptions.IgnoreCase);

    public WdsUnitParserStarcraft(ParserOptions options = null) : base(options) { }

    public static async System.Threading.Tasks.Task DeployWithAdditionalLoads(
        Gamelogic.Army army, GameController game, string owner)
    {
        if ((int)WDSGameConfigAccess.Current.ListParsingAlgorithm != 7 ||
            !(army is WDSArmy imported) || imported.ParsedUnits == null)
        {
            await army.Deploy(game, owner);
            return;
        }

        var roster = imported.ParsedUnits
            .Select(unit => (Unit: unit, Id: WDSAccess.GetUnitByNameFromArmy(unit.Name, imported.bookName)?.Id))
            .ToArray();
        var cardIds = new HashSet<string>(WDSAccess.LoadedCards
            .Where(card => roster.Any(entry => HasOption(entry.Unit, card.Name)))
            .Select(card => card.Id));
        var cards = roster.SelectMany(entry => entry.Unit.Options)
            .Select(option => (Option: option, Card: WDSAccess.LoadedCards.FirstOrDefault(card =>
                string.Equals(card.Name, option.Name, StringComparison.OrdinalIgnoreCase))))
            .Where(entry => entry.Card != null).ToArray();
        float RowWidth(bool draft) => Mathf.Max(0f, cards.Where(entry => IsDraftCard(entry.Card.Id) == draft)
            .Sum(entry => (CardSize(entry.Card).x + CardGap) * entry.Option.Count) - CardGap);
        float tacticalLeft = -RowWidth(false) / 2f;
        float boardLeft = -WDSGameConfigAccess.Current.BattlegroundWidth * 1.27f;
        var layout = new ImportLayout
        {
            CardCursor = tacticalLeft,
            DraftCursor = Mathf.Min(boardLeft, tacticalLeft - 2f * CardGap - RowWidth(true))
        };
        var previousLayout = activeLayout;
        activeLayout = layout;
        try
        {
            await army.Deploy(game, owner);
        }
        finally
        {
            activeLayout = previousLayout;
        }

        var regularUnits = layout.Units.Take(roster.Length).Where((unit, index) => unit != null && !IsListedSupport(roster[index].Id)).ToArray();
        var footprints = regularUnits.ToDictionary(unit => unit, CompactFormation);
        if (regularUnits.Length > 0)
        {
            float rowZ = regularUnits[0].transform.position.z;
            float direction = game.IsLocalPlayerRotated ? 1f : -1f;
            const float unitGap = 3.2f;
            float cursor = -(footprints.Values.Sum(size => size.x) + (regularUnits.Length - 1) * unitGap) / 2f;
            foreach (var unit in regularUnits)
            {
                float width = footprints[unit].x;
                unit.Move(new Vector3((cursor + width / 2f) * direction, unit.transform.position.y, rowZ));
                cursor += width + unitGap;
            }
        }
        var reserves = new List<(string Id, int Models, Vector3? Anchor)>();
        var assignedReserves = new HashSet<int>();
        float side = game.IsLocalPlayerRotated ? 1f : -1f;
        void AddReserve(string id, int count, Vector3? anchor)
        {
            for (int index = 0; index < Math.Min(roster.Length, layout.Units.Count); index++)
            {
                if (roster[index].Id != id || layout.Units[index] == null || !assignedReserves.Add(index))
                    continue;
                if (anchor.HasValue)
                    layout.Units[index].Move(anchor.Value);
                return;
            }
            reserves.Add((id, count, anchor));
        }

        Vector3? CardAnchor(string id) => layout.Cards.TryGetValue(id, out var position) ? position : (Vector3?)null;
        for (int index = 0; index < roster.Length; index++)
        {
            var entry = roster[index];
            Vector3? anchor = index < layout.Units.Count && layout.Units[index] != null
                ? layout.Units[index].transform.position + Vector3.forward *
                    (((footprints.TryGetValue(layout.Units[index], out var size) ? size.y :
                        layout.Units[index].GetFootprintSize().z) / 2f + 4f) * side) : (Vector3?)null;
            switch (entry.Id)
            {
                case "pdf_Zerg_unit_corpsers_roach":
                    AddReserve("pdf_Zerg_unit_roachling", 3, anchor);
                    break;
                case "pdf_Terran_unit_raven":
                    AddReserve("pdf_Terran_unit_auto_turret", 1, anchor);
                    break;
                case "pdf_Terran_unit_nova_assault_mode":
                    AddReserve("pdf_Terran_unit_holo_decoy", 1, anchor);
                    break;
                case "pdf_Terran_unit_nova_stealth_mode" when roster.Any(unit => unit.Id == "pdf_Terran_unit_holo_decoy"):
                    AddReserve("pdf_Terran_unit_holo_decoy", 1, anchor);
                    break;
            }
        }

        if (cardIds.Contains("sc_card_terran_tactics_raynor_s_raiders"))
            AddReserve("pdf_Terran_unit_point_defense_drone", 1, CardAnchor("sc_card_terran_tactics_raynor_s_raiders"));
        if (cardIds.Contains("sc_card_terran_tactics_nova_covert_ops"))
            AddReserve("pdf_Terran_unit_sabotage_drone", 1, CardAnchor("sc_card_terran_tactics_nova_covert_ops"));
        if (cardIds.Contains("sc_card_protoss_tactics_khalai"))
            AddReserve("pdf_Protoss_unit_pylon", 1, CardAnchor("sc_card_protoss_tactics_khalai"));
        if (cardIds.Contains("sc_card_zerg_tactics_kerrigan_s_swarm"))
            AddReserve("pdf_Zerg_unit_omega_worm", 1, CardAnchor("sc_card_zerg_tactics_kerrigan_s_swarm"));
        if (cardIds.Contains("sc_card_zerg_tactics_cocoon") &&
            roster.Any(entry => entry.Id == "pdf_Zerg_unit_roaches"))
            AddReserve("pdf_Zerg_unit_ravagers", 1, CardAnchor("sc_card_zerg_tactics_cocoon"));

        int slot = 0;
        Vector3 NextPosition()
        {
            int index = slot++;
            int column = (index + 1) / 2 * (index % 2 == 0 ? -1 : 1);
            return new Vector3(column * 20f * side, 0f, 55f * side);
        }

        foreach (var reserve in reserves)
        {
            var unit = WDSAccess.GetUnit(reserve.Id);
            if (unit == null)
                continue;
            var profiles = unit.BasicProfileIds.Select(WDSAccess.GetProfile)
                .Where(profile => profile != null)
                .Select(profile => (profile, new List<WDSOption>())).ToList();
            var logic = game.CreateUnitLogicWDS(unit.Id, new List<WDSOption>(), profiles);
            var formation = new FormationStructure(WDSGameConfigAccess.GetFormationType(0), unit.DefaultFront, 1)
            {
                SoldierCount = reserve.Models
            };
            Vector3 position = reserve.Anchor.HasValue
                ? reserve.Anchor.Value : NextPosition();
            game.CreateUnit(owner, logic, formation, position, Quaternion.identity, imported.bookName,
                WDSAccess.GetCategoryByFactionAndName(imported.bookName, unit.Name), "Import reserve");
        }
    }

    private static Vector2 CompactFormation(Unit unit)
    {
        var soldiers = unit.GetComponentsInChildren<Soldier>();
        if (soldiers.Length == 0)
            return new Vector2(Mathf.Max(3f, unit.GetFootprintSize().x), unit.GetFootprintSize().z);

        const float baseGap = 0.15f;
        int columns = Mathf.CeilToInt(Mathf.Sqrt(soldiers.Length));
        var rows = Enumerable.Range(0, (soldiers.Length + columns - 1) / columns)
            .Select(index => soldiers.Skip(index * columns).Take(columns).ToArray()).ToArray();
        float Width(Soldier[] row) => row.Sum(soldier => soldier.Width) + (row.Length - 1) * baseGap;
        float depth = rows.Sum(row => row.Max(soldier => soldier.Length)) + (rows.Length - 1) * baseGap;
        float front = -depth / 2f;
        var origin = unit.transform.position;
        var positions = new List<(Soldier model, Vector3 position, Quaternion rotation)>();
        foreach (var row in rows)
        {
            float rowDepth = row.Max(soldier => soldier.Length);
            float left = -Width(row) / 2f;
            foreach (var soldier in row)
            {
                var position = origin + unit.transform.right * (left + soldier.Width / 2f)
                    - unit.transform.forward * (front + rowDepth / 2f);
                position.y = soldier.transform.position.y;
                positions.Add((soldier, position, soldier.transform.rotation));
                left += soldier.Width + baseGap;
            }
            front += rowDepth + baseGap;
        }
        LeadingMovement.ApplyCloudTransforms(unit, positions);
        return new Vector2(rows.Max(Width), depth);
    }

    private static bool HasOption(ParsedWDSUnit unit, string name) =>
        unit.Options.Any(option => string.Equals(option.Name, name, StringComparison.OrdinalIgnoreCase));

    private const float CardGap = 2.5f;

    private static bool IsListedSupport(string id) =>
        id == "pdf_Terran_unit_auto_turret" || id == "pdf_Terran_unit_holo_decoy" ||
        id == "pdf_Terran_unit_point_defense_drone" || id == "pdf_Terran_unit_sabotage_drone" ||
        id == "pdf_Zerg_unit_roachling";

    private static Vector2 CardSize(WDSItem card) =>
        card?.UIConfig is WDSDisplayableDataUIConfigCard config
            ? new Vector2(config.Width, config.Length) / 10f : new Vector2(6.3f, 8.8f);
    private static bool IsDraftCard(string id) =>
        id.StartsWith("sc_card_deployments_", StringComparison.Ordinal) ||
        id.StartsWith("sc_card_missions_", StringComparison.Ordinal);

    public static void PlaceImportedCard(GameController game, string id, Vector3 nativePosition, bool exact)
    {
        var layout = activeLayout;
        if (layout == null)
        {
            game.CreateCard(id, nativePosition, exact);
            return;
        }

        float side = game.IsLocalPlayerRotated ? 1f : -1f;
        Vector2 size = CardSize(WDSAccess.GetCard(id));
        ref float cursor = ref (IsDraftCard(id) ? ref layout.DraftCursor : ref layout.CardCursor);
        float x = cursor + size.x / 2f;
        cursor += size.x + CardGap;
        float halfDepth = size.y / 2f;
        float innerEdge = WDSGameConfigAccess.Current.BattlegroundHeight * 1.27f + CardGap;
        var position = new Vector3(-x * side, nativePosition.y, (innerEdge + halfDepth) * side);
        layout.Cards[id] = position + Vector3.forward * (halfDepth * side);
        game.CreateCard(id, position, exact);
    }

    public override List<ParsedWDSUnit> Parse(string armyName, string[] normalizedLines)
    {
        var lines = normalizedLines ?? Array.Empty<string>();
        int heading = Array.FindIndex(lines, line => UnitsHeading.IsMatch(line?.Trim() ?? ""));
        if (heading < 0)
            return new WdsUnitParserDefault(_opts).Parse(armyName, lines);

        var names = WDSAccess.GetUnitNamesForArmy(WDSAccess.ResolveArmyName(armyName)) ?? new List<string>();
        var units = new List<ParsedWDSUnit>();
        ParsedWDSUnit currentUnit = null;
        foreach (string raw in lines.Skip(heading + 1).Take(_opts.OperationBudget))
        {
            string line = raw?.Trim() ?? "";
            if (line.StartsWith("#") || line.StartsWith("Created with ", StringComparison.OrdinalIgnoreCase))
                break;
            if (line.Length == 0)
                continue;
            if (line.StartsWith("•"))
            {
                if (currentUnit != null)
                    ParseUtils.HarvestOptionsCsvCounts(line.Substring(1).Trim(), currentUnit.Options);
                continue;
            }
            currentUnit = null;

            var match = UnitLine.Match(line);
            if (!match.Success)
                continue;
            string name = match.Groups["name"].Value.Trim();
            string canonical = names.Find(value => string.Equals(value, name, StringComparison.OrdinalIgnoreCase));
            if (canonical == null && !name.Equals("Nova", StringComparison.OrdinalIgnoreCase))
                continue;

            var unit = new ParsedWDSUnit(canonical ?? name) { Count = 1 };
            if (int.TryParse(match.Groups["count"].Value, NumberStyles.None, CultureInfo.InvariantCulture, out int count) && count > 0)
                unit.Count = count;
            if (int.TryParse(match.Groups["points"].Value, NumberStyles.None, CultureInfo.InvariantCulture, out int points))
                unit.Points = points;
            ParseUtils.HarvestOptionsCsvCounts(match.Groups["options"].Value, unit.Options);
            units.Add(unit);
            currentUnit = unit;
        }
        foreach (var nova in units.Where(unit => unit.Name.Equals("Nova", StringComparison.OrdinalIgnoreCase)))
        {
            var mode = nova.Options.FirstOrDefault(option =>
                string.Equals(option.Name, "Stealth Mode", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(option.Name, "Assault Mode", StringComparison.OrdinalIgnoreCase));
            if (mode != null)
            {
                string variant = "Nova " + mode.Name;
                nova.Name = names.Find(name => name.Equals(variant, StringComparison.OrdinalIgnoreCase)) ?? nova.Name;
                if (!nova.Name.Equals("Nova", StringComparison.OrdinalIgnoreCase))
                    nova.Options.Remove(mode);
            }
        }
        units.RemoveAll(unit => unit.Name.Equals("Nova", StringComparison.OrdinalIgnoreCase));
        if (units.Count > 0)
            AddCardOptions(lines.Take(heading), units[0].Options);
        return units;
    }

    private void AddCardOptions(IEnumerable<string> lines, List<ParsedWDSOptionCount> options)
    {
        // WDSArmy already resolves exact card options and spawns them on the table.
        var cards = WDSAccess.LoadedCards;
        if (cards == null)
            return;

        string section = "";
        foreach (string raw in lines.Take(_opts.OperationBudget))
        {
            string line = raw?.Trim() ?? "";
            var heading = CardHeading.Match(line);
            if (heading.Success)
            {
                section = heading.Groups["section"].Value;
                foreach (string name in heading.Groups["names"].Value.Split(','))
                    AddCard(name.Trim(), 1);
                continue;
            }

            if (section.Length == 0)
                continue;
            if (!line.StartsWith("•") &&
                !section.StartsWith("Tactical", StringComparison.OrdinalIgnoreCase) &&
                !section.Equals("Faction", StringComparison.OrdinalIgnoreCase))
                continue;

            var entry = CardLine.Match(line.TrimStart('•').TrimStart());
            if (entry.Success)
            {
                int count = int.TryParse(entry.Groups["count"].Value, out int parsed) ? parsed : 1;
                AddCard(entry.Groups["name"].Value.Trim(), count);
            }
        }

        void AddCard(string name, int count)
        {
            bool deployment = section.StartsWith("Deployment", StringComparison.OrdinalIgnoreCase);
            var candidates = deployment
                ? cards.Where(item => item.Id.StartsWith("sc_card_deployments_", StringComparison.Ordinal))
                : cards.AsEnumerable();
            var card = candidates.FirstOrDefault(item => string.Equals(item.Name, name, StringComparison.OrdinalIgnoreCase));
            if (card == null && deployment)
                card = candidates.FirstOrDefault(item =>
                    string.Equals(item.Name, name + " (Skirmish)", StringComparison.OrdinalIgnoreCase));
            if (card != null && count > 0)
                options.Add(new ParsedWDSOptionCount(card.Name, count));
        }
    }
}
