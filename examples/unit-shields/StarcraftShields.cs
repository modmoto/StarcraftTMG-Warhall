using System;
using System.Collections.Generic;
using System.Linq;
using Photon.Pun;
using UnityEngine;
using UnityEngine.UI;
using PhotonHashtable = ExitGames.Client.Photon.Hashtable;

public static class StarcraftShields
{
    private sealed class State
    {
        public Unit Unit;
        public int Maximum, Remaining, HullDamage;
        public GameObject Root;
        public Text Number;
        public RectTransform Symbol;
        public string Pending;
        public string Key => "sc.shields.v1." + Unit.GetComponent<PhotonView>().ViewID;
    }

    private static readonly Dictionary<Unit, State> states = new();
    private static readonly Color Blue = new(0.18f, 0.73f, 0.94f);
    private static Sprite icon;
    private static float nextScan;

    private static int Attribute(Soldier model, string name)
    {
        foreach (var row in model.GetLogic()?.GetStatlines() ?? new List<WDSDisplayableDataInstance>())
            if (row.Attributes != null && row.Attributes.TryGetValue(name, out var text) &&
                int.TryParse(text, out var value)) return Mathf.Max(0, value);
        return 0;
    }

    private static State Get(Unit unit)
    {
        if (unit == null || unit.GetLogic() == null || !(unit.Formation is Cloud)) return null;
        if (states.TryGetValue(unit, out var existing)) return existing;
        var models = unit.GetAllSoldiers();
        var model = models.FirstOrDefault();
        if (model == null || !System.Text.RegularExpressions.Regex.IsMatch(unit.GetLogic().Id ?? "", @"^(?:sc_|pdf_(?:Protoss|Terran|Zerg)_)", System.Text.RegularExpressions.RegexOptions.IgnoreCase)) return null;
        int maximum = Attribute(model, "Shd");
        if (maximum == 0) return null;
        var state = new State { Unit = unit, Maximum = maximum, Remaining = maximum,
            HullDamage = models.Sum(item => item.gameObject.activeSelf ? item.GetWounds() : Attribute(item, "HP")) };
        states.Add(unit, state);
        Read(state);
        CreateDisplay(state);
        return state;
    }

    public static bool Damage(InputManager input) => Change(input, false);
    public static bool Heal(InputManager input) => Change(input, true);

    private static bool Change(InputManager input, bool heal)
    {
        var selected = input.GetCurrentSelection();
        if (selected.Count != 1 || !selected[0].IsMine()) return false;
        var unit = selected[0] as Unit ?? (selected[0] as Soldier)?.GetParentUnit();
        var state = Get(unit);
        if (state == null) return false;
        Read(state);
        int shields = state.Remaining, damage = state.HullDamage;
        var target = unit.GetMostWoundedOrRandomSoldier();
        bool hull = heal ? damage > 0 : shields == 0;
        if ((!heal && hull && target == null) || (heal && !hull && shields == state.Maximum)) return true;
        var next = ShieldPool.Step(state.Maximum, shields, damage, heal);
        int afterShields = next.shields, afterDamage = next.damage;
        var undo = input.GetUndoRedo();
        undo.StartGroup();
        try
        {
            undo.UndoAdd(new ShieldAction(state, shields, damage, afterShields, afterDamage));
            Set(state, afterShields, afterDamage);
            if (hull)
            {
                if (!heal) target.SendRemoveHealthPoint(undoredo: false, skippingUnit: true);
                else if (target != null && target.IsWounded()) target.SendHealHealthPoint();
                else unit.HealHealthPoint();
            }
        }
        finally { undo.EndGroup(); }
        input.UpdateSelection();
        return true;
    }

    private static void Set(State state, int remaining, int damage)
    {
        if (state.Unit == null) return;
        state.Remaining = remaining;
        state.HullDamage = damage;
        if (PhotonNetwork.InRoom)
        {
            state.Pending = remaining + ":" + damage;
            PhotonNetwork.CurrentRoom.SetCustomProperties(new PhotonHashtable { [state.Key] = state.Pending });
        }
    }

