using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;

public static class StarcraftScoreboard
{
    private static readonly Dictionary<TerrainItem, Board> boards = new();
    private static float nextScan;
    private static Font font;

    private const string ScoreboardId = "Starcraft - Terrain - Scoreboard - score1";

    public static bool Configure(TerrainItem terrain, string id, string owner)
    {
        if (id != ScoreboardId) return false;
        terrain.WDSID = id;
        terrain.name = "Scoreboard";
        terrain.Owner = owner;
        Debug.Log("[StarcraftScoreboard] Using local interactive board; no skin required.");
        return true;
    }

    public static bool Tick()
    {
        if (Time.unscaledTime >= nextScan)
        {
            nextScan = Time.unscaledTime + 1f;
            foreach (var key in boards.Keys.Where(key => key == null).ToList())
            {
                UnityEngine.Object.Destroy(boards[key].Root);
                boards.Remove(key);
            }
            foreach (var terrain in UnityEngine.Object.FindObjectsByType<TerrainItem>(FindObjectsSortMode.None))
            {
                if (terrain.WDSID != ScoreboardId || boards.ContainsKey(terrain))
                    continue;
                var bounds = new Bounds(terrain.transform.position, new Vector3(18.2f, 0.12f, 73.15f));
                boards.Add(terrain, new Board(terrain, bounds));
                Debug.Log("[StarcraftScoreboard] Interactive board created at " + terrain.transform.position);
            }
            foreach (var pair in boards)
            {
                if (pair.Key == null || !pair.Key.gameObject.activeInHierarchy) continue;
                var edge = Mathf.Abs(pair.Key.transform.position.x) - 11.1f;
                StarcraftTray.Arrange(edge, pair.Key.transform.position.z);
            }
        }
        foreach (var pair in boards)
        {
            if (pair.Key == null || !pair.Key.gameObject.activeInHierarchy) continue;
            var board = pair.Value;
            foreach (var renderer in pair.Key.GetComponentsInChildren<Renderer>()) renderer.enabled = false;
            foreach (var collider in pair.Key.GetComponentsInChildren<Collider>()) collider.enabled = false;
            board.Root.SetActive(true);
            board.Position(pair.Key);
            if (!board.Hit(out var point)) continue;
            if (Input.GetMouseButtonDown(0)) board.Click(point, 1);
            if (Input.GetMouseButtonDown(1)) board.Click(point, -1);
            if (Input.GetMouseButton(0) || Input.GetMouseButton(1) ||
                Input.GetMouseButtonUp(0) || Input.GetMouseButtonUp(1))
            {
                var input = UnityEngine.Object.FindFirstObjectByType<InputManager>();
                if (input != null) input.CameraScrollInputAllowed = false;
                return true;
            }
        }
        return false;
    }

    private sealed class Board
    {
        public readonly GameObject Root;
        private readonly List<(Rect rect, Action<int> change)> cells = new();
        private readonly int[,,] points = new int[2, 5, 2];
        private readonly int[] current = new int[2];
        private int global = 6;
        private bool swapped;
        private bool recordingColors;
        private readonly List<(Graphic graphic, Color original)> playerGraphics = new();
        private readonly Text[] totals = new Text[2];
        private readonly Text[] supplies = new Text[2];
        private Text globalText;
        private readonly Text[,,] values = new Text[2, 5, 2];
        private static readonly Color Blue = new(0.18f, 0.73f, 0.94f);
        private static readonly Color Red = new(1f, 0.3f, 0.32f);
        private static readonly Color White = new(0.9f, 0.95f, 1f);

        public Board(TerrainItem terrain, Bounds old)
        {
            Root = new GameObject("Starcraft Interactive Scoreboard", typeof(RectTransform), typeof(Canvas));
            Root.transform.SetParent(terrain.transform, true);
            Root.transform.position = new Vector3(-Mathf.Abs(old.center.x) - 6.5f, 0.2f, old.center.z);
            Root.transform.rotation = Quaternion.Euler(90, -90, 0);
            Root.transform.localScale = Vector3.one * 0.04f;
            var rect = (RectTransform)Root.transform;
            rect.sizeDelta = new Vector2(1000, 710);
            Root.GetComponent<Canvas>().renderMode = RenderMode.WorldSpace;
            if (font == null) font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            Panel(new Rect(0, 0, 1000, 710), new Color(0.035f, 0.065f, 0.09f), Blue);
            for (var player = 0; player < 2; player++)
            {
                var p = player;
                recordingColors = true;
                var ink = p == 0 ? Blue : Red;
                var x = p == 0 ? 20 : 560;
                totals[p] = Label(new Rect(x, 12, 420, 108), "0", 92, ink);
                Panel(new Rect(x, 132, 420, 100), new Color(0.06f, 0.09f, 0.13f), ink);
                Label(new Rect(x, 134, 420, 27), "CURRENT SUPPLY", 23, ink);
                supplies[p] = Label(new Rect(x, 161, 420, 65), "0 / 6", 49, White);
                cells.Add((new Rect(x, 132, 420, 100), delta => { current[p] = Math.Max(0, current[p] + delta); Refresh(); }));
                for (var column = 0; column < 2; column++)
                {
                    var c = column;
                    var colX = x + column * 210;
                    Label(new Rect(colX, 250, 205, 46), column == 0 ? "Supply" : "Mission", 30, ink);
                    for (var round = 0; round < 5; round++)
                    {
                        var r = round;
                        var area = new Rect(colX, 302 + (4 - round) * 79, 205, 73);
                        Panel(area, p == 0 ? new Color(0.055f, 0.12f, 0.18f) : new Color(0.17f, 0.065f, 0.085f), ink);
                        values[p, r, c] = Label(area, "0", 45, White);
                        cells.Add((area, delta => { points[p, r, c] = Math.Max(0, points[p, r, c] + delta); Refresh(); }));
                    }
                }
            }
            recordingColors = false;
            var swapArea = new Rect(450, 38, 100, 60);
            Panel(swapArea, new Color(0.08f, 0.1f, 0.13f), White);
            Label(swapArea, "← →", 32, White);
            cells.Add((swapArea, delta => { if (delta > 0) SwapColors(); }));
            Panel(new Rect(450, 132, 100, 100), new Color(0.08f, 0.1f, 0.13f), White);
            Label(new Rect(452, 135, 96, 43), "GLOBAL\nSUPPLY", 17, White);
            globalText = Label(new Rect(450, 177, 100, 50), "6", 40, White);
            cells.Add((new Rect(450, 132, 100, 100), delta => { global = Math.Max(0, global + delta); Refresh(); }));
            Label(new Rect(440, 250, 120, 46), "ROUND", 23, White);
            for (var round = 0; round < 5; round++)
                Label(new Rect(440, 302 + (4 - round) * 79, 120, 73), (round + 1).ToString(), 40, White);
        }

