using System;
using System.Collections.Generic;
using System.Linq;
using Photon.Pun;
using Photon.Realtime;
using PhotonHashtable = ExitGames.Client.Photon.Hashtable;
using System.Globalization;
using UnityEngine;
using UnityEngine.UI;

public static class StarcraftScoreboard
{
    private static readonly Dictionary<TerrainItem, Board> boards = new();
    private static float nextScan;
    private static Font font;

    private const string ScoreboardId = "Starcraft - Terrain - Scoreboard - score1";

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
        }
        foreach (var pair in boards)
        {
            if (pair.Key == null || !pair.Key.gameObject.activeInHierarchy) continue;
            var board = pair.Value;
            board.Root.SetActive(true);
            board.Position(pair.Key);
            board.UpdateState();
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
        private readonly List<(Rect rect, int field)> cells = new();
        private readonly ScoreboardNetwork network;
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
            network = new ScoreboardNetwork(terrain.GetComponent<PhotonView>());
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
                cells.Add((new Rect(x, 132, 420, 100), 20 + p));
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
                        cells.Add((area, p * 10 + r * 2 + c));
                    }
                }
            }
            recordingColors = false;
            var swapArea = new Rect(450, 38, 100, 60);
            Panel(swapArea, new Color(0.08f, 0.1f, 0.13f), White);
            Label(swapArea, "← →", 32, White);
            cells.Add((swapArea, 23));
            Panel(new Rect(450, 132, 100, 100), new Color(0.08f, 0.1f, 0.13f), White);
            Label(new Rect(452, 135, 96, 43), "GLOBAL\nSUPPLY", 17, White);
            globalText = Label(new Rect(450, 177, 100, 50), "6", 40, White);
            cells.Add((new Rect(450, 132, 100, 100), 22));
            Label(new Rect(440, 250, 120, 46), "ROUND", 23, White);
            for (var round = 0; round < 5; round++)
                Label(new Rect(440, 302 + (4 - round) * 79, 120, 73), (round + 1).ToString(), 40, White);
        }

        public void Position(TerrainItem terrain)
        {
            Root.transform.position = new Vector3(-Mathf.Abs(terrain.transform.position.x) - 6.5f, 0.2f, terrain.transform.position.z);
            Root.transform.rotation = Quaternion.Euler(90, -90, 0);
        }

        public void UpdateState()
        {
            if (network.Tick()) Refresh();
        }

        private void ApplyColors()
        {
            var swapped = network.State.Values[23] != 0;
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
            var state = network.State;
            globalText.text = state.Values[22].ToString();
            ApplyColors();
            for (var p = 0; p < 2; p++)
            {
                var sum = 0;
                for (var r = 0; r < 5; r++)
                    for (var c = 0; c < 2; c++)
                    {
                        sum += state.Values[p * 10 + r * 2 + c];
                        values[p, r, c].text = state.Values[p * 10 + r * 2 + c].ToString();
                    }
                totals[p].text = sum.ToString();
                supplies[p].text = state.Values[20 + p] + " / " + state.Values[22];
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
            var controller = UnityEngine.Object.FindFirstObjectByType<GameController>();
            if (controller != null && controller.IsLocalPlayerObserver) return;
            foreach (var cell in cells)
                if (cell.rect.Contains(point))
                {
                    if (cell.field == 23 && delta < 0) return;
                    network.Change(cell.field, delta);
                    Refresh();
                    break;
                }
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

    public sealed class ScoreboardState
    {
        public readonly int[] Values;
        public readonly long Revision;

        public ScoreboardState()
        {
            Values = new int[24];
            Values[22] = 6;
        }

        private ScoreboardState(int[] values, long revision)
        {
            Values = values;
            Revision = revision;
        }

        public ScoreboardState Change(int field, int delta)
        {
            if (field < 0 || field >= 24 || (delta != 1 && delta != -1))
                throw new ArgumentOutOfRangeException();
            var values = (int[])Values.Clone();
            values[field] = field == 23 ? 1 - values[field] :
                (int)Math.Max(0L, Math.Min(1000000L, (long)values[field] + delta));
            return new ScoreboardState(values, checked(Revision + 1));
        }

        public string Encode() => Revision.ToString(CultureInfo.InvariantCulture) + ":" +
            string.Join(",", Values.Select(value => value.ToString(CultureInfo.InvariantCulture)));

        public static bool TryDecode(string encoded, out ScoreboardState state)
        {
            state = null;
            if (string.IsNullOrEmpty(encoded) || encoded.Length > 256) return false;
            var parts = encoded.Split(':');
            if (parts.Length != 2 || !long.TryParse(parts[0], NumberStyles.None,
                CultureInfo.InvariantCulture, out var revision) || revision < 0) return false;
            var fields = parts[1].Split(',');
            if (fields.Length != 24) return false;
            var values = new int[24];
            for (var i = 0; i < values.Length; i++)
                if (!int.TryParse(fields[i], NumberStyles.None, CultureInfo.InvariantCulture,
                    out values[i]) || values[i] < 0 || values[i] > (i == 23 ? 1 : 1000000))
                    return false;
            state = new ScoreboardState(values, revision);
            return true;
        }
    }

    private sealed class ScoreboardNetwork
    {
        private readonly PhotonView view;
        private readonly string clientId = Guid.NewGuid().ToString("N");
        private readonly Queue<(int sequence, int field, int delta)> pending = new();
        private Room room;
        private string key;
        private string acknowledgementKey;
        private string observed;
        private int sequence;
        private float retryAt;
        private float initializeAt;
        private bool wasOnline;
        public ScoreboardState State { get; private set; } = new();

        public ScoreboardNetwork(PhotonView view) => this.view = view;

        public void Change(int field, int delta)
        {
            if (!PhotonNetwork.InRoom || PhotonNetwork.OfflineMode)
            {
                if (!wasOnline) State = State.Change(field, delta);
                return;
            }
            pending.Enqueue((++sequence, field, delta));
        }

        public bool Tick()
        {
            if (!PhotonNetwork.InRoom || PhotonNetwork.OfflineMode) return false;
            if (view == null || view.ViewID <= 0) return false;
            var currentRoom = PhotonNetwork.CurrentRoom;
            if (!ReferenceEquals(room, currentRoom))
            {
                room = currentRoom;
                key = "sc.scoreboard.v1." + view.ViewID;
                acknowledgementKey = key + ".ack." + clientId;
                observed = null;
                retryAt = initializeAt = 0;
                if (wasOnline) pending.Clear();
                wasOnline = true;
            }
            var properties = room.CustomProperties;
            var raw = properties[key] as string;
            if (raw == null)
            {
                if (PhotonNetwork.IsMasterClient && Time.unscaledTime >= initializeAt)
                {
                    initializeAt = Time.unscaledTime + 1f;
                    room.SetCustomProperties(new PhotonHashtable { [key] = new ScoreboardState().Encode() });
                }
                return false;
            }
            if (!ScoreboardState.TryDecode(raw, out var received)) return false;
            var changed = raw != observed;
            if (changed)
            {
                State = received;
                observed = raw;
            }
            var acknowledged = properties[acknowledgementKey] is int ack ? ack : 0;
            while (pending.Count > 0 && pending.Peek().sequence <= acknowledged)
            {
                pending.Dequeue();
                retryAt = 0;
            }
            if (pending.Count > 0 && Time.unscaledTime >= retryAt)
            {
                var command = pending.Peek();
                var next = State.Change(command.field, command.delta);
                retryAt = Time.unscaledTime + 0.75f;
                room.SetCustomProperties(
                    new PhotonHashtable { [key] = next.Encode(), [acknowledgementKey] = command.sequence },
                    new PhotonHashtable { [key] = raw });
            }
            return changed;
        }
    }

}
