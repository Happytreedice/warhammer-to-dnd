import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PACK_ROOT = path.join(ROOT, "src", "packs");
const MODULE_ID = "warhammer-to-dnd";
const SYSTEM_VERSION = "5.3.3";
const CORE_VERSION = "14";

const ITEM_PACKS = {
  equipment: "warhammer-equipment",
  feat: "warhammer-features",
  spell: "warhammer-spells",
  weapon: "warhammer-weapons"
};

const ACTOR_PACKS = [
  "beastmen-brayherds-actors",
  "chaos-dwarfs-actors",
  "daemons-of-chaos-actors",
  "dark-elf-actors",
  "dwarfen-mountain-holds-actors",
  "empire-of-man-actors",
  "high-elf-realms-actors",
  "khemri-actors",
  "kingdom-of-bretonnia-actors",
  "lizardmen-actors",
  "ogre-kingdoms-actors",
  "orc-and-goblin-tribes-actors",
  "skaven-actors",
  "vampire-counts-actors",
  "vyrkos-dynasty-actors",
  "warriors-of-chaos-actors",
  "warriors-of-chaos-khorne-actors",
  "warriors-of-chaos-tzeentch-actors",
  "wood-elf-realms-actors"
];

const FACTIONS = {
  "beastmen-brayherds": "Beastmen Brayherds",
  "chaos-dwarfs": "Chaos Dwarfs",
  "daemons-of-chaos": "Daemons of Chaos",
  "dark-elf": "Dark Elves",
  "dwarfen-mountain-holds": "Dwarfen Mountain Holds",
  "empire-of-man": "Empire of Man",
  "high-elf-realms": "High Elf Realms",
  "khemri": "Tomb Kings of Khemri",
  "kingdom-of-bretonnia": "Kingdom of Bretonnia",
  "lizardmen": "Lizardmen",
  "ogre-kingdoms": "Ogre Kingdoms",
  "orc-and-goblin-tribes": "Orc and Goblin Tribes",
  "skaven": "Skaven",
  "vampire-counts": "Vampire Counts",
  "vyrkos-dynasty": "Vyrkos Dynasty",
  "warriors-of-chaos-khorne": "Warriors of Chaos - Khorne",
  "warriors-of-chaos-tzeentch": "Warriors of Chaos - Tzeentch",
  "warriors-of-chaos": "Warriors of Chaos",
  "wood-elf-realms": "Wood Elf Realms"
};

const SOURCE = {
  custom: "",
  rules: "2024",
  license: "Homebrew adaptation",
  book: "Warhammer: The Old World"
};

const QUOTES = [
  "Steel is a promise made before fear can speak.",
  "A banner lives only while someone is willing to bleed beneath it.",
  "The Old World remembers every oath, especially the broken ones.",
  "Victory belongs to the hand that does not tremble at dusk.",
  "A spell is courage given a sharper name.",
  "No shield is stronger than the will behind it."
];

const SPELL_SETS = {
  fire: ["fireball", "flame", "burning", "conflagration", "bolt"],
  death: ["death", "soul", "doom", "necrotic", "shade", "apotheosis"],
  beast: ["beast", "savage", "amber", "wild", "storm"],
  light: ["light", "banish", "ward", "healing", "blessing"],
  shadow: ["shadow", "dark", "blade", "phantom", "mist"],
  plague: ["plague", "rot", "pox", "nurgle", "disease"]
};

const CREATURE_WITHOUT_HANDS = [
  "bat",
  "bats",
  "wolf",
  "wolves",
  "warhound",
  "warhounds",
  "dog",
  "dogs",
  "eagle",
  "eagles",
  "horse",
  "horses",
  "carrion",
  "squig",
  "squigs",
  "swarm",
  "swarms",
  "hydra",
  "dragon",
  "carnosaur",
  "stegadon",
  "bastiladon",
  "troglodon",
  "taurus",
  "lammasu",
  "manticore",
  "phoenix",
  "stonehorn",
  "thundertusk",
  "arachnarok"
];

const counts = {
  equipment: 0,
  features: 0,
  spells: 0,
  weapons: 0,
  actors: 0,
  actorItemsRemoved: 0,
  actorRefsAdded: 0,
  maneuverFeaturesCreated: 0,
  journalsDeleted: 0
};

function main() {
  const itemIndex = buildItemIndex();

  migrateEquipment(itemIndex);
  migrateFeatures(itemIndex);
  migrateSpells(itemIndex);
  migrateWeapons(itemIndex);
  createCombatManeuvers(itemIndex);
  migrateActors(itemIndex);
  deleteConversionJournals();
  updateManifest();
  updateRuntimeScript();
  updateLanguages();

  console.log(JSON.stringify(counts, null, 2));
}

function migrateEquipment(itemIndex) {
  for (const file of jsonFiles(path.join(PACK_ROOT, ITEM_PACKS.equipment))) {
    const doc = readJson(file);
    doc.type = "equipment";
    normalizeCommonDocument(doc, "Item");
    normalizeEquipmentSystem(doc);
    setDescription(doc, describeEquipment(doc));
    doc.effects = buildEquipmentEffects(doc);
    writeJson(file, doc);
    indexItem(itemIndex, ITEM_PACKS.equipment, doc);
    counts.equipment++;
  }
}

function migrateFeatures(itemIndex) {
  for (const file of jsonFiles(path.join(PACK_ROOT, ITEM_PACKS.feat))) {
    const doc = readJson(file);
    doc.type = "feat";
    normalizeCommonDocument(doc, "Item");
    normalizeFeatureSystem(doc);
    setDescription(doc, describeFeature(doc));
    doc.effects = buildFeatureEffects(doc);
    writeJson(file, doc);
    indexItem(itemIndex, ITEM_PACKS.feat, doc);
    counts.features++;
  }
}

function migrateSpells(itemIndex) {
  for (const file of jsonFiles(path.join(PACK_ROOT, ITEM_PACKS.spell))) {
    const doc = readJson(file);
    doc.type = "spell";
    normalizeCommonDocument(doc, "Item");
    normalizeSpellSystem(doc);
    setDescription(doc, describeSpell(doc));
    doc.effects = buildSpellEffects(doc);
    writeJson(file, doc);
    indexItem(itemIndex, ITEM_PACKS.spell, doc);
    counts.spells++;
  }
}

function migrateWeapons(itemIndex) {
  for (const file of jsonFiles(path.join(PACK_ROOT, ITEM_PACKS.weapon))) {
    const doc = readJson(file);
    doc.type = "weapon";
    normalizeCommonDocument(doc, "Item");
    normalizeWeaponSystem(doc);
    setDescription(doc, describeWeapon(doc));
    doc.effects = buildWeaponEffects(doc);
    writeJson(file, doc);
    indexItem(itemIndex, ITEM_PACKS.weapon, doc);
    counts.weapons++;
  }
}

function migrateActors(itemIndex) {
  const spellPool = [...itemIndex.byType.spell.values()];
  const maneuverRefs = [...itemIndex.byType.feat.values()].filter((item) => item.flags?.[MODULE_ID]?.combatManeuver);

  for (const packName of ACTOR_PACKS) {
    for (const file of jsonFiles(path.join(PACK_ROOT, packName))) {
      const actor = readJson(file);
      const originalItems = Array.isArray(actor.items) ? actor.items : [];
      const faction = factionFromPack(packName);
      const role = classifyActorRole(actor);
      const originalCr = Number(actor.system?.details?.cr ?? 1);
      const cr = rebalanceCr(originalCr, role, actor.name);
      const stats = benchmarkStats(cr, role, actor);

      normalizeCommonDocument(actor, "Actor");
      actor.type = "npc";
      actor.system ??= {};
      normalizeActorSystem(actor, stats, cr, role, faction);

      const existingModuleFlags = actor.flags?.[MODULE_ID] ?? {};
      const itemUuids = collectLogicalItemRefs(originalItems, actor, faction, itemIndex, maneuverRefs, existingModuleFlags.itemUuids);
      const spellUuids = unique([
        ...selectSpellRefs(actor, faction, spellPool),
        ...(Array.isArray(existingModuleFlags.spellUuids) ? existingModuleFlags.spellUuids : [])
      ]).slice(0, 5);
      actor.items = [];
      actor.flags ??= {};
      delete actor.flags.warhammerConversions;
      actor.flags[MODULE_ID] = {
        role,
        faction,
        pf2eBenchmark: {
          level: Math.max(0, Math.round(cr)),
          band: stats.pf2eBand,
          mappedToChallengeRating: cr
        },
        itemUuids,
        spellUuids
      };
      setActorDescription(actor, faction, role, itemUuids.length, spellUuids.length);

      counts.actorItemsRemoved += originalItems.length;
      counts.actorRefsAdded += itemUuids.length + spellUuids.length;
      counts.actors++;
      writeJson(file, actor);
    }
  }
}

function normalizeCommonDocument(doc, documentName) {
  doc._id ||= deterministicId(`${documentName}:${doc.name}:${doc.type}`);
  doc.name = cleanDisplayName(doc.name || "Unnamed");
  doc.img ||= documentName === "Actor" ? "icons/svg/mystery-man.svg" : "icons/svg/item-bag.svg";
  doc.effects = Array.isArray(doc.effects) ? doc.effects.filter((effect) => isPlainObject(effect)) : [];
  doc.folder ??= null;
  doc.sort = Number.isFinite(Number(doc.sort)) ? Number(doc.sort) : 0;
  doc.ownership = normalizeOwnership(doc.ownership);
  doc.flags = normalizeFlags(doc.flags);
  doc._stats = {
    ...(isPlainObject(doc._stats) ? doc._stats : {}),
    coreVersion: CORE_VERSION,
    systemId: "dnd5e",
    systemVersion: SYSTEM_VERSION
  };
  delete doc._sourcePack;
}