        public void Position(TerrainItem terrain)
        {
            Root.transform.position = new Vector3(-Mathf.Abs(terrain.transform.position.x) - 6.5f, 0.2f, terrain.transform.position.z);
            Root.transform.rotation = Quaternion.Euler(90, -90, 0);
        }

        private void SwapColors()
        {
            swapped = !swapped;
            var blueFill = new Color(0.055f, 0.12f, 0.18f);
            var redFill = new Color(0.17f, 0.065f, 0.085f);
            foreach (var entry in playerGraphics)
            {
                var color = entry.original;
                if (swapped)
                {
                    if (color == Blue) color = Red;
                    else if (color == Red) color = Blue;
                    else if (color == blueFill) color = redFill;
                    else if (color == redFill) color = blueFill;
                }
                entry.graphic.color = color;
            }
        }

        private void RecordColor(Graphic graphic)
        {
            if (recordingColors) playerGraphics.Add((graphic, graphic.color));
        }

        private void Refresh()
        {
            globalText.text = global.ToString();
            for (var p = 0; p < 2; p++)
            {
                var sum = 0;
                for (var r = 0; r < 5; r++)
                    for (var c = 0; c < 2; c++)
                    {
                        sum += points[p, r, c];
                        values[p, r, c].text = points[p, r, c].ToString();
                    }
                totals[p].text = sum.ToString();
                supplies[p].text = current[p] + " / " + global;
            }
        }

        public bool Hit(out Vector2 point)
        {
            point = default;
            var camera = Camera.main;
            if (camera == null) return false;
            var ray = camera.ScreenPointToRay(Input.mousePosition);
            var plane = new Plane(Root.transform.forward, Root.transform.position);
            if (!plane.Raycast(ray, out var distance)) return false;
            var local = Root.transform.InverseTransformPoint(ray.GetPoint(distance));
            point = new Vector2(local.x + 500, 355 - local.y);
            return new Rect(0, 0, 1000, 710).Contains(point);
        }

        public void Click(Vector2 point, int delta)
        {
            foreach (var cell in cells)
                if (cell.rect.Contains(point)) { cell.change(delta); break; }
        }

        private RectTransform Element(string name, Rect area)
        {
            var obj = new GameObject(name, typeof(RectTransform));
            obj.transform.SetParent(Root.transform, false);
            var rect = (RectTransform)obj.transform;
            rect.anchorMin = rect.anchorMax = new Vector2(0, 1);
            rect.pivot = new Vector2(0, 1);
            rect.anchoredPosition = new Vector2(area.x, -area.y);
            rect.sizeDelta = area.size;
            return rect;
        }

        private void Panel(Rect area, Color fill, Color border)
        {
            var outer = Element("Border", area).gameObject.AddComponent<Image>();
            outer.color = border;
            outer.raycastTarget = false;
            RecordColor(outer);
            var inner = Element("Panel", new Rect(area.x + 2, area.y + 2, area.width - 4, area.height - 4)).gameObject.AddComponent<Image>();
            inner.color = fill;
            inner.raycastTarget = false;
            RecordColor(inner);
        }

        private Text Label(Rect area, string value, int size, Color ink)
        {
            var text = Element("Scoreboard " + value, area).gameObject.AddComponent<Text>();
            text.font = font;
            text.fontSize = size;
            text.fontStyle = FontStyle.Bold;
            text.alignment = TextAnchor.MiddleCenter;
            text.color = ink;
            text.text = value;
            RecordColor(text);
            text.raycastTarget = false;
            text.horizontalOverflow = HorizontalWrapMode.Overflow;
            text.verticalOverflow = VerticalWrapMode.Overflow;
            return text;
        }
    }
}
