import { readFile, writeFile } from 'node:fs/promises';

// Candidate IDs refer to the visually reviewed local preview inventory. The
// exported selection stores full CDN URLs, so runtime use never needs this cache.
const choices = {
  Protoss: {
    Adepts: [81, 'ranged', 'shooting', 'Glaive weapon extended toward the target.'],
    Artanis: [57, 'melee', 'attack-ready', 'Blades raised; only complete mesh pose found.'],
    'High Templar': [71, 'ranged', 'casting', 'Both arms extended in a casting gesture.'],
    Immortal: [77, 'ranged', 'aiming', 'Forward-facing arm cannons.'],
    'Nerazim Watchers (Adept)': [
      63,
      'ranged',
      'casting',
      'Raised casting hand and forward weapon.',
    ],
    'Praetor Guards': [76, 'melee', 'striking', 'Arms and blades spread in an attacking stance.'],
    Pylon: [199, 'support', 'stationary', 'Actual pylon crystal; excluded the placeholder base.'],
    Sentries: [
      137,
      'ranged',
      'attack-ready',
      'Complete sentry body; excluded the separate effect sphere.',
    ],
    Stalker: [
      84,
      'ranged',
      'attack-ready',
      'Complete walker with forward weapon; no distinct firing pose found.',
    ],
    Tassadar: [68, 'ranged', 'casting', 'Arms extended in a casting gesture.'],
    'Twilight Templar (High Templar)': [
      65,
      'ranged',
      'casting',
      'Arms extended in a casting gesture.',
    ],
    Zealots: [60, 'melee', 'charging', 'Forward stride with both psi blades extended.'],
    Zeratul: [
      66,
      'melee',
      'attack-ready',
      'Body is posed to attack, but the psi blade is a separate mesh.',
      [67],
    ],
  },
  Terran: {
    'Auto-Turret': [34, 'ranged', 'aiming', 'Complete turret with weapon facing forward.'],
    Goliath: [36, 'ranged', 'aiming', 'Complete walker with guns facing forward.'],
    'Holo Decoy': [
      198,
      'support',
      'weapon-raised',
      'Holographic texture on the Nova mesh; no firing pose found.',
    ],
    'Jim Raynor': [
      171,
      'ranged',
      'weapon-raised',
      'Named Raynor body requires its separate commander rifle; no complete aiming variant found.',
      [172],
    ],
    Marauders: [167, 'ranged', 'aiming', 'Both arm launchers extended forward.'],
    Medics: [180, 'support', 'support-action', 'Medical arm extended behind the shield.'],
    'Nova Assault Mode': [
      21,
      'ranged',
      'attack-ready',
      'Body requires its separately attached firearm; sword is another optional attachment.',
      [22],
    ],
    'Nova Stealth Mode': [
      20,
      'ranged',
      'weapon-raised',
      'Complete rifle mesh, with barrel raised; no aiming variant found.',
    ],
    'Point Defense Drone': [
      28,
      'ranged',
      'attack-ready',
      'Complete drone body with forward weapon housing.',
    ],
    Raven: [27, 'ranged', 'flying', 'Complete aircraft; excluded the separate flat effect mesh.'],
    "Raynor's Raiders": [156, 'ranged', 'aiming', 'Rifle held level toward the target.'],
    'Sabotage Drone': [
      24,
      'support',
      'stationary',
      'Complete sabotage drone; no alternative action pose found.',
    ],
    'Siege Tank': [
      15,
      'ranged',
      'siege-deployed',
      'Deployed siege cannon with extended stabilizers.',
    ],
    'Spec Ops Marauder (Marauder)': [
      39,
      'ranged',
      'aiming',
      'Both arm launchers extended forward.',
    ],
    Marines: [
      6,
      'ranged',
      'aiming',
      'Rifle held level toward the target; preferred over running and lowered-weapon poses.',
    ],
  },
  Zerg: {
    'Bile Launcher': [
      119,
      'ranged',
      'attack-ready',
      'Launcher raised with mouth open; only complete mesh found.',
    ],
    'Corpsers (Roach)': [133, 'ranged', 'attack-ready', 'Head and forelimbs directed forward.'],
    Defiler: [127, 'support', 'advancing', 'Complete crawling body; only mesh pose found.'],
    Hydralisks: [
      124,
      'ranged',
      'attack-ready',
      'Head thrust forward in a braced stance; no visible spit projectile.',
    ],
    Kerrigan: [189, 'melee', 'striking', 'Wing claws raised and spread in an attack gesture.'],
    'Kerrigan Swarm Raptors (Zergling)': [
      125,
      'melee',
      'charging',
      'Leaping forward with claws extended.',
    ],
    'Omega Worm': [
      200,
      'melee',
      'attack-ready',
      'Actual open-mouthed nydus mesh; excluded the placeholder base.',
    ],
    Queen: [
      106,
      'ranged',
      'attack-ready',
      'Complete queen with forelimbs extended; excluded a mislabeled humanoid mesh.',
    ],
    'Raptors (Zergling)': [98, 'melee', 'charging', 'Leaping forward with claws extended.'],
    Ravagers: [
      131,
      'ranged',
      'attack-ready',
      'Upright launcher stance; only complete mesh pose found.',
    ],
    Roaches: [134, 'ranged', 'attack-ready', 'Low braced stance with head forward.'],
    Roachling: [94, 'melee', 'charging', 'Body pitched forward with attacking forelimbs.'],
    Swarmlings: [100, 'melee', 'charging', 'Lunging forward rather than the upright idle pose.'],
    'Vileling (Zergling)': [111, 'melee', 'charging', 'Hunched forward with claws extended.'],
    'Viles (Roach)': [
      null,
      'ranged',
      'unavailable',
      'The labeled mesh is only a flat base. The actual Vile is an asset bundle, not an inspected mesh/texture pair.',
    ],
    Zagara: [
      114,
      'ranged',
      'attack-ready',
      'Complete Zagara with forelimbs raised; no distinct firing pose found.',
    ],
    Zerglings: [126, 'melee', 'charging', 'True zergling leaping forward with claws extended.'],
  },
};

