using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
public static class StarcraftTray
{
    private static readonly Dictionary<Token, string> identities = new();
    private static bool dirty;
    private static readonly (string id, float outward, float z)[] slots = {
        ("Starcraft - Token - Activation - blue - movement", 5.0800f, -40.6400f),
        ("Starcraft - Token - Activation - blue - movement", 8.2550f, -40.6400f),
        ("Starcraft - Token - Activation - blue - movement", 11.4300f, -40.6400f),
        ("Starcraft - Token - Activation - blue - movement", 14.6050f, -40.6400f),
        ("Starcraft - Token - Activation - blue - movement", 17.7800f, -40.6400f),
        ("Starcraft - Token - Activation - red - movement", 20.9550f, -40.6400f),
        ("Starcraft - Token - Activation - red - assault", 5.0800f, -37.4650f),
        ("Starcraft - Token - Activation - red - assault", 8.2550f, -37.4650f),
        ("Starcraft - Token - Activation - red - assault", 11.4300f, -37.4650f),
        ("Starcraft - Token - Activation - red - assault", 14.6050f, -37.4650f),
        ("Starcraft - Token - Activation - red - assault", 17.7800f, -37.4650f),
        ("Starcraft - Token - Activation - blue - assault", 20.9550f, -37.4650f),
        ("Starcraft - Token - Debuff", 5.0800f, -31.1150f),
        ("Starcraft - Token - Buff", 5.0800f, -27.9400f),
        ("Starcraft - Token - Terran - blue", 11.4300f, -31.1150f),
        ("Starcraft - Token - Protoss - yellow", 15.2400f, -31.1150f),
        ("Starcraft - Token - Zerg - purple", 19.0500f, -31.1150f),
        ("Starcraft - Token - Terran - white", 11.4300f, -27.3050f),
        ("Starcraft - Token - Protoss - white", 15.2400f, -27.3050f),
        ("Starcraft - Token - Zerg - white", 19.0500f, -27.3050f),
        ("Starcraft - Token - Stim", 5.0800f, -21.5900f),
        ("Starcraft - Token - Burrowed", 8.2550f, -21.5900f),
        ("Starcraft - Token - Hidden", 11.4300f, -21.5900f),
        ("Starcraft - Token - Siege Status", 14.6050f, -21.5900f),
        ("Starcraft - Token - Bile Bomb", 5.0800f, -18.4150f),
        ("Starcraft - Token - Creep Tumor", 8.2550f, -18.4150f),
        ("Starcraft - Token - Corrosive Bile", 11.4300f, -18.4150f),
        ("Starcraft - Token - Shield", 14.6050f, -18.4150f),
        ("Starcraft - Token - Activation - blue - movement", 5.0800f, 40.6400f),
        ("Starcraft - Token - Activation - blue - movement", 8.2550f, 40.6400f),
        ("Starcraft - Token - Activation - blue - movement", 11.4300f, 40.6400f),
        ("Starcraft - Token - Activation - blue - movement", 14.6050f, 40.6400f),
        ("Starcraft - Token - Activation - blue - movement", 17.7800f, 40.6400f),
        ("Starcraft - Token - Activation - red - movement", 20.9550f, 40.6400f),
        ("Starcraft - Token - Activation - red - assault", 5.0800f, 37.4650f),
        ("Starcraft - Token - Activation - red - assault", 8.2550f, 37.4650f),
        ("Starcraft - Token - Activation - red - assault", 11.4300f, 37.4650f),
        ("Starcraft - Token - Activation - red - assault", 14.6050f, 37.4650f),
        ("Starcraft - Token - Activation - red - assault", 17.7800f, 37.4650f),
        ("Starcraft - Token - Activation - blue - assault", 20.9550f, 37.4650f),
        ("Starcraft - Token - Debuff", 5.0800f, 31.1150f),
        ("Starcraft - Token - Buff", 5.0800f, 27.9400f),
        ("Starcraft - Token - Terran - blue", 11.4300f, 31.1150f),
        ("Starcraft - Token - Protoss - yellow", 15.2400f, 31.1150f),
        ("Starcraft - Token - Zerg - purple", 19.0500f, 31.1150f),
        ("Starcraft - Token - Terran - white", 11.4300f, 27.3050f),
        ("Starcraft - Token - Protoss - white", 15.2400f, 27.3050f),
        ("Starcraft - Token - Zerg - white", 19.0500f, 27.3050f),
        ("Starcraft - Token - Stim", 5.0800f, 21.5900f),
        ("Starcraft - Token - Burrowed", 8.2550f, 21.5900f),
        ("Starcraft - Token - Hidden", 11.4300f, 21.5900f),
        ("Starcraft - Token - Siege Status", 14.6050f, 21.5900f),
        ("Starcraft - Token - Bile Bomb", 5.0800f, 18.4150f),
        ("Starcraft - Token - Creep Tumor", 8.2550f, 18.4150f),
        ("Starcraft - Token - Corrosive Bile", 11.4300f, 18.4150f),
        ("Starcraft - Token - Shield", 14.6050f, 18.4150f)
    };

    public static void Track(Token token, string id)
    {
        if (!id.StartsWith("Starcraft - Token - ")) return;
        identities[token] = id;
        dirty = true;
    }

    public static void Arrange(float edge, float centerZ)
    {
        if (!dirty) return;
        dirty = false;
        foreach (var dead in identities.Keys.Where(t => t == null).ToList()) identities.Remove(dead);
        var available = identities.Keys.Where(t => t != null && t.gameObject.activeInHierarchy &&
            Mathf.Abs(t.transform.position.x) >= edge - 35 &&
            Mathf.Abs(t.transform.position.x) <= edge + 100 &&
            Mathf.Abs(t.transform.position.z - centerZ) >= 10).ToList();
        var used = new HashSet<Token>();
        foreach (var slot in slots)
        {
            var target = new Vector3(-edge - slot.outward, 0, centerZ + slot.z + Mathf.Sign(slot.z) * 6);
            var token = available.Where(t => !used.Contains(t) && identities[t] == slot.id &&
                Mathf.Sign(t.transform.position.z - centerZ) == Mathf.Sign(slot.z))
                .OrderBy(t => (t.transform.position - target).sqrMagnitude).FirstOrDefault();
            if (token == null) continue;
            target.y = token.transform.position.y;
            token.transform.position = target;
            used.Add(token);
        }
        var hidden = 0;
        foreach (var token in available.Where(t => !used.Contains(t)))
        {
            var side = Mathf.Sign(token.transform.position.z - centerZ);
            var id = identities[token];
            var expected = slots.Count(slot => slot.id == id && Mathf.Sign(slot.z) == side);
            var assigned = used.Count(t => identities[t] == id && Mathf.Sign(t.transform.position.z - centerZ) == side);
            if (expected == 0 || assigned != expected) continue;
            token.gameObject.SetActive(false);
            hidden++;
        }
        Debug.Log("[StarcraftScoreboard] Arranged " + used.Count + " tray tokens; hid " + hidden + " verified duplicates.");
    }
}