    private static void Read(State state)
    {
        if (!PhotonNetwork.InRoom || !PhotonNetwork.CurrentRoom.CustomProperties.TryGetValue(state.Key, out var raw)) return;
        if (state.Pending != null)
        {
            if ((raw as string) != state.Pending) return;
            state.Pending = null;
        }
        var values = (raw as string)?.Split(':');
        if (values?.Length == 2 && int.TryParse(values[0], out var shields) && int.TryParse(values[1], out var damage))
        {
            state.Remaining = Mathf.Clamp(shields, 0, state.Maximum);
            state.HullDamage = Mathf.Max(0, damage);
        }
    }

    private sealed class ShieldAction : UserAction
    {
        private readonly State state;
        private readonly int before, beforeDamage, after, afterDamage;
        public ShieldAction(State state, int before, int beforeDamage, int after, int afterDamage)
        { this.state = state; this.before = before; this.beforeDamage = beforeDamage; this.after = after; this.afterDamage = afterDamage; }
        public override void UndoExe() => Set(state, before, beforeDamage);
        public override void RedoExe() => Set(state, after, afterDamage);
        public override string ToText() => "^O^Shield / wound change";
    }

    public static void Tick()
    {
        if (Time.unscaledTime >= nextScan)
        {
            nextScan = Time.unscaledTime + 1;
            foreach (var unit in UnityEngine.Object.FindObjectsByType<Unit>(FindObjectsSortMode.None)) Get(unit);
            foreach (var dead in states.Keys.Where(unit => unit == null).ToList())
            { UnityEngine.Object.Destroy(states[dead].Root); states.Remove(dead); }
        }
        var camera = Camera.main;
        foreach (var state in states.Values)
        {
            Read(state);
            var activeModels = state.Unit.GetAllActiveSoldiers();
            bool visible = state.Remaining > 0 && state.Unit.gameObject.activeInHierarchy && activeModels.Count > 0;
            state.Root.SetActive(visible);
            if (!visible) continue;
            var billboard = state.Unit._billboard;
            // The unit transform is recentered after a drag. Use the live model positions
            // so the shared shield display follows the squad throughout the gesture.
            var center = Vector3.zero;
            foreach (var model in activeModels) center += model.transform.position;
            center /= activeModels.Count;
            var offset = billboard != null
                ? billboard.transform.position - state.Unit.transform.position
                : Vector3.up * 6;
            state.Root.transform.position = center + offset;
            if (camera != null) state.Root.transform.rotation = camera.transform.rotation;
            state.Number.text = state.Remaining.ToString();
            MatchWoundDisplay(state, billboard);
        }
    }

    private static void CreateDisplay(State state)
    {
        state.Root = new GameObject("Starcraft unit shields", typeof(RectTransform), typeof(Canvas));
        state.Root.GetComponent<Canvas>().renderMode = RenderMode.WorldSpace;
        state.Root.transform.localScale = Vector3.one * 0.065f;
        ((RectTransform)state.Root.transform).sizeDelta = new Vector2(120, 48);
        var image = new GameObject("Shield", typeof(RectTransform), typeof(Image));
        image.transform.SetParent(state.Root.transform, false);
        var rect = (RectTransform)image.transform;
        state.Symbol = rect;
        rect.sizeDelta = new Vector2(44, 44); rect.anchoredPosition = new Vector2(-22, 0);
        image.GetComponent<Image>().sprite = Icon(); image.GetComponent<Image>().raycastTarget = false;
        var number = new GameObject("Remaining shields", typeof(RectTransform), typeof(Text));
        number.transform.SetParent(state.Root.transform, false);
        rect = (RectTransform)number.transform; rect.pivot = new Vector2(0, .5f);
        rect.sizeDelta = new Vector2(100, 80); rect.anchoredPosition = new Vector2(10, 0);
        state.Number = number.GetComponent<Text>(); state.Number.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
        state.Number.fontSize = 40; state.Number.fontStyle = FontStyle.Bold; state.Number.color = Blue;
        state.Number.alignment = TextAnchor.MiddleLeft; state.Number.raycastTarget = false;
    }