function normalizeEquipmentSystem(doc) {
  const s = doc.system ??= {};
  normalizeItemBasics(doc);
  normalizePhysical(s);
  normalizeEquippable(s);
  normalizeActivities(s, { active: hasActionData(s) });
  const profile = equipmentProfile(doc.name);

  s.type = {
    value: profile.type,
    baseItem: profile.baseItem
  };
  s.properties = unique([...(Array.isArray(s.properties) ? s.properties : []), ...profile.properties]);
  s.armor = {
    value: profile.armor ?? 0,
    magicalBonus: profile.magicalBonus ?? null,
    dex: profile.dex ?? null
  };
  s.activities = {};
  s.strength = profile.strength;
  s.proficient = null;
  if (profile.speed) s.speed = profile.speed;
  else delete s.speed;
  s.cover = null;
  s.crewed = false;
  s.hp = { value: null, max: null, dt: null, conditions: "" };
  if (s.type.value === "wondrous" || s.type.value === "trinket" || s.type.value === "ring") {
    s.attunement = s.properties.includes("mgc") ? "optional" : "";
  }
  removeLegacyActionFields(s);
  removeLooseActionFields(s);
}

function normalizeFeatureSystem(doc) {
  const s = doc.system ??= {};
  normalizeItemBasics(doc);
  normalizeActivities(s, { active: hasActionData(s), feature: true });
  s.enchant = normalizeEnchant(s.enchant);
  s.type = normalizeFeatureType(s.type, doc.name);
  s.prerequisites = {
    items: [],
    level: null,
    repeatable: false
  };
  s.properties = unique([...(Array.isArray(s.properties) ? s.properties : []), "trait"]);
  s.requirements = s.requirements ?? "";
  s.cover = s.cover ?? null;
  s.crewed = Boolean(s.crewed);
  removeLegacyActionFields(s);
  removeLooseActionFields(s);
}

function normalizeSpellSystem(doc) {
  const s = doc.system ??= {};
  normalizeItemBasics(doc);
  normalizeActivities(s, { active: true, spell: true });
  s.ability = s.ability || "";
  s.activation = normalizeActivation(s.activation);
  s.duration = normalizeDuration(s.duration);
  s.target = normalizeTarget(s.target);
  s.range = normalizeRange(s.range);
  s.level = clampInt(Number(s.level ?? inferSpellLevel(doc.name)), 0, 9);
  s.school = normalizeSchool(s.school, doc.name);
  s.method = s.method || s.preparation?.mode || "innate";
  if (s.method === "prepared") s.method = "spell";
  s.prepared = typeof s.prepared === "number" ? s.prepared : Number(Boolean(s.preparation?.prepared));
  delete s.preparation;
  s.properties = normalizeSpellProperties(s.properties);
  s.materials = {
    value: s.materials?.value ?? "",
    consumed: Boolean(s.materials?.consumed),
    cost: Number(s.materials?.cost ?? 0),
    supply: Number(s.materials?.supply ?? 0)
  };
  s.sourceItem = s.sourceItem || "";
  removeLegacyActionFields(s, { keepSpellFields: true });
  removeLooseActionFields(s, { keepAbility: true });
}

function normalizeWeaponSystem(doc) {
  const s = doc.system ??= {};
  normalizeItemBasics(doc);
  normalizePhysical(s);
  normalizeEquippable(s);
  normalizeActivities(s, { active: true, weapon: true });

  const profile = weaponProfile(doc.name, s);
  s.type = {
    value: profile.type,
    baseItem: profile.baseItem
  };
  s.properties = unique([...(Array.isArray(s.properties) ? s.properties : []), ...profile.properties]);
  s.proficient = null;
  s.magicalBonus = s.magicalBonus ?? null;
  s.mastery = s.mastery || profile.mastery;
  s.ammunition = profile.ammunition ? { type: profile.ammunition } : {};
  s.range = profile.range;
  s.damage = {
    base: damageField(profile.damage.formula, profile.damage.type),
    versatile: profile.versatile ? damageField(profile.versatile.formula, profile.damage.type) : emptyDamage()
  };
  s.armor = { value: null };
  s.hp = { value: null, max: null, dt: null, conditions: "" };
  s.cover = null;
  s.crewed = false;
  removeLegacyActionFields(s);
  delete s.ability;
  delete s.formula;
  delete s.consume;
  delete s.recharge;
}

function normalizeItemBasics(doc) {
  const s = doc.system ??= {};
  s.description = {
    value: s.description?.value ?? "",
    chat: s.description?.chat ?? ""
  };
  s.identifier = slugify(doc.name);
  s.source = normalizeSource(s.source);
  s.uses = normalizeUses(s.uses);
}

function normalizePhysical(s) {
  s.container = s.container ?? null;
  s.quantity = Number.isFinite(Number(s.quantity)) ? Number(s.quantity) : 1;
  s.weight = normalizeWeight(s.weight);
  s.price = normalizePrice(s.price);
  s.rarity = typeof s.rarity === "string" ? s.rarity : "";
}

function normalizeEquippable(s) {
  if (typeof s.attunement === "number") s.attunement = s.attunement > 0 ? "required" : "";
  s.attunement = typeof s.attunement === "string" ? s.attunement : "";
  s.attuned = Boolean(s.attuned);
  s.equipped = Boolean(s.equipped);
  s.identified = s.identified !== false;
  s.unidentified = {
    description: s.unidentified?.description ?? "",
    name: s.unidentified?.name ?? ""
  };
}

function normalizeActivities(s, options = {}) {
  s.uses = normalizeUses(s.uses);
  const existing = isPlainObject(s.activities) ? s.activities : {};
  if (Object.keys(existing).length) {
    s.activities = normalizeExistingActivities(existing);
    return;
  }

  if (!options.active) {
    s.activities = {};
    return;
  }

  const activity = buildActivity(s, options);
  s.activities = activity ? { [activity._id]: activity } : {};
}

function normalizeExistingActivities(activities) {
  const out = {};
  let sort = 0;
  for (const [key, activity] of Object.entries(activities)) {
    if (!isPlainObject(activity)) continue;
    const id = activity._id || key || deterministicId(JSON.stringify(activity));
    out[id] = {
      ...activity,
      _id: id,
      sort: activity.sort ?? sort++,
      uses: normalizeUses(activity.uses),
      effects: Array.isArray(activity.effects) ? activity.effects : [],
      appliedEffects: Array.isArray(activity.appliedEffects) ? activity.appliedEffects : []
    };
  }
  return out;
}

function buildActivity(s, options) {
  const id = deterministicId(`activity:${JSON.stringify(s.description ?? {})}:${s.actionType ?? ""}`);
  const activation = normalizeActivityActivation(s.activation);
  const duration = normalizeActivityDuration(s.duration);
  const range = normalizeActivityRange(s.range);
  const target = normalizeActivityTarget(s.target);
  const uses = normalizeUses(s.uses);
  const base = {
    _id: id,
    sort: 0,
    activation,
    consumption: {
      targets: [],
      scaling: { allowed: false, max: "" },
      spellSlot: Boolean(options.spell)
    },
    description: { chatFlavor: "" },
    duration,
    effects: [],
    range,
    target,
    uses,
    name: "",
    img: "",
    appliedEffects: []
  };

  const damage = legacyDamage(s);
  const saveAbility = normalizeAbility(s.save?.ability) || "con";
  if (options.weapon || ["mwak", "rwak", "msak", "rsak"].includes(s.actionType)) {
    return {
      ...base,
      type: "attack",
      attack: {
        ability: normalizeAbility(s.ability) || "",
        bonus: s.attack?.bonus ?? s.attackBonus ?? "",
        critical: { threshold: null },
        flat: Boolean(s.attack?.flat),
        type: {
          value: s.actionType?.includes("r") ? "ranged" : "melee",
          classification: options.spell ? "spell" : "weapon"
        }
      },
      damage: {
        critical: { bonus: "" },
        includeBase: true,
        parts: damage ? [damageField(damage.formula, damage.type)] : []
      }
    };
  }

  if (options.spell || s.save?.ability) {
    return {
      ...base,
      type: "save",
      damage: {
        onSave: damage ? "half" : "none",
        parts: damage ? [damageField(damage.formula, damage.type, { scaling: "whole" })] : []
      },
      save: {
        ability: saveAbility,
        dc: {
          calculation: "spellcasting",
          formula: ""
        }
      }
    };
  }

  return {
    ...base,
    type: "utility",
    roll: {
      prompt: false,
      visible: false,
      name: "",
      formula: s.formula || ""
    }
  };
}

function normalizeActorSystem(actor, stats, cr, role, faction) {
  const s = actor.system ??= {};
  s.abilities = normalizeActorAbilities(s.abilities, stats);
  s.attributes ??= {};
  s.attributes.ac = {
    calc: "flat",
    flat: stats.ac,
    formula: "",
    value: stats.ac
  };
  s.attributes.hp = {
    value: stats.hp,
    max: stats.hp,
    temp: 0,
    tempmax: 0,
    formula: `${stats.hp}`
  };
  s.attributes.movement = normalizeMovement(s.attributes.movement, actor.name);
  s.attributes.prof = stats.prof;
  s.attributes.spellcasting = stats.spellcasting;
  s.attributes.spell = { level: stats.spellLevel };
  s.attributes.spelldc = stats.dc;
  s.attributes.hd = { spent: 0 };
  s.attributes.death = {
    success: 0,
    failure: 0,
    bonuses: { save: "" }
  };
  s.attributes.price = { value: null, denomination: "gp" };
  s.details ??= {};
  s.details.biography = normalizeBiography(s.details.biography);
  s.details.cr = cr;
  s.details.xp = { value: xpForCr(cr) };
  s.details.source = normalizeSource(s.details.source);
  s.details.type = normalizeCreatureType(s.details.type, actor.name);
  s.details.alignment = s.details.alignment || alignmentForFaction(faction);
  s.details.habitat = { value: [], custom: "" };
  s.details.treasure = { value: [] };
  s.source = normalizeSource(s.source);
  delete s.description;
  delete s.formula;
  s.resources = normalizeResources(s.resources, role);
  s.traits = normalizeActorTraits(s.traits, actor.name, faction);
}

