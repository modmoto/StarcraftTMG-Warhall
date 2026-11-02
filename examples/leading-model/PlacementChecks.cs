// Standalone console checks; exclude this file when copying the planner to Unity.
using System;
using System.Numerics;
using Starcraft.Warhall.Examples;

public static class PlacementChecks
{
    private static void Check(bool value, string message)
    {
        if (!value) throw new Exception(message);
    }

    public static void Main()
    {
        var before = new Vector2[18];
        for (int i = 0; i < before.Length; i++) before[i] = new Vector2(-300 - i * 35, 0);
        var original = (Vector2[])before.Clone();
        var plan = LeadingModelPlacement.Build(before, 0, Vector2.Zero, 32, 101.6f, true, Vector2.UnitX);
        Check(plan.Ordered.Count == 18 && plan.Ordered[0].Order == 0, "Count/leader");
        Check(plan.After[0] == Vector2.Zero, "Leader destination");
        var identities = new System.Collections.Generic.HashSet<int>();
        for (int i = 0; i < 18; i++)
        {
            Check(before[i] == original[i] && plan.Before[i] == original[i], "Snapshot changed");
            Check(plan.Ordered[i].Order == i, "Numbering");
            Check(identities.Add(plan.Ordered[i].ModelIndex), "Duplicate identity");
            Check(plan.After[i].Length() <= 101.601f, "Outside coherency");
            for (int j = 0; j < i; j++)
                Check(Vector2.Distance(plan.After[i], plan.After[j]) >= 31.999f, "Overlapping bases");
        }
        Check(Vector2.Distance(plan.Ordered[1].Position, new Vector2(101.6f, 0)) < .001f, "Front slot");
        for (int i = 1; i <= 9; i++) Check(Math.Abs(plan.Ordered[i].Position.Length() - 101.6f) < .001f, "Outer arc first");
        Check(plan.Ordered[2].Position.Y > 0 && plan.Ordered[3].Position.Y < 0, "Left/right order");
        var again = LeadingModelPlacement.Build(before, 0, Vector2.Zero, 32, 101.6f, true, Vector2.UnitX);
        for (int i = 0; i < 18; i++) Check(again.After[i] == plan.After[i], "Nondeterministic plan");

        var rotated = new Vector2[18];
        for (int i = 0; i < 18; i++) rotated[i] = new Vector2(-before[i].Y, before[i].X);
        var turned = LeadingModelPlacement.Build(rotated, 0, Vector2.Zero, 32, 101.6f, true, Vector2.UnitY);
        for (int i = 0; i < 18; i++)
            Check(Vector2.Distance(turned.Ordered[i].Position, new Vector2(-plan.Ordered[i].Position.Y, plan.Ordered[i].Position.X)) < .001f, "Rotation invariance");
        Check(LeadingModelPlacement.ClosestModel(before, Vector2.Zero) == 0, "Closest leader");
        bool blocked = false;
        try { LeadingModelPlacement.Build(before, 0, Vector2.Zero, 32, 101.6f, true, Vector2.UnitX, (p,r) => p.LengthSquared() < 1); }
        catch (InvalidOperationException) { blocked = true; }
        Check(blocked, "Blocked placement must fail");
        for (int i = 0; i < 18; i++) Check(before[i] == original[i], "Failure changed unit");
        var edge = LeadingModelPlacement.Build(before, 0, Vector2.Zero, 32, 101.6f, false, Vector2.UnitX);
        Check(Math.Abs(edge.Ordered[1].Position.Length() - 133.6f) < .001f, "Any-part measurement");
        Console.WriteLine("PASS: count, numbering, snapshot, circular rank, spacing, direction, determinism, rotation, blocked rollback, measurement modes");
    }
}
