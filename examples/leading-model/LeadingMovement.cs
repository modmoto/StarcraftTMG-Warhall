using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

public static class LeadingMovement
{
    private static Soldier clicked;
    private static Soldier leader;
    private static Soldier hovered;
    private static Soldier rightDrag;
    private static Soldier pendingDrag;
    private static Unit selectionAfterDrag;
    private static Vector3 rightStart;
    private static Quaternion rightRotation;
    private static Vector3 rightOffset;
    private static UndoRedo rightUndo;

    public static void Hover(GameItem item) => hovered = item as Soldier;
    public static void Leave(GameItem item)
    {
        if (hovered == item) hovered = null;
    }
    public static void AfterInput(InputManager input)
    {
        if (rightDrag != null) input.CameraScrollInputAllowed = false;
        if (Input.GetMouseButtonUp(0)) pendingDrag = null;
        if (selectionAfterDrag == null || rightDrag != null) return;
        var unit = selectionAfterDrag;
        selectionAfterDrag = null;
        input.ForceSingleSeletion(unit);
        if (leader != null && leader.GetParentUnit() == unit)
        {
            unit.ShowShapeDrawer(false);
            leader.SetShapeDrawer(LeaderRangeInches(leader));
            leader.ShowShapeDrawer(true);
        }
    }

    public static GameItem SelectionTarget(GameItem item)
    {
        if (item is Soldier model && model.GetParentUnit() != null &&
            model.GetParentUnit().Formation is Cloud)
            return model.GetParentUnit();
        return item;
    }

    public static bool RequestDrag(Soldier model)
    {
        if (!Eligible(model)) return false;
        pendingDrag = model;
        UnityEngine.Object.FindFirstObjectByType<InputManager>().MouseDrag(model);
        return true;
    }

    public static void PrepareSingleDrag(InputManager input)
    {
        if (!Eligible(pendingDrag)) return;
        var model = pendingDrag;
        pendingDrag = null;
        input.ForceSingleSeletion(model);
        input.MouseDrag(model);
    }

    private static bool Eligible(Soldier model) => model != null && model.IsMine() &&
        model.GetParentUnit() != null && model.GetParentUnit().Formation is Cloud && !model.SoldierMagnet;

    private static void SetLeader(Soldier model)
    {
        if (leader != null) leader.ShowShapeDrawer(false);
        leader = model;
        if (leader == null) return;
        leader.GetParentUnit().ShowShapeDrawer(false);
        leader.ShowShapeDrawer(true);
        leader.SetShapeDrawer(LeaderRangeInches(leader));
        leader.ShowShapeDrawer(true);
    }

    private static void EndRightDrag(bool cancel)
    {
        var model = rightDrag;
        var undo = rightUndo;
        rightDrag = null;
        rightUndo = null;
        try
        {
            if (model == null) return;
            if (cancel)
            {
                model.Move(rightStart);
                model.transform.rotation = rightRotation;
                dragging = false;
            }
            model.EndDrag();
            var unit = model.GetParentUnit();
            if (unit != null && unit.Formation is Cloud)
            {
                unit.RecalculateCenterFromSoldiers();
                unit.SyncRecalculateCenter();
            }
            if (!cancel) undo.UndoAdd(new ActionMove(model, rightStart, model.transform.position));
        }
        finally { if (undo != null) undo.EndGroup(); }
    }

    private static Vector3 start;
    private static bool dragging;
    private static float LeaderRangeInches(Soldier model)
    {
        var rules = model.GetLogic().GetRules()
            .Concat(model.GetParentUnit().GetLogic().GetRules());
        return rules.Any(rule =>
            System.Text.RegularExpressions.Regex.IsMatch(rule.Name ?? "", @"\bSquadron\b",
                System.Text.RegularExpressions.RegexOptions.IgnoreCase) ||
            System.Text.RegularExpressions.Regex.IsMatch(rule.Id ?? "", @"(?:^|_)squadron(?:_|$)",
                System.Text.RegularExpressions.RegexOptions.IgnoreCase)) ? 4f : 3f;
    }