function normalizeActorAbilities(abilities, stats) {
  const current = isPlainObject(abilities) ? abilities : {};
  const target = {
    str: stats.str,
    dex: stats.dex,
    con: stats.con,
    int: stats.int,
    wis: stats.wis,
    cha: stats.cha
  };
  const out = {};
  for (const [key, value] of Object.entries(target)) {
    out[key] = {
      value,
      proficient: Number(current[key]?.proficient ?? 0),
      bonuses: {
        check: current[key]?.bonuses?.check ?? "",
        save: current[key]?.bonuses?.save ?? ""
      }
    };
  }
  return out;
}

function normalizeMovement(movement, name) {
  const m = isPlainObject(movement) ? movement : {};
  const lower = name.toLowerCase();
  const fly = /dragon|harp|eagle|phoenix|daemon|screamer|carrion|bat|terr?adon|pegasus/.test(lower);
  const swim = /hydra|troglodon|skink|river/.test(lower);
  const burrow = /tomb|skeleton|ghoul|rat|skaven/.test(lower) ? 0 : 0;
  return {
    walk: Number(m.walk ?? 30),
    burrow: Number(m.burrow ?? burrow),
    climb: Number(m.climb ?? (/spider|skaven|rat/.test(lower) ? 30 : 0)),
    fly: Number(m.fly ?? (fly ? 40 : 0)),
    swim: Number(m.swim ?? (swim ? 30 : 0)),
    units: m.units || "ft",
    hover: Boolean(m.hover),
    special: m.special || ""
  };
}

function normalizeActorTraits(traits, name, faction) {
  const t = isPlainObject(traits) ? traits : {};
  return {
    size: t.size || sizeForName(name),
    di: normalizeTraitSet(t.di),
    dr: normalizeTraitSet(t.dr),
    dv: normalizeTraitSet(t.dv),
    ci: normalizeTraitSet(t.ci),
    languages: normalizeTraitSet(t.languages, languagesForFaction(faction)),
    senses: t.senses ?? {},
    important: Boolean(t.important)
  };
}

function normalizeTraitSet(value, defaults = []) {
  return {
    value: unique([...(Array.isArray(value?.value) ? value.value : []), ...defaults]),
    custom: value?.custom ?? ""
  };
}

function normalizeCreatureType(type, name) {
  if (isPlainObject(type)) {
    return {
      value: type.value || inferCreatureType(name),
      subtype: type.subtype || "",
      swarm: type.swarm || "",
      custom: type.custom || ""
    };
  }
  return {
    value: inferCreatureType(name),
    subtype: "",
    swarm: "",
    custom: ""
  };
}

function normalizeResources(resources, role) {
  const r = isPlainObject(resources) ? resources : {};
  const legendary = ["solo", "lord"].includes(role) ? 3 : 0;
  return {
    legact: {
      max: Number(r.legact?.max ?? legendary),
      spent: Number(r.legact?.spent ?? 0)
    },
    legres: {
      max: Number(r.legres?.max ?? (role === "solo" ? 2 : 0)),
      spent: Number(r.legres?.spent ?? 0)
    },
    lair: {
      value: Boolean(r.lair?.value),
      initiative: Number(r.lair?.initiative ?? 20),
      inside: Boolean(r.lair?.inside)
    }
  };
}

function normalizeBiography(biography) {
  return {
    value: biography?.value ?? "",
    public: biography?.public ?? ""
  };
}

function normalizeFlags(flags) {
  const next = isPlainObject(flags) ? flags : {};
  delete next["warhammer-tow-dnd5e"];
  delete next.warhammerConversions;
  next.dnd5e ??= {};
  next.dnd5e.riders ??= { activity: [], effect: [] };
  return next;
}

function normalizeOwnership(ownership) {
  return isPlainObject(ownership) ? ownership : { default: 0 };
}

function normalizeSource(source) {
  if (typeof source === "string") return { ...SOURCE, custom: source };
  return {
    ...SOURCE,
    ...(isPlainObject(source) ? source : {}),
    rules: "2024",
    license: SOURCE.license
  };
}

function normalizeWeight(weight) {
  if (isPlainObject(weight)) {
    return {
      value: Number(weight.value ?? 0),
      units: weight.units || "lb"
    };
  }
  return {
    value: Number(weight ?? 0),
    units: "lb"
  };
}

function normalizePrice(price) {
  if (isPlainObject(price)) {
    return {
      value: Number(price.value ?? 0),
      denomination: price.denomination || "gp"
    };
  }
  return {
    value: Number(price ?? 0),
    denomination: "gp"
  };
}

function normalizeUses(uses) {
  if (!isPlainObject(uses)) return { spent: 0, max: "", recovery: [] };
  const max = uses.max === undefined || uses.max === null ? "" : String(uses.max);
  const numericMax = Number(max);
  const value = Number(uses.value ?? 0);
  const spent = Number.isFinite(numericMax) && numericMax > 0 ? Math.max(0, numericMax - value) : Number(uses.spent ?? 0);
  let recovery = [];
  if (Array.isArray(uses.recovery)) {
    recovery = uses.recovery.map((entry) => ({
      period: entry.period || uses.per || "lr",
      type: entry.type || "recoverAll",
      formula: entry.formula || ""
    }));
  } else if (uses.per) {
    recovery = [{
      period: uses.per,
      type: uses.per === "recharge" ? "recoverAll" : "recoverAll",
      formula: uses.recovery ? String(uses.recovery) : ""
    }];
  }
  return { spent, max, recovery };
}

function normalizeActivation(activation) {
  return {
    type: activation?.type || "action",
    value: activation?.value ?? activation?.cost ?? null,
    condition: activation?.condition ?? ""
  };
}

function normalizeDuration(duration) {
  return {
    value: duration?.value === null || duration?.value === undefined ? "" : String(duration.value),
    units: duration?.units || "inst",
    special: duration?.special || ""
  };
}

function normalizeRange(range) {
  return {
    value: range?.value === null || range?.value === undefined ? "" : String(range.value),
    units: range?.units || "self",
    special: range?.special || ""
  };
}

function normalizeTarget(target) {
  if (target?.template || target?.affects) {
    return {
      template: {
        count: target.template?.count ?? "",
        contiguous: Boolean(target.template?.contiguous),
        stationary: Boolean(target.template?.stationary),
        type: target.template?.type ?? "",
        size: target.template?.size ?? "",
        width: target.template?.width ?? "",
        height: target.template?.height ?? "",
        units: target.template?.units || "ft"
      },
      affects: {
        count: target.affects?.count ?? "",
        type: target.affects?.type ?? "",
        choice: Boolean(target.affects?.choice),
        special: target.affects?.special ?? ""
      }
    };
  }

  const areaType = ["cone", "cube", "cylinder", "line", "sphere"].includes(target?.type) ? target.type : "";
  const individualType = areaType ? "creature" : target?.type || "";
  return {
    template: {
      count: "",
      contiguous: false,
      stationary: false,
      type: areaType,
      size: areaType ? String(target?.value ?? "") : "",
      width: target?.width === null || target?.width === undefined ? "" : String(target.width),
      height: "",
      units: target?.units || "ft"
    },
    affects: {
      count: areaType ? "" : String(target?.value ?? ""),
      type: individualType,
      choice: false,
      special: ""
    }
  };
}

function normalizeActivityActivation(activation) {
  const a = normalizeActivation(activation);
  return { ...a, override: false };
}

function normalizeActivityDuration(duration) {
  const d = normalizeDuration(duration);
  return { ...d, concentration: false, override: false };
}

function normalizeActivityRange(range) {
  const r = normalizeRange(range);
  return { ...r, override: false };
}

function normalizeActivityTarget(target) {
  const t = normalizeTarget(target);
  return { ...t, prompt: true, override: false };
}

function normalizeFeatureType(type, name) {
  const lower = name.toLowerCase();
  const value = lower.includes("maneuver") || lower.includes("feint") ? "class" : type?.value || "monster";
  return {
    value,
    subtype: value === "class" && /maneuver|feint|strike|sweep|ambush/.test(lower) ? "maneuver" : type?.subtype || ""
  };
}

function normalizeEnchant(enchant) {
  return isPlainObject(enchant) ? enchant : {};
}

function normalizeSpellProperties(properties) {
  const values = Array.isArray(properties) ? properties : [];
  const mapped = values.map((value) => {
    if (value === "v") return "vocal";
    if (value === "s") return "somatic";
    if (value === "m") return "material";
    return value;
  });
  return unique(mapped.length ? mapped : ["vocal", "somatic"]);
}