    private static readonly System.Reflection.FieldInfo woundText = typeof(BillboardController)
        .GetField("_skullText", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);

    private static void MatchWoundDisplay(State state, BillboardController billboard)
    {
        if (billboard == null) return;
        var text = woundText?.GetValue(billboard) as Component;
        var mesh = text != null ? text.GetComponent<MeshFilter>()?.sharedMesh : null;
        if (mesh == null || mesh.bounds.size.y <= 0) return;
        float textHeight = mesh.bounds.size.y * Mathf.Abs(text.transform.lossyScale.y);
        state.Number.font.RequestCharactersInTexture("0123456789", state.Number.fontSize, state.Number.fontStyle);
        if (!state.Number.font.GetCharacterInfo('0', out var glyph, state.Number.fontSize, state.Number.fontStyle) || glyph.glyphHeight <= 0) return;
        float scale = textHeight / glyph.glyphHeight;
        state.Root.transform.localScale = Vector3.one * scale;
        var skull = billboard.GetSkull();
        var renderer = skull != null ? skull.GetComponentsInChildren<Renderer>(true)
            .FirstOrDefault(item => item.GetComponent<MeshFilter>()?.sharedMesh != null) : null;
        float symbolHeight = textHeight;
        float gap = textHeight * .25f;
        if (renderer != null)
        {
            var bounds = renderer.GetComponent<MeshFilter>().sharedMesh.bounds;
            symbolHeight = bounds.size.y * Mathf.Abs(renderer.transform.lossyScale.y);
            var iconEdge = renderer.transform.TransformPoint(new Vector3(bounds.max.x, bounds.center.y, bounds.center.z));
            var textEdge = text.transform.TransformPoint(new Vector3(mesh.bounds.min.x, mesh.bounds.center.y, mesh.bounds.center.z));
            float measuredGap = Vector3.Dot(textEdge - iconEdge, billboard.transform.right);
            if (measuredGap >= 0 && measuredGap < textHeight) gap = measuredGap;
        }
        float size = symbolHeight / scale;
        state.Symbol.sizeDelta = new Vector2(size, size);
        state.Symbol.anchoredPosition = new Vector2(-size / 2, 0);
        ((RectTransform)state.Number.transform).anchoredPosition = new Vector2(gap / scale - glyph.minX, 0);
    }

    private static bool InsideShield(float x, float y, float inset)
    {
        float scale = (53 - inset) / 53;
        x /= scale;
        y = 64 + (y - 64) / scale;
        if (x > 50 || y < 9 || y > 119) return false;
        float top = 9 + 17 * (1 - Mathf.Pow(1 - x / 50, 2));
        float bottom = 64 + 55 * Mathf.Sqrt(Mathf.Max(0, 1 - x * x / 2500));
        return y >= top && y <= bottom;
    }

    private static Sprite Icon()
    {
        if (icon != null) return icon;
        var texture = new Texture2D(128, 128, TextureFormat.RGBA32, false);
        var pixels = new Color[128 * 128];
        for (int y = 0; y < 128; y++) for (int x = 0; x < 128; x++)
        {
            float dx = Mathf.Abs(x - 63.5f), yFromTop = 127 - y;
            bool outer = InsideShield(dx, yFromTop, 0);
            bool inner = InsideShield(dx, yFromTop, 7);
            pixels[y * 128 + x] = !outer ? Color.clear : inner ? Blue : Color.white;
        }
        texture.SetPixels(pixels); texture.Apply();
        icon = Sprite.Create(texture, new Rect(0, 0, 128, 128), new Vector2(.5f, .5f));
        return icon;
    }
}

public static class ShieldPool
{
    public static (int shields, int damage) Step(int maximum, int shields, int damage, bool heal)
    {
        if (heal) return damage > 0 ? (shields, damage - 1) : (Math.Min(maximum, shields + 1), 0);
        return shields > 0 ? (shields - 1, damage) : (0, damage + 1);
    }
}