    private sealed class UnitSnapshot
    {
        public Unit Unit;
        public Vector3 Position;
        public Quaternion Rotation;
        public Soldier Leader;
        public bool LeaderRecorded;
        public List<(Soldier model, Vector3 position, Quaternion rotation)> Models;
    }
    private static readonly Dictionary<CornerMarker, UnitSnapshot> snapshots = new();

    public static void CaptureMarker(CornerMarker marker)
    {
        var unit = marker.GetReferenceUnit();
        if (unit == null || !(unit.Formation is Cloud)) return;
        foreach (var key in snapshots.Keys.Where(key => key == null || snapshots[key].Unit == unit).ToList())
            snapshots.Remove(key);
        snapshots[marker] = new UnitSnapshot
        {
            Unit = unit,
            Position = unit.transform.position,
            Rotation = unit.transform.rotation,
            Leader = leader != null && leader.GetParentUnit() == unit ? leader : null,
            LeaderRecorded = leader != null && leader.GetParentUnit() == unit,
            Models = unit.GetAllActiveSoldiers().Select(model =>
                (model, model.transform.position, model.transform.rotation)).ToList(),
        };
    }

    public static bool RestoreMarker(CornerMarker marker)
    {
        if (!marker.IsMine() || !snapshots.TryGetValue(marker, out var snapshot)) return false;
        var unit = snapshot.Unit;
        if (unit == null || !(unit.Formation is Cloud)) return false;
        var undo = GameObject.FindGameObjectWithTag("GameController").GetComponent<UndoRedo>();
        undo.StartGroup();
        try
        {
            undo.UndoAdd(new ActionMove(unit, unit.transform.position, snapshot.Position));
            undo.UndoAdd(new ActionRotate(unit, unit.transform.rotation, snapshot.Rotation));
            unit.Move(snapshot.Position);
            unit.transform.rotation = snapshot.Rotation;
            foreach (var saved in snapshot.Models)
            {
                if (saved.model == null || saved.model.GetParentUnit() != unit) continue;
                undo.UndoAdd(new ActionMove(saved.model, saved.model.transform.position, saved.position));
                undo.UndoAdd(new ActionRotate(saved.model, saved.model.transform.rotation, saved.rotation));
                saved.model.Move(saved.position);
                saved.model.transform.rotation = saved.rotation;
                unit.SyncSoldierLocalTransform(saved.model, true, true);
            }
            if (snapshot.Leader != null && snapshot.Leader.GetParentUnit() == unit)
                SetLeader(snapshot.Leader);
            else if (leader != null && leader.GetParentUnit() == unit)
                SetLeader(null);
            dragging = false;
        }
        finally { undo.EndGroup(); }
        Debug.Log("[LeadingMovement] Restored the marker snapshot including all model positions and rotations.");
        return true;
    }

    public static void Click(GameItem item)
    {
        clicked = item as Soldier;
        pendingDrag = null;
    }

    public static void Update()
    {
        var controller = GameObject.FindGameObjectWithTag("GameController");
        if (rightDrag != null)
        {
            if (!Application.isFocused || Input.GetKeyDown(KeyCode.Escape))
            {
                EndRightDrag(true);
                return;
            }
            if (Input.GetMouseButtonUp(1) || !Input.GetMouseButton(1))
            {
                EndRightDrag(false);
                return;
            }
            if (controller != null)
            {
                var ground = controller.GetComponent<GameController>().GetGroundRaycast(true);
                rightDrag.Move(ground + rightOffset);
            }
            return;
        }
        var focused = EventSystem.current?.currentSelectedGameObject;
        if (focused != null && (focused.GetComponent<InputField>() != null ||
            focused.GetComponent("TMP_InputField") != null)) return;
        if (Input.GetMouseButtonDown(1) && Eligible(hovered) && controller != null &&
            !(EventSystem.current != null && EventSystem.current.IsPointerOverGameObject()))
        {
            clicked = hovered;
            SetLeader(hovered);
            var input = UnityEngine.Object.FindFirstObjectByType<InputManager>();
            input.ForceSingleSeletion(leader);
            rightDrag = leader;
            rightStart = leader.transform.position;
            rightRotation = leader.transform.rotation;
            var ground = controller.GetComponent<GameController>().GetGroundRaycast(true);
            rightOffset = rightStart - ground;
            rightUndo = controller.GetComponent<UndoRedo>();
            rightUndo.StartGroup();
            leader.StartDrag(ground);
            return;
        }
        if (!Input.GetKeyDown(KeyCode.L)) return;
        if (clicked != null && clicked == leader) SetLeader(null);
        else if (Eligible(clicked)) SetLeader(clicked);
        Debug.Log(leader == null ? "[LeadingMovement] Leader mode disabled." : "[LeadingMovement] Leader selected.");
    }