function normalizeSchool(school, name) {
  const byOld = {
    abjuration: "abj",
    conjuration: "con",
    divination: "div",
    enchantment: "enc",
    evocation: "evo",
    illusion: "ill",
    necromancy: "nec",
    transmutation: "trs"
  };
  if (["abj", "con", "div", "enc", "evo", "ill", "nec", "trs"].includes(school)) return school;
  if (byOld[school]) return byOld[school];
  const lower = name.toLowerCase();
  if (/death|soul|nec|vamp|grave|bone/.test(lower)) return "nec";
  if (/shadow|mist|phantom|glamour/.test(lower)) return "ill";
  if (/ward|shield|banish|protect/.test(lower)) return "abj";
  if (/summon|call|raise/.test(lower)) return "con";
  if (/curse|command|fear/.test(lower)) return "enc";
  if (/change|flesh|beast|growth/.test(lower)) return "trs";
  return "evo";
}

function normalizeAbility(ability) {
  return ["str", "dex", "con", "int", "wis", "cha"].includes(ability) ? ability : "";
}

function damageField(formula, type, options = {}) {
  const parsed = parseDamageFormula(formula);
  return {
    number: parsed.number,
    denomination: parsed.denomination,
    bonus: parsed.bonus,
    types: type ? [type] : [],
    custom: {
      enabled: parsed.custom,
      formula: parsed.custom ? formula : ""
    },
    scaling: {
      mode: options.scaling || "",
      number: 1,
      formula: ""
    }
  };
}

function emptyDamage() {
  return damageField("", "");
}

function parseDamageFormula(formula) {
  if (!formula) return { number: null, denomination: null, bonus: "", custom: false };
  const match = String(formula).trim().match(/^(\d+)d(\d+)(?:\s*\+\s*(.+))?$/i);
  if (!match) return { number: null, denomination: null, bonus: "", custom: true };
  return {
    number: Number(match[1]),
    denomination: Number(match[2]),
    bonus: match[3] || "",
    custom: false
  };
}

function legacyDamage(s) {
  const part = s.damage?.parts?.[0];
  if (Array.isArray(part)) {
    return { formula: part[0] || "1d6", type: part[1] || "slashing" };
  }
  if (s.damage?.base?.custom?.formula) {
    return { formula: s.damage.base.custom.formula, type: s.damage.base.types?.[0] || "force" };
  }
  if (s.damage?.base?.denomination) {
    return {
      formula: `${s.damage.base.number || 1}d${s.damage.base.denomination}${s.damage.base.bonus ? ` + ${s.damage.base.bonus}` : ""}`,
      type: s.damage.base.types?.[0] || "slashing"
    };
  }
  return null;
}

function hasActionData(s) {
  return Boolean(s.activation?.type || s.actionType || s.damage?.parts?.length || s.save?.ability || s.formula);
}

function removeLegacyActionFields(s, options = {}) {
  delete s.actionType;
  delete s.attackBonus;
  delete s.attack;
  delete s.critical;
  delete s.save;
  delete s.scaling;
  if (!options.keepSpellFields) {
    delete s.activation;
    delete s.duration;
    delete s.target;
    delete s.range;
  }
}

function removeLooseActionFields(s, options = {}) {
  if (!options.keepAbility) delete s.ability;
  delete s.consume;
  delete s.damage;
  delete s.formula;
  delete s.recharge;
}

function equipmentProfile(name) {
  const lower = name.toLowerCase();
  if (lower.includes("war-plate") || lower.includes("plate")) {
    return {
      type: "heavy",
      baseItem: "plate",
      armor: 18,
      dex: 0,
      magicalBonus: "1",
      strength: 15,
      properties: ["mgc", "stealthDisadvantage"]
    };
  }
  if (lower.includes("armour") || lower.includes("armor")) {
    return {
      type: "medium",
      baseItem: "halfplate",
      armor: 15,
      dex: 2,
      magicalBonus: lower.includes("chaos") || lower.includes("dwarf") ? "1" : null,
      strength: 0,
      properties: lower.includes("heavy") ? ["stealthDisadvantage"] : []
    };
  }
  if (lower.includes("talisman")) {
    return {
      type: "wondrous",
      baseItem: "",
      armor: null,
      dex: null,
      magicalBonus: null,
      strength: 0,
      properties: ["mgc"]
    };
  }
  if (lower.includes("relic")) {
    return {
      type: "trinket",
      baseItem: "",
      armor: null,
      dex: null,
      magicalBonus: null,
      strength: 0,
      properties: ["mgc"]
    };
  }
  if (lower.includes("banner") || lower.includes("standard")) {
    return {
      type: "wondrous",
      baseItem: "",
      armor: null,
      dex: null,
      magicalBonus: null,
      strength: 0,
      properties: ["mgc"]
    };
  }
  return {
    type: "wondrous",
    baseItem: "",
    armor: null,
    dex: null,
    magicalBonus: null,
    strength: 0,
    properties: []
  };
}

function weaponProfile(name, s) {
  const lower = name.toLowerCase();
  const damage = legacyDamage(s);
  if (/bow|crossbow|handgun|pistol|jezzail|sling|thrower|cannon|bolt|rocket|mortar|catapult/.test(lower)) {
    return {
      type: /cannon|catapult|mortar|rocket|bolt-thrower/.test(lower) ? "siege" : "martialR",
      baseItem: lower.includes("longbow") ? "longbow" : lower.includes("crossbow") ? "lightcrossbow" : lower.includes("pistol") ? "pistol" : "shortbow",
      properties: lower.includes("crossbow") || lower.includes("gun") || lower.includes("pistol") ? ["amm", "lod"] : ["amm", "two"],
      mastery: "slow",
      ammunition: lower.includes("sling") ? "slingBullet" : lower.includes("pistol") || lower.includes("handgun") ? "firearmBullet" : "arrow",
      range: { value: 80, long: 320, reach: null, units: "ft" },
      damage: damage || { formula: "1d8", type: "piercing" }
    };
  }
  if (/claw|bite|horn|hoof|talon|fist|tentacle|stomp|tail/.test(lower)) {
    return {
      type: "natural",
      baseItem: "",
      properties: [],
      mastery: "",
      range: { value: null, long: null, reach: 5, units: "ft" },
      damage: damage || { formula: "1d6", type: lower.includes("bite") ? "piercing" : "slashing" }
    };
  }
  if (/spear|lance|pike|halberd|glaive/.test(lower)) {
    return {
      type: "martialM",
      baseItem: lower.includes("lance") ? "lance" : lower.includes("pike") ? "pike" : lower.includes("halberd") ? "halberd" : "spear",
      properties: ["rch"],
      mastery: "push",
      range: { value: null, long: null, reach: 10, units: "ft" },
      damage: damage || { formula: "1d8", type: "piercing" }
    };
  }
  if (/axe|cleaver/.test(lower)) {
    return {
      type: "martialM",
      baseItem: "battleaxe",
      properties: ["ver"],
      mastery: "cleave",
      range: { value: null, long: null, reach: 5, units: "ft" },
      damage: damage || { formula: "1d8", type: "slashing" },
      versatile: { formula: "1d10" }
    };
  }
  if (/hammer|maul|mace|club/.test(lower)) {
    return {
      type: "martialM",
      baseItem: lower.includes("maul") ? "maul" : "warhammer",
      properties: ["ver"],
      mastery: "topple",
      range: { value: null, long: null, reach: 5, units: "ft" },
      damage: damage || { formula: "1d8", type: "bludgeoning" },
      versatile: { formula: "1d10" }
    };
  }
  if (/dagger|knife/.test(lower)) {
    return {
      type: "simpleM",
      baseItem: "dagger",
      properties: ["fin", "lgt", "thr"],
      mastery: "nick",
      range: { value: 20, long: 60, reach: 5, units: "ft" },
      damage: damage || { formula: "1d4", type: "piercing" }
    };
  }
  return {
    type: "martialM",
    baseItem: "longsword",
    properties: ["ver"],
    mastery: "sap",
    range: { value: null, long: null, reach: 5, units: "ft" },
    damage: damage || { formula: "1d8", type: "slashing" },
    versatile: { formula: "1d10" }
  };
}

function buildEquipmentEffects(doc) {
  const lower = doc.name.toLowerCase();
  const effects = [];
  if (lower.includes("talisman") || lower.includes("relic")) {
    effects.push(activeEffect(doc, "Ward", [
      { key: "system.bonuses.abilities.save", mode: 2, value: "1", priority: 20 }
    ]));
  }
  if (lower.includes("banner") || lower.includes("standard")) {
    effects.push(activeEffect(doc, "Battle Standard", [
      { key: "system.bonuses.abilities.check", mode: 2, value: "1", priority: 20 }
    ]));
  }
  return effects;
}

function buildFeatureEffects(doc) {
  const lower = doc.name.toLowerCase();
  if (/resilience|ward|discipline|leadership/.test(lower)) {
    return [activeEffect(doc, "Steady Resolve", [
      { key: "system.bonuses.abilities.save", mode: 2, value: "1", priority: 20 }
    ])];
  }
  return [];
}

function buildSpellEffects(doc) {
  const lower = doc.name.toLowerCase();
  if (/shield|ward|armor|armour/.test(lower)) {
    return [activeEffect(doc, "Spell Ward", [
      { key: "system.attributes.ac.bonus", mode: 2, value: "1", priority: 20 }
    ])];
  }
  return [];
}

function buildWeaponEffects(doc) {
  if (doc.system?.properties?.includes("mgc")) {
    return [activeEffect(doc, "Enchanted Edge", [
      { key: "system.bonuses.mwak.damage", mode: 2, value: "1", priority: 20 }
    ])];
  }
  return [];
}

function activeEffect(doc, suffix, changes) {
  return {
    _id: deterministicId(`${doc._id}:${suffix}`),
    name: `${doc.name}: ${suffix}`,
    img: doc.img,
    type: "base",
    system: {},
    changes,
    disabled: false,
    duration: {
      startTime: null,
      seconds: null,
      rounds: null,
      turns: null,
      startRound: null,
      startTurn: null,
      combat: null
    },
    transfer: true,
    statuses: [],
    flags: {
      dnd5e: {},
      ATL: {
        transfer: true
      }
    },
    _stats: {
      coreVersion: CORE_VERSION,
      systemId: "dnd5e",
      systemVersion: SYSTEM_VERSION
    }
  };
}

