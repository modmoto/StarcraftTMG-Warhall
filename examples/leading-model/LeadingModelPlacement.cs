using System;
using System.Collections.Generic;
using System.Numerics;

namespace Starcraft.Warhall.Examples
{
    // Pure planning code: X/Y represent tabletop X/Z; all distances are millimetres.
    // No scene objects, physics, networking or transforms are changed here.
    public static class LeadingModelPlacement
    {
        public sealed class Placement
        {
            public int ModelIndex;
            public int Order; // 0 = L; 1..N = numbered placement order.
            public Vector2 Position;
        }

        public sealed class Plan
        {
            public Vector2[] Before;
            public Vector2[] After;
            public List<Placement> Ordered = new List<Placement>();
        }

        // For the sketch: 18 models INCLUDING L, diameter 32, range 4*25.4.
        // whollyWithin=true: the whole follower base must fit inside the ring.
        // false: any part of its base can be within the stated leader-edge distance.
        // The caller must select the game's actual measurement rule explicitly.
        public static Plan Build(
            IReadOnlyList<Vector2> before, int leaderIndex, Vector2 destination,
            float baseDiameterMm, float coherencyMm, bool whollyWithin,
            Vector2 fallbackForward,
            Func<Vector2, float, bool> canPlace = null,
            float radialStepMm = 0.2f, float angularStepDegrees = 0.5f)
        {
            if (before == null || before.Count == 0) throw new ArgumentException("Empty unit");
            if (leaderIndex < 0 || leaderIndex >= before.Count) throw new ArgumentOutOfRangeException(nameof(leaderIndex));
            if (!Finite(destination) || !Finite(fallbackForward)) throw new ArgumentException("Non-finite position/direction");
            if (!Positive(baseDiameterMm) || !Positive(coherencyMm) ||
                !Positive(radialStepMm) || !Positive(angularStepDegrees) || angularStepDegrees > 90)
                throw new ArgumentException("Invalid dimensions or search resolution");
            foreach (var p in before) if (!Finite(p)) throw new ArgumentException("Non-finite old position");

            float radius = baseDiameterMm / 2;
            // Leader and followers have equal circular bases in this example.
            float outer = radius + coherencyMm + (whollyWithin ? -radius : radius);
            var forward = destination - before[leaderIndex];
            if (forward.LengthSquared() < 0.000001f) forward = fallbackForward;
            if (forward.LengthSquared() < 0.000001f) throw new ArgumentException("Supply a direction for a zero-distance move");
            forward = Vector2.Normalize(forward);
            var left = new Vector2(-forward.Y, forward.X);
            if (canPlace != null && !canPlace(destination, radius)) throw new InvalidOperationException("Leader destination blocked");

            var targets = new List<Vector2>();
            int required = before.Count - 1;
            Func<float, float, bool> tryPlace = (distance, angle) =>
            {
                if (targets.Count >= required || distance < baseDiameterMm - 0.0001f) return false;
                var p = destination + distance * ((float)Math.Cos(angle) * forward + (float)Math.Sin(angle) * left);
                foreach (var other in targets)
                    if (Vector2.DistanceSquared(p, other) < baseDiameterMm * baseDiameterMm - 0.001f) return false;
                if (canPlace != null && !canPlace(p, radius)) return false;
                targets.Add(p);
                return true;
            };

            // Exact circular outside rank: front, left, right, left, right...
            if (outer >= baseDiameterMm)
            {
                float step = 2 * (float)Math.Asin(radius / outer);
                for (int k = 0; k * step <= Math.PI / 2 + 0.000001 && targets.Count < required; k++)
                {
                    tryPlace(outer, k * step);
                    if (k > 0) tryPlace(outer, -k * step);
                }
            }

            // Fill gaps inward, keeping the greatest possible radius first.
            // Front half is exhausted before rear-half fallback is considered.
            float angleStep = angularStepDegrees * (float)Math.PI / 180;
            for (int half = 0; half < 2 && targets.Count < required; half++)
            {
                int radialSteps = Math.Max(0, (int)Math.Ceiling((outer - baseDiameterMm) / radialStepMm));
                for (int ring = 0; ring <= radialSteps && targets.Count < required; ring++)
                {
                    float distance = Math.Max(baseDiameterMm, outer - ring * radialStepMm);
                    if (distance > outer) continue;
                    for (int k = 0; k * angleStep <= Math.PI / 2 + 0.000001 && targets.Count < required; k++)
                    {
                        float a = k * angleStep;
                        if (half == 1) a = (float)Math.PI - a;
                        tryPlace(distance, a);
                        if (k > 0 || half == 1) tryPlace(distance, -a);
                    }
                }
            }
            if (targets.Count != required)
                throw new InvalidOperationException("No complete placement found. Keep the original unit or place manually.");

            var plan = new Plan { Before = new Vector2[before.Count], After = new Vector2[before.Count] };
            for (int i = 0; i < before.Count; i++) plan.Before[i] = before[i];
            plan.After[leaderIndex] = destination;
            plan.Ordered.Add(new Placement { ModelIndex = leaderIndex, Order = 0, Position = destination });
            var used = new HashSet<int> { leaderIndex };
            for (int n = 0; n < targets.Count; n++)
            {
                // Stable nearest assignment avoids unnecessary swaps. It does not
                // impose an individual travel limit; validate that separately if required.
                int best = -1;
                float cost = float.PositiveInfinity;
                for (int i = 0; i < before.Count; i++)
                {
                    if (used.Contains(i)) continue;
                    float candidate = Vector2.DistanceSquared(before[i], targets[n]);
                    if (candidate < cost) { best = i; cost = candidate; }
                }
                used.Add(best);
                plan.After[best] = targets[n];
                plan.Ordered.Add(new Placement { ModelIndex = best, Order = n + 1, Position = targets[n] });
            }
            return plan;
        }

        public static int ClosestModel(IReadOnlyList<Vector2> before, Vector2 destination)
        {
            if (before == null || before.Count == 0 || !Finite(destination)) throw new ArgumentException("Invalid unit/destination");
            int best = 0;
            for (int i = 0; i < before.Count; i++)
            {
                if (!Finite(before[i])) throw new ArgumentException("Invalid model position");
                if (Vector2.DistanceSquared(before[i], destination) < Vector2.DistanceSquared(before[best], destination)) best = i;
            }
            return best;
        }

        private static bool Finite(Vector2 p) => Finite(p.X) && Finite(p.Y);
        private static bool Finite(float value) => !float.IsNaN(value) && !float.IsInfinity(value);
        private static bool Positive(float value) => Finite(value) && value > 0;
    }
}