    public static void Begin(Soldier model)
    {
        if (model != leader) return;
        foreach (var snapshot in snapshots.Values)
        {
            if (snapshot.Unit == model.GetParentUnit() && !snapshot.LeaderRecorded)
            {
                snapshot.Leader = model;
                snapshot.LeaderRecorded = true;
            }
        }
        start = model.transform.position;
        dragging = true;
    }

    public static void Finish(Soldier model)
    {
        if (Eligible(model)) selectionAfterDrag = model.GetParentUnit();
        if (model != leader || !dragging) return;
        dragging = false;
        var unit = model.GetParentUnit();
        if (unit == null || !(unit.Formation is Cloud) || !model.IsMine()) return;
        var forward = model.transform.position - start;
        forward.y = 0;
        if (forward.sqrMagnitude < 0.0001f) return;
        forward.Normalize();
        var right = new Vector3(forward.z, 0, -forward.x);
        float range = LeaderRangeInches(model) * 2.54f + Radius(model);
        var models = unit.GetAllActiveSoldiers().Where(s => s != model).ToList();
        models.Sort((a, b) => Radius(b).CompareTo(Radius(a)));
        var positions = new List<Vector3> { model.transform.position };
        var radii = new List<float> { Radius(model) };
        var planned = new List<(Soldier model, Vector3 from, Vector3 to)>();
        foreach (var follower in models)
        {
            var radius = Radius(follower);
            bool found = false;
            Vector3 best = default;
            float score = float.NegativeInfinity;
            for (float ahead = range - radius; ahead >= -range + radius; ahead -= 0.15f)
            {
                for (float across = -range + radius; across <= range - radius; across += 0.15f)
                {
                    if (ahead * ahead + across * across > (range - radius) * (range - radius)) continue;
                    var candidate = model.transform.position + forward * ahead + right * across;
                    candidate.y = follower.transform.position.y;
                    float separation = float.PositiveInfinity;
                    bool blocked = false;
                    for (int i = 0; i < positions.Count; i++)
                    {
                        var delta = candidate - positions[i]; delta.y = 0;
                        float gap = delta.magnitude - radius - radii[i];
                        if (gap < 0.02f) { blocked = true; break; }
                        separation = Math.Min(separation, gap);
                    }
                    if (blocked) continue;
                    float candidateScore = ahead * 1000f + separation;
                    if (candidateScore <= score) continue;
                    best = candidate; score = candidateScore; found = true;
                }
            }
            if (!found)
            {
                Debug.LogWarning("[LeadingMovement] Not enough room for every base. Followers stay in place.");
                return;
            }
            positions.Add(best); radii.Add(radius);
            planned.Add((follower, follower.transform.position, best));
        }
        var undo = GameObject.FindGameObjectWithTag("GameController").GetComponent<UndoRedo>();
        foreach (var move in planned)
        {
            move.model.Move(move.to);
            unit.SyncSoldierLocalTransform(move.model, true, true);
            undo.UndoAdd(new ActionMove(move.model, move.from, move.to));
        }
        leader.SetShapeDrawer(LeaderRangeInches(leader));
        leader.ShowShapeDrawer(true);
        Debug.Log($"[LeadingMovement] Repositioned {planned.Count} followers within 3 inches.");
    }

    private static float Radius(Soldier model) => Math.Max(model.Width, model.Length) / 2f;
}