function setDescription(doc, data) {
  doc.system ??= {};
  doc.system.description ??= {};
  doc.system.description.value = [
    `<p><strong>${escapeHtml(doc.name)}.</strong> ${escapeHtml(data.literary)}</p>`,
    `<p><strong>Mechanics.</strong> ${escapeHtml(data.mechanics)}</p>`,
    `<blockquote><p>"${escapeHtml(data.quote)}"<br><em>- ${escapeHtml(data.attribution)}</em></p></blockquote>`
  ].join("");
  doc.system.description.chat = data.mechanics;
}

function setActorDescription(actor, faction, role, itemCount, spellCount) {
  actor.system.details ??= {};
  actor.system.details.biography = {
    value: [
      `<p><strong>${escapeHtml(actor.name)}.</strong> A ${escapeHtml(role)} presence from the ${escapeHtml(faction)}, built for brutal, legible table play. Its numbers are recalibrated from a PF2e-style creature benchmark and mapped back onto D&D challenge expectations.</p>`,
      `<p><strong>Rules Profile.</strong> AC ${actor.system.attributes.ac.flat}; HP ${actor.system.attributes.hp.max}; proficiency +${actor.system.attributes.prof}; save DC ${actor.system.attributes.spelldc}. Linked armory entries: ${itemCount}. Linked spell entries: ${spellCount}.</p>`,
      `<blockquote><p>"A warrior is measured when the line begins to break."<br><em>- Old World battlefield saying</em></p></blockquote>`
    ].join(""),
    public: ""
  };
}

function describeEquipment(doc) {
  const lower = doc.name.toLowerCase();
  const faction = factionFromName(doc.name);
  let mechanics = "While equipped, this item uses the dnd5e 5.3.3 equipment schema and transfers any listed active effects normally.";
  if (lower.includes("war-plate") || lower.includes("armour") || lower.includes("armor")) {
    mechanics = `Armor Class ${doc.system.armor.value}${doc.system.armor.magicalBonus ? ` + ${doc.system.armor.magicalBonus} magical bonus` : ""}; Dexterity cap ${doc.system.armor.dex ?? 0}; Strength requirement ${doc.system.strength}.`;
  } else if (lower.includes("talisman") || lower.includes("relic")) {
    mechanics = "While attuned, add +1 to saving throws through a transferable active effect.";
  } else if (lower.includes("banner") || lower.includes("standard")) {
    mechanics = "While carried or displayed by a suitable bearer, add +1 to ability checks through a transferable active effect.";
  }
  return {
    literary: `${doc.name} carries the hard doctrine of the ${faction}: a practical piece of war-gear made to keep its bearer standing when the press of shields turns desperate.`,
    mechanics,
    quote: quoteFor(doc.name),
    attribution: "Old World armorer's maxim"
  };
}

function describeFeature(doc) {
  const lower = doc.name.toLowerCase();
  const dc = lower.includes("disease") || lower.includes("poison") ? "DC 8 + proficiency bonus + Constitution modifier" : "DC 8 + proficiency bonus + the user's best relevant ability modifier";
  return {
    literary: `${doc.name} is the kind of battlefield habit that survives because it is simple, ruthless, and remembered under pressure.`,
    mechanics: `If a saving throw is required, use ${dc}. If the feature grants a maneuver, resolve it as the listed activity and apply any active effect only for its stated duration.`,
    quote: quoteFor(doc.name),
    attribution: "Old World drillmaster"
  };
}

function describeSpell(doc) {
  const damage = activityDamageText(doc.system.activities) || "its listed activity damage";
  const save = activitySaveText(doc.system.activities) || "the caster's spell save DC";
  return {
    literary: `${doc.name} tears shape from the Winds of Magic and forces it into a weaponized moment: bright, cold, hungry, or cruel according to the lore that birthed it.`,
    mechanics: `Casting uses ${doc.system.activation.type || "an action"} at range ${doc.system.range.value || "self"} ${doc.system.range.units || ""}. Targets make ${save}; on a failed save, apply ${damage}.`,
    quote: quoteFor(doc.name),
    attribution: "Old World magister"
  };
}

function describeWeapon(doc) {
  const damage = doc.system.damage?.base?.custom?.enabled
    ? doc.system.damage.base.custom.formula
    : `${doc.system.damage?.base?.number || 1}d${doc.system.damage?.base?.denomination || 6}`;
  const damageType = doc.system.damage?.base?.types?.[0] || "damage";
  return {
    literary: `${doc.name} is a battlefield answer more than an ornament, balanced for the instant when courage, reach, and violence decide who keeps the ground.`,
    mechanics: `Attack with the normal ability for ${doc.system.type.value}; on a hit, deal ${damage} ${damageType} damage${doc.system.damage?.base?.bonus ? ` plus ${doc.system.damage.base.bonus}` : ""}. Mastery: ${doc.system.mastery || "none"}.`,
    quote: quoteFor(doc.name),
    attribution: "Old World weaponsmith"
  };
}

function activityDamageText(activities) {
  for (const activity of Object.values(activities ?? {})) {
    const part = activity.damage?.parts?.[0];
    if (!part) continue;
    const formula = part.custom?.enabled ? part.custom.formula : `${part.number || 1}d${part.denomination || 6}`;
    const type = part.types?.[0] || "damage";
    return `${formula} ${type} damage`;
  }
  return "";
}

function activitySaveText(activities) {
  for (const activity of Object.values(activities ?? {})) {
    if (activity.save?.ability) return `${activity.save.ability.toUpperCase()} save against the caster's spell save DC`;
  }
  return "";
}

function createCombatManeuvers(itemIndex) {
  const maneuvers = [
    {
      name: "Shieldwall Advance",
      img: "icons/equipment/shield/heater-steel-boss-red.webp",
      mechanics: "As a bonus action, move up to 10 feet without provoking opportunity attacks from one creature you can see. Until your next turn, add +1 AC while adjacent to an ally.",
      role: "defender"
    },
    {
      name: "Brutal Feint",
      img: "icons/skills/melee/strike-sword-gray.webp",
      mechanics: "As a bonus action, make a Charisma (Deception) check contested by Wisdom (Insight). On a success, your next melee hit before the end of the turn deals +1d6 damage.",
      role: "damager"
    },
    {
      name: "Hook and Drag",
      img: "icons/skills/melee/strike-polearm-glowing-white.webp",
      mechanics: "When you hit with a reach weapon, the target must succeed on a Strength save or be pulled 5 feet toward you.",
      role: "controller"
    },
    {
      name: "Arcane Pressure",
      img: "icons/magic/symbols/runes-star-blue.webp",
      mechanics: "After a creature fails a save against one of your spells, it has disadvantage on the next concentration check it makes before your next turn.",
      role: "caster"
    },
    {
      name: "Terror Surge",
      img: "icons/magic/death/skull-horned-worn-fire-blue.webp",
      mechanics: "As an action, one creature within 30 feet must succeed on a Wisdom save or be frightened until the end of its next turn.",
      role: "solo"
    },
    {
      name: "Skirmisher's Slip",
      img: "icons/skills/movement/feet-winged-boots-brown.webp",
      mechanics: "When a creature misses you with a melee attack, you can use your reaction to move 10 feet without provoking that creature.",
      role: "ranger"
    }
  ];

  for (const maneuver of maneuvers) {
    const id = deterministicId(`maneuver:${maneuver.name}`);
    const file = path.join(PACK_ROOT, ITEM_PACKS.feat, `${slugify(maneuver.name)}_${id}.json`);
    if (fs.existsSync(file)) {
      const existing = readJson(file);
      indexItem(itemIndex, ITEM_PACKS.feat, existing);
      continue;
    }
    const doc = {
      _id: id,
      name: maneuver.name,
      type: "feat",
      img: maneuver.img,
      system: {
        description: { value: "", chat: "" },
        source: normalizeSource({}),
        identifier: slugify(maneuver.name),
        activities: {},
        uses: { spent: 0, max: "", recovery: [] },
        enchant: {},
        type: { value: "class", subtype: "maneuver" },
        prerequisites: { items: [], level: null, repeatable: false },
        properties: ["trait"],
        requirements: "",
        cover: null,
        crewed: false
      },
      effects: [],
      ownership: { default: 0 },
      flags: {
        dnd5e: { riders: { activity: [], effect: [] } },
        [MODULE_ID]: { combatManeuver: true, role: maneuver.role }
      },
      _stats: {
        coreVersion: CORE_VERSION,
        systemId: "dnd5e",
        systemVersion: SYSTEM_VERSION
      }
    };
    setDescription(doc, {
      literary: `${maneuver.name} is a disciplined answer to the chaos of the melee, a practiced trick that turns one step, one glance, or one threat into advantage.`,
      mechanics: maneuver.mechanics,
      quote: quoteFor(maneuver.name),
      attribution: "Old World drillmaster"
    });
    writeJson(file, doc);
    indexItem(itemIndex, ITEM_PACKS.feat, doc);
    counts.maneuverFeaturesCreated++;
  }
}

