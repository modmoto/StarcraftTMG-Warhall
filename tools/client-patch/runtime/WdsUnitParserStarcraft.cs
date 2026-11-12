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