const candidates = JSON.parse(await readFile('.cache/tts-preview/candidates.json', 'utf8'));
const adjustments = JSON.parse(await readFile('model-adjustments.json', 'utf8'));
const models = [];
function reference(id) {
  const model = candidates.find(model => model.id === id);
  if (!model?.customMesh?.MeshURL || !model.customMesh.DiffuseURL) {
    throw new Error(`Missing mesh/texture pair for candidate ${id}`);
  }
  return {
    candidateId: id,
    sourceName: model.name,
    workshopId: model.workshopId,
    guid: model.guid,
    meshUrl: model.customMesh.MeshURL,
    textureUrl: model.customMesh.DiffuseURL,
    ttsTransform: model.transform,
  };
}
for (const [faction, units] of Object.entries(choices)) {
  const gameUnits = JSON.parse(await readFile(`Starcraft/${faction}/units.json`, 'utf8'));
  for (const unit of gameUnits) {
    const choice = units[unit.Name];
    if (!choice) throw new Error(`Unreviewed unit: ${faction}/${unit.Name}`);
    const [id, role, pose, notes, attachments = []] = choice;
    const entry = {
      faction,
      unitId: unit.Id,
      unitName: unit.Name,
      role,
      pose,
      status: id === null ? 'missing-mesh' : attachments.length ? 'requires-assembly' : 'selected',
      notes,
      ...(id === null ? {} : { model: reference(id) }),
      ...(attachments.length ? { attachments: attachments.map(reference) } : {}),
    };
    const adjustment = adjustments[unit.Name];
    if (adjustment) {
      if (adjustment.model) {
        entry.model = adjustment.model;
        delete entry.attachments;
        entry.status = 'selected';
      }
      if (adjustment.includeAttachments) entry.status = 'selected';
      if (adjustment.layout) entry.layout = adjustment.layout;
      entry.notes = adjustment.notes;
    }
    models.push(entry);
  }
}
await writeFile(
  'model-selections.json',
  JSON.stringify(
    {
      source: 'https://steamcommunity.com/sharedfiles/filedetails/?id=3662791369',
      purpose: 'Visually reviewed CDN mesh/texture selections; not a Warhall schema definition.',
      policy:
        'Prefer firing/aiming/casting for ranged units and striking/charging for melee units. Record closest available poses explicitly.',
      models,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  models.reduce((counts, model) => {
    counts[model.status] = (counts[model.status] ?? 0) + 1;
    return counts;
  }, {}),
);