function collectLogicalItemRefs(items, actor, faction, itemIndex, maneuverRefs, existingRefs = []) {
  const refs = Array.isArray(existingRefs) ? [...existingRefs] : [];
  const lowerActor = actor.name.toLowerCase();
  const noHands = CREATURE_WITHOUT_HANDS.some((word) => lowerActor.includes(word));

  for (const item of items) {
    if (!isPlainObject(item)) continue;
    const match = findIndexedItem(item, itemIndex);
    if (!match) continue;
    if (noHands && match.type === "weapon" && !/claw|bite|horn|hoof|talon|stomp|tail/.test(match.name.toLowerCase())) {
      continue;
    }
    if (noHands && match.type === "equipment") continue;
    refs.push(match.uuid);
  }

  refs.push(...inferLibraryRefs(actor, faction, itemIndex, noHands));

  const role = classifyActorRole(actor);
  for (const maneuver of maneuverRefs) {
    const mRole = maneuver.flags?.[MODULE_ID]?.role;
    if ([role, "damager"].includes(mRole) || (role === "minor" && mRole === "ranger")) {
      refs.push(maneuver.uuid);
    }
  }

  return unique(refs).slice(0, 16);
}

function inferLibraryRefs(actor, faction, itemIndex, noHands) {
  const refs = [];
  const lower = `${actor.name} ${faction}`.toLowerCase();
  const factionSlug = slugify(faction);

  const weapons = [...itemIndex.byType.weapon.values()];
  const equipment = [...itemIndex.byType.equipment.values()];
  const features = [...itemIndex.byType.feat.values()].filter((item) => !item.flags?.[MODULE_ID]?.combatManeuver);

  if (noHands) {
    refs.push(...pickRefs(weapons, /claw|bite|horn|hoof|talon|stomp|tail|fang/i, 2));
  } else if (/archer|bow|ranger|scout|skirmish|waywatch|pistol|handgun|crossbow|jezzail|gun/i.test(lower)) {
    refs.push(...pickRefs(weapons, /bow|crossbow|handgun|pistol|jezzail|sling/i, 3));
  } else if (/caval|knight|lance|spear|pike|halberd|guard/i.test(lower)) {
    refs.push(...pickRefs(weapons, /lance|spear|pike|halberd|glaive/i, 3));
  } else if (isCaster(actor)) {
    refs.push(...pickRefs(weapons, /staff|dagger|wand|rod|blade/i, 2));
  } else {
    refs.push(...pickRefs(weapons, /sword|blade|axe|hammer|mace|spear/i, 3));
  }

  if (!noHands) {
    refs.push(...pickFactionRefs(equipment, factionSlug, 2));
    refs.push(...pickRefs(equipment, /armour|armor|shield|talisman|relic|banner|standard/i, 2));
  }

  refs.push(...pickFactionRefs(weapons, factionSlug, 3));
  refs.push(...pickFactionRefs(features, factionSlug, 4));
  refs.push(...pickRefs(features, /discipline|doctrine|resilience|ward|ferocity|hatred|fear|terror|regeneration/i, 4));

  return unique(refs);
}

function pickFactionRefs(items, factionSlug, limit) {
  return items
    .filter((item) => slugify(`${item.name} ${item.identifier ?? ""}`).includes(factionSlug))
    .slice(0, limit)
    .map((item) => item.uuid);
}

function pickRefs(items, pattern, limit) {
  return items
    .filter((item) => pattern.test(`${item.name} ${item.identifier ?? ""}`))
    .slice(0, limit)
    .map((item) => item.uuid);
}

function selectSpellRefs(actor, faction, spellPool) {
  if (!isCaster(actor)) return [];
  const lower = `${actor.name} ${faction}`.toLowerCase();
  const themes = [];
  if (/fire|khorne|chaos dwarf|daemon/.test(lower)) themes.push("fire");
  if (/vampire|vyrkos|khemri|necromancer|death|tomb/.test(lower)) themes.push("death");
  if (/beast|shaman|wood|lizard/.test(lower)) themes.push("beast");
  if (/bretonnia|empire|high elf|priest/.test(lower)) themes.push("light");
  if (/dark elf|shadow|skaven/.test(lower)) themes.push("shadow");
  if (/nurgle|plague/.test(lower)) themes.push("plague");
  if (!themes.length) themes.push("fire", "shadow");

  const chosen = [];
  for (const theme of themes) {
    for (const spell of spellPool) {
      const text = `${spell.name} ${spell.identifier ?? ""}`.toLowerCase();
      if (SPELL_SETS[theme].some((term) => text.includes(term))) chosen.push(spell.uuid);
      if (chosen.length >= 5) break;
    }
    if (chosen.length >= 5) break;
  }
  if (!chosen.length) chosen.push(...spellPool.slice(0, 3).map((spell) => spell.uuid));
  return unique(chosen).slice(0, 5);
}

function buildItemIndex() {
  const index = {
    byId: new Map(),
    byName: new Map(),
    byType: {
      equipment: new Map(),
      feat: new Map(),
      spell: new Map(),
      weapon: new Map()
    }
  };

  for (const [type, packName] of Object.entries(ITEM_PACKS)) {
    for (const file of jsonFiles(path.join(PACK_ROOT, packName))) {
      const doc = readJson(file);
      indexItem(index, packName, doc, type);
    }
  }
  return index;
}

function indexItem(index, packName, doc, forcedType = null) {
  const type = forcedType || doc.type;
  const uuid = `Compendium.${MODULE_ID}.${packName}.Item.${doc._id}`;
  const entry = {
    _id: doc._id,
    name: doc.name,
    type,
    uuid,
    identifier: doc.system?.identifier || slugify(doc.name),
    flags: doc.flags
  };
  index.byId.set(doc._id, entry);
  index.byName.set(slugify(doc.name), entry);
  if (index.byType[type]) index.byType[type].set(doc._id, entry);
}

function findIndexedItem(item, index) {
  const source = item._stats?.compendiumSource || item.flags?.core?.sourceId || item.flags?.dnd5e?.sourceId;
  if (typeof source === "string") {
    const id = source.split(".").pop();
    if (index.byId.has(id)) return index.byId.get(id);
  }
  if (item._id && index.byId.has(item._id)) return index.byId.get(item._id);
  return index.byName.get(slugify(item.name));
}

function classifyActorRole(actor) {
  const lower = actor.name.toLowerCase();
  if (/dragon|daemon prince|bloodthirster|lord of change|keeper of secrets|great unclean|verminlord|hydra|sphinx|stonehorn|thundertusk|carnosaur|arachnarok|destroyer/.test(lower)) return "solo";
  if (/king|queen|lord|prince|tyrant|prophet|general|captain|thane|chieftain|warlord|baron|duke|paladin|vampire count|grey seer|belladamma|radukar/.test(lower)) return "lord";
  if (isCaster(actor)) return "caster";
  if (/rider|archer|crossbow|handgun|jezzail|slinger|scout|shade|waywatcher|pistol|outrider/.test(lower)) return "ranger";
  if (/cannon|mortar|catapult|bolt|rocket|thrower|battery|trebuchet|engine/.test(lower)) return "artillery";
  if (/guard|warrior|knight|chosen|iron|greatsword|black orc|grave guard|temple guard/.test(lower)) return "major";
  return "minor";
}

function isCaster(actor) {
  return /wizard|mage|magister|shaman|sorcer|seer|priest|damsel|prophetess|spellsinger|spellweaver|necromancer|daemon|herald|lord of change|tzeentch|lich|slann/.test(actor.name.toLowerCase());
}

function rebalanceCr(originalCr, role, name) {
  const base = Number.isFinite(originalCr) ? originalCr : 1;
  const modifier = {
    minor: -1,
    ranger: 0,
    artillery: 0,
    major: 1,
    caster: 1,
    lord: 2,
    solo: 3
  }[role] ?? 0;
  const nameBoost = /dragon|greater|ancient|emperor|king|queen/.test(name.toLowerCase()) ? 2 : 0;
  return clamp(roundHalf(base + modifier + nameBoost), 0.125, 30);
}

function benchmarkStats(cr, role, actor) {
  const level = Math.max(0, Math.round(cr));
  const roleHp = { minor: 12, ranger: 13, artillery: 11, major: 16, caster: 12, lord: 18, solo: 24 }[role] ?? 14;
  const roleAc = { minor: 0, ranger: 0, artillery: -1, major: 1, caster: 0, lord: 2, solo: 2 }[role] ?? 0;
  const hp = Math.max(7, Math.round((18 + level * roleHp) * (role === "solo" ? 1.35 : 1)));
  const ac = clampInt(13 + Math.floor(level / 3) + roleAc, 11, 23);
  const prof = proficiencyForCr(cr);
  const dc = clampInt(11 + Math.floor(level / 2) + (role === "caster" ? 2 : role === "solo" ? 1 : 0), 10, 24);
  const lower = actor.name.toLowerCase();
  const physical = role === "major" || role === "solo" || role === "lord";
  const agile = /elf|skaven|rider|scout|shade|assassin|harpy|wolf|eagle/.test(lower);
  const brute = /ogre|troll|bull|minotaur|dragon|giant|stonehorn|carnosaur|stegadon/.test(lower);
  const caster = role === "caster";
  return {
    hp,
    ac,
    prof,
    dc,
    spellcasting: caster ? (lower.includes("priest") || lower.includes("shaman") ? "wis" : "int") : "",
    spellLevel: caster ? Math.max(1, Math.min(20, level)) : 0,
    str: clampInt((brute ? 16 : physical ? 14 : 10) + Math.floor(level / 5), 6, 24),
    dex: clampInt((agile ? 16 : role === "artillery" ? 12 : 10) + Math.floor(level / 6), 6, 22),
    con: clampInt((brute || physical ? 16 : 12) + Math.floor(level / 5), 8, 24),
    int: clampInt((caster ? 16 : /dwarf|elf|skaven|lizard/.test(lower) ? 12 : 9) + Math.floor(level / 7), 3, 22),
    wis: clampInt((caster && /priest|shaman|druid|slann/.test(lower) ? 16 : 11) + Math.floor(level / 7), 6, 22),
    cha: clampInt((role === "lord" || role === "solo" ? 16 : caster ? 13 : 10) + Math.floor(level / 7), 4, 22),
    pf2eBand: `${role}-moderate`
  };
}

function proficiencyForCr(cr) {
  if (cr >= 29) return 9;
  if (cr >= 25) return 8;
  if (cr >= 21) return 7;
  if (cr >= 17) return 6;
  if (cr >= 13) return 5;
  if (cr >= 9) return 4;
  if (cr >= 5) return 3;
  return 2;
}

function xpForCr(cr) {
  const table = new Map([
    [0, 10], [0.125, 25], [0.25, 50], [0.5, 100], [1, 200], [2, 450], [3, 700], [4, 1100],
    [5, 1800], [6, 2300], [7, 2900], [8, 3900], [9, 5000], [10, 5900], [11, 7200], [12, 8400],
    [13, 10000], [14, 11500], [15, 13000], [16, 15000], [17, 18000], [18, 20000], [19, 22000],
    [20, 25000], [21, 33000], [22, 41000], [23, 50000], [24, 62000], [25, 75000], [26, 90000],
    [27, 105000], [28, 120000], [29, 135000], [30, 155000]
  ]);
  const key = [...table.keys()].reduce((best, value) => Math.abs(value - cr) < Math.abs(best - cr) ? value : best, 0);
  return table.get(key);
}

function deleteConversionJournals() {
  const dir = path.join(PACK_ROOT, "conversion-journals");
  if (!fs.existsSync(dir)) return;
  for (const file of jsonFiles(dir)) {
    fs.unlinkSync(file);
    counts.journalsDeleted++;
  }
}

function updateManifest() {
  const file = path.join(ROOT, "module.json");
  const manifest = readJson(file);
  manifest.description = "Faction compendiums for Warhammer: The Old World adapted to D&D 5e for Foundry VTT v14.";
  manifest.relationships ??= {};
  manifest.relationships.systems = [{
    id: "dnd5e",
    type: "system",
    compatibility: { minimum: SYSTEM_VERSION }
  }];
  manifest.relationships.requires = [
    {
      id: "socketlib",
      type: "module",
      manifest: "https://github.com/farling42/foundryvtt-socketlib/releases/latest/download/module.json",
      compatibility: { minimum: "1.1.0" }
    },
    {
      id: "ATL",
      type: "module",
      manifest: "https://github.com/kandashi/Active-Token-Lighting/releases/latest/download/module.json",
      compatibility: { minimum: "1.0.0" }
    }
  ];
  manifest.packs = (manifest.packs ?? []).filter((pack) => pack.name !== "conversion-journals").map((pack) => ({
    ...pack,
    label: cleanPackLabel(pack.name),
    ownership: pack.ownership ?? { PLAYER: "OBSERVER", ASSISTANT: "OWNER" }
  }));
  manifest.packFolders = buildPackFolders();
  manifest.languages = [
    { lang: "en", name: "English", path: "lang/en.json" },
    { lang: "ru", name: "Russian", path: "lang/ru.json" }
  ];
  manifest.esmodules = ["scripts/module.js"];
  writeJson(file, manifest);
}

function updateRuntimeScript() {
  const file = path.join(ROOT, "scripts", "module.js");
  const content = `const MODULE_ID = "warhammer-to-dnd";

Hooks.once("socketlib.ready", () => {
  const socket = socketlib.registerModule(MODULE_ID);
  socket.register("resolveDiseaseSave", resolveDiseaseSave);
});

function resolveDiseaseSave({ dc, bonus = 0 } = {}) {
  const roll = new Roll("1d20 + @bonus", { bonus: Number(bonus) || 0 });
  roll.evaluateSync();
  return {
    total: roll.total,
    dc: Number(dc) || 10,
    success: roll.total >= (Number(dc) || 10)
  };
}
`;
  fs.writeFileSync(file, content, "utf8");
}

function updateLanguages() {
  const en = {
    WARHAMMER_TO_DND: {
      module: {
        title: "Warhammer: The Old World to D&D 5e",
        description: "Faction compendiums and universal item libraries for Old World battles."
      },
      dependencies: {
        socketlib: "Socketlib automation bridge",
        ATL: "Active Token Effects integration"
      },
      packs: Object.fromEntries([...ACTOR_PACKS, "warhammer-weapons", "warhammer-features", "warhammer-equipment", "warhammer-spells"].map((pack) => [
        pack,
        { label: cleanPackLabel(pack) }
      ])),
      folders: {
        root: "Warhammer Armies",
        actors: "Faction Actors",
        items: "Universal Armory"
      },
      maneuvers: {
        shieldwallAdvance: "Shieldwall Advance",
        brutalFeint: "Brutal Feint",
        hookAndDrag: "Hook and Drag",
        arcanePressure: "Arcane Pressure",
        terrorSurge: "Terror Surge",
        skirmishersSlip: "Skirmisher's Slip"
      }
    }
  };
  writeJson(path.join(ROOT, "lang", "en.json"), en);
  writeJson(path.join(ROOT, "lang", "ru.json"), buildRussianLanguage());
}

function buildRussianLanguage() {
  return {
    WARHAMMER_TO_DND: {
      module: {
        title: "\u0057\u0061\u0072\u0068\u0061\u006d\u006d\u0065\u0072: \u0421\u0442\u0430\u0440\u044b\u0439 \u0421\u0432\u0435\u0442 \u0434\u043b\u044f D&D 5e",
        description: "\u041a\u043e\u043c\u043f\u0435\u043d\u0434\u0438\u0443\u043c\u044b \u0430\u0440\u043c\u0438\u0439 \u0438 \u0443\u043d\u0438\u0432\u0435\u0440\u0441\u0430\u043b\u044c\u043d\u044b\u0435 \u0431\u0438\u0431\u043b\u0438\u043e\u0442\u0435\u043a\u0438 \u043f\u0440\u0435\u0434\u043c\u0435\u0442\u043e\u0432 \u0434\u043b\u044f \u0441\u0440\u0430\u0436\u0435\u043d\u0438\u0439 \u0421\u0442\u0430\u0440\u043e\u0433\u043e \u0421\u0432\u0435\u0442\u0430."
      },
      dependencies: {
        socketlib: "\u041c\u043e\u0441\u0442 \u0430\u0432\u0442\u043e\u043c\u0430\u0442\u0438\u0437\u0430\u0446\u0438\u0438 Socketlib",
        ATL: "\u0418\u043d\u0442\u0435\u0433\u0440\u0430\u0446\u0438\u044f Active Token Effects"
      },
      packs: Object.fromEntries([...ACTOR_PACKS, "warhammer-weapons", "warhammer-features", "warhammer-equipment", "warhammer-spells"].map((pack) => [
        pack,
        { label: translatePackLabelRu(cleanPackLabel(pack)) }
      ])),
      folders: {
        root: "\u0410\u0440\u043c\u0438\u0438 Warhammer",
        actors: "\u0410\u043a\u0442\u0451\u0440\u044b \u0444\u0440\u0430\u043a\u0446\u0438\u0439",
        items: "\u0423\u043d\u0438\u0432\u0435\u0440\u0441\u0430\u043b\u044c\u043d\u0430\u044f \u043e\u0440\u0443\u0436\u0435\u0439\u043d\u0430\u044f"
      },
      maneuvers: {
        shieldwallAdvance: "\u041d\u0430\u0441\u0442\u0443\u043f\u043b\u0435\u043d\u0438\u0435 \u0449\u0438\u0442\u043e\u0432\u043e\u0439 \u0441\u0442\u0435\u043d\u044b",
        brutalFeint: "\u0416\u0435\u0441\u0442\u043e\u043a\u0438\u0439 \u0444\u0438\u043d\u0442",
        hookAndDrag: "\u0417\u0430\u0446\u0435\u043f \u0438 \u0440\u044b\u0432\u043e\u043a",
        arcanePressure: "\u041c\u0430\u0433\u0438\u0447\u0435\u0441\u043a\u043e\u0435 \u0434\u0430\u0432\u043b\u0435\u043d\u0438\u0435",
        terrorSurge: "\u0412\u043e\u043b\u043d\u0430 \u0443\u0436\u0430\u0441\u0430",
        skirmishersSlip: "\u0423\u0445\u043e\u0434 \u0437\u0430\u0441\u0442\u0440\u0435\u043b\u044c\u0449\u0438\u043a\u0430"
      }
    }
  };
}

function buildPackFolders() {
  return [{
    name: "Warhammer Armies",
    sorting: "a",
    color: "#651414",
    packs: [],
    folders: [
      {
        name: "Faction Actors",
        sorting: "a",
        color: "#8a1f1f",
        packs: ACTOR_PACKS
      },
      {
        name: "Universal Armory",
        sorting: "a",
        color: "#4f6f52",
        packs: ["warhammer-equipment", "warhammer-features", "warhammer-spells", "warhammer-weapons"]
      }
    ]
  }];
}

function factionFromPack(packName) {
  return factionFromSlug(packName.replace(/-actors$/, ""));
}

function factionFromName(name) {
  const slug = slugify(name);
  return Object.entries(FACTIONS).find(([key]) => slug.includes(key))?.[1] ?? "the Old World";
}

function factionFromSlug(slug) {
  return FACTIONS[slug] ?? "the Old World";
}

function languagesForFaction(faction) {
  if (/Dwarf/.test(faction)) return ["dwarvish"];
  if (/Elf/.test(faction)) return ["elvish"];
  if (/Skaven/.test(faction)) return ["undercommon"];
  if (/Khemri|Vampire|Vyrkos/.test(faction)) return ["common"];
  if (/Daemon|Chaos|Beastmen/.test(faction)) return ["abyssal"];
  return ["common"];
}

function alignmentForFaction(faction) {
  if (/Daemon|Chaos|Skaven|Vampire|Vyrkos|Dark/.test(faction)) return "any evil alignment";
  if (/Bretonnia|Empire|High Elf|Dwarfen/.test(faction)) return "any non-evil alignment";
  return "unaligned";
}

function inferCreatureType(name) {
  const lower = name.toLowerCase();
  if (/daemon|demon|bloodletter|horror|plaguebearer|slaanesh|tzeentch|nurgle|khorne/.test(lower)) return "fiend";
  if (/skeleton|zombie|vampire|wraith|ghost|banshee|ghoul|necromancer|tomb|mortis/.test(lower)) return "undead";
  if (/dragon|hydra|griffon|chimera|phoenix|manticore/.test(lower)) return "dragon";
  if (/rat|wolf|hound|eagle|horse|boar|squig|carnosaur|stegadon|bastiladon|troglodon/.test(lower)) return "beast";
  if (/treeman|dryad|tree/.test(lower)) return "plant";
  if (/tank|cannon|engine|chariot|altar|construct/.test(lower)) return "construct";
  return "humanoid";
}

function sizeForName(name) {
  const lower = name.toLowerCase();
  if (/dragon|giant|hydra|stegadon|stonehorn|thundertusk|arachnarok|sphinx|destroyer|greater|bloodthirster|lord of change|keeper of secrets|great unclean/.test(lower)) return "huge";
  if (/ogre|troll|minotaur|bull|carnosaur|taurus|lammasu|manticore|chariot|tank|cannon|treeman|phoenix/.test(lower)) return "lg";
  if (/swarm|bat|snotling/.test(lower)) return "sm";
  return "med";
}

function inferSpellLevel(name) {
  const lower = name.toLowerCase();
  if (/apotheosis|comet|purple sun|dwellers|final/.test(lower)) return 5;
  if (/storm|doom|curse|vortex/.test(lower)) return 4;
  if (/blast|fireball|wind|plague/.test(lower)) return 3;
  if (/bolt|blade|ward/.test(lower)) return 2;
  return 1;
}

function quoteFor(seed) {
  const hash = Number.parseInt(deterministicId(seed).slice(0, 4), 16);
  return QUOTES[hash % QUOTES.length];
}

function cleanPackLabel(packName) {
  return packName
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace(/\bActors\b/, "Actors")
    .replace(/\bDnd\b/, "D&D");
}

function translatePackLabel(label) {
  return label
    .replace("Actors", "актеры")
    .replace("Warhammer Weapons", "Оружие Warhammer")
    .replace("Warhammer Features", "Способности Warhammer")
    .replace("Warhammer Equipment", "Снаряжение Warhammer")
    .replace("Warhammer Spells", "Заклинания Warhammer");
}

function translatePackLabelRu(label) {
  return label
    .replace("Beastmen Brayherds Actors", "\u0410\u043a\u0442\u0451\u0440\u044b \u0437\u0432\u0435\u0440\u043e\u043b\u044e\u0434\u043e\u0432")
    .replace("Chaos Dwarfs Actors", "\u0410\u043a\u0442\u0451\u0440\u044b \u0445\u0430\u043e\u0441-\u0434\u0432\u0430\u0440\u0444\u043e\u0432")
    .replace("Daemons Of Chaos Actors", "\u0410\u043a\u0442\u0451\u0440\u044b \u0434\u0435\u043c\u043e\u043d\u043e\u0432 \u0425\u0430\u043e\u0441\u0430")
    .replace("Dark Elf Actors", "\u0410\u043a\u0442\u0451\u0440\u044b \u0442\u0451\u043c\u043d\u044b\u0445 \u044d\u043b\u044c\u0444\u043e\u0432")
    .replace("Dwarfen Mountain Holds Actors", "\u0410\u043a\u0442\u0451\u0440\u044b \u0433\u043e\u0440\u043d\u044b\u0445 \u0442\u0432\u0435\u0440\u0434\u044b\u043d\u044c \u0434\u0432\u0430\u0440\u0444\u043e\u0432")
    .replace("Empire Of Man Actors", "\u0410\u043a\u0442\u0451\u0440\u044b \u0418\u043c\u043f\u0435\u0440\u0438\u0438")
    .replace("High Elf Realms Actors", "\u0410\u043a\u0442\u0451\u0440\u044b \u0432\u044b\u0441\u0448\u0438\u0445 \u044d\u043b\u044c\u0444\u043e\u0432")
    .replace("Khemri Actors", "\u0410\u043a\u0442\u0451\u0440\u044b \u041a\u0445\u0435\u043c\u0440\u0438")
    .replace("Kingdom Of Bretonnia Actors", "\u0410\u043a\u0442\u0451\u0440\u044b \u0411\u0440\u0435\u0442\u043e\u043d\u043d\u0438\u0438")
    .replace("Lizardmen Actors", "\u0410\u043a\u0442\u0451\u0440\u044b \u044f\u0449\u0435\u0440\u043e\u043b\u044e\u0434\u043e\u0432")
    .replace("Ogre Kingdoms Actors", "\u0410\u043a\u0442\u0451\u0440\u044b \u043a\u043e\u0440\u043e\u043b\u0435\u0432\u0441\u0442\u0432 \u043e\u0433\u0440\u043e\u0432")
    .replace("Orc And Goblin Tribes Actors", "\u0410\u043a\u0442\u0451\u0440\u044b \u043f\u043b\u0435\u043c\u0451\u043d \u043e\u0440\u043a\u043e\u0432 \u0438 \u0433\u043e\u0431\u043b\u0438\u043d\u043e\u0432")
    .replace("Skaven Actors", "\u0410\u043a\u0442\u0451\u0440\u044b \u0441\u043a\u0430\u0432\u0435\u043d\u043e\u0432")
    .replace("Vampire Counts Actors", "\u0410\u043a\u0442\u0451\u0440\u044b \u0413\u0440\u0430\u0444\u0441\u0442\u0432 \u0432\u0430\u043c\u043f\u0438\u0440\u043e\u0432")
    .replace("Vyrkos Dynasty Actors", "\u0410\u043a\u0442\u0451\u0440\u044b \u0434\u0438\u043d\u0430\u0441\u0442\u0438\u0438 \u0412\u044b\u0440\u043a\u043e\u0441")
    .replace("Warriors Of Chaos Khorne Actors", "\u0410\u043a\u0442\u0451\u0440\u044b \u0432\u043e\u0438\u043d\u043e\u0432 \u0425\u0430\u043e\u0441\u0430: \u041a\u0445\u043e\u0440\u043d")
    .replace("Warriors Of Chaos Tzeentch Actors", "\u0410\u043a\u0442\u0451\u0440\u044b \u0432\u043e\u0438\u043d\u043e\u0432 \u0425\u0430\u043e\u0441\u0430: \u0422\u0437\u0438\u043d\u0447")
    .replace("Warriors Of Chaos Actors", "\u0410\u043a\u0442\u0451\u0440\u044b \u0432\u043e\u0438\u043d\u043e\u0432 \u0425\u0430\u043e\u0441\u0430")
    .replace("Wood Elf Realms Actors", "\u0410\u043a\u0442\u0451\u0440\u044b \u043b\u0435\u0441\u043d\u044b\u0445 \u044d\u043b\u044c\u0444\u043e\u0432")
    .replace("Warhammer Weapons", "\u041e\u0440\u0443\u0436\u0438\u0435 Warhammer")
    .replace("Warhammer Features", "\u0421\u043f\u043e\u0441\u043e\u0431\u043d\u043e\u0441\u0442\u0438 Warhammer")
    .replace("Warhammer Equipment", "\u0421\u043d\u0430\u0440\u044f\u0436\u0435\u043d\u0438\u0435 Warhammer")
    .replace("Warhammer Spells", "\u0417\u0430\u043a\u043b\u0438\u043d\u0430\u043d\u0438\u044f Warhammer");
}

function cleanDisplayName(name) {
  return cleanName(name)
    .replace(/\s*\[[^\]]*[\u0400-\u04FF][^\]]*\]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanName(name) {
  return sanitizeText(name).replace(/\s+/g, " ").trim();
}

function slugify(value) {
  return String(value)
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-");
}

function deterministicId(seed) {
  return crypto.createHash("sha1").update(seed).digest("hex").slice(0, 16);
}

function unique(values) {
  return [...new Set(values.filter((value) => value !== undefined && value !== null && value !== ""))];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function clampInt(value, min, max) {
  return Math.round(clamp(value, min, max));
}

function roundHalf(value) {
  return Math.round(value * 2) / 2;
}

function escapeHtml(value) {
  return sanitizeText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sanitizeText(value) {
  return String(value)
    .replace(/[\u2013\u2014]/gu, "-")
    .replace(/[\u2018\u2019]/gu, "'")
    .replace(/[\u201c\u201d]/gu, "\"")
    .replace(/\u00a0/gu, " ");
}

function sanitizeObjectStrings(value) {
  if (typeof value === "string") return sanitizeText(value);
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) value[i] = sanitizeObjectStrings(value[i]);
    return value;
  }
  if (isPlainObject(value)) {
    for (const [key, entry] of Object.entries(value)) value[key] = sanitizeObjectStrings(entry);
  }
  return value;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function jsonFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return jsonFiles(full);
    return entry.isFile() && entry.name.endsWith(".json") ? [full] : [];
  });
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  sanitizeObjectStrings(value);
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

main();
