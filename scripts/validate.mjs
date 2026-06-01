import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_SOURCE_ROOT = "src/packs";
const DEFAULT_MANIFEST = "module.json";

const STRICT_DND5E_ITEM_TYPES = new Set(["weapon", "equipment", "spell", "feat"]);

// This validator intentionally targets only the dnd5e v5.3.3 Item models that
// are produced by this module and explicitly requested for strict validation.
const DND5E_ITEM_TYPES = STRICT_DND5E_ITEM_TYPES;

const DND5E_ACTOR_TYPES = new Set(["character", "npc", "vehicle", "group"]);

const VALID_DOCUMENT_NAMES = new Set(["Actor", "Item", "JournalEntry"]);

const ITEM_VALIDATORS = new Map([
  ["weapon", validateWeaponItem],
  ["spell", validateSpellItem],
  ["feat", validateFeatItem],
  ["equipment", validateEquipmentItem]
]);

const ACTOR_VALIDATORS = new Map([
  ["character", validateCharacterActor],
  ["npc", validateNpcActor],
  ["vehicle", validateGenericActor],
  ["group", validateGenericActor]
]);

export function validateDocument(document, options = {}) {
  const identified = identifyDocumentType(document, options);

  if (!identified.ok) {
    return {
      ok: false,
      valid: false,
      documentName: null,
      type: null,
      errors: identified.errors
    };
  }

  if (identified.documentName === "Item") {
    const strictResult = validateItemJSON(document);
    return {
      ok: strictResult.isValid,
      valid: strictResult.isValid,
      documentName: "Item",
      type: typeof document?.type === "string" ? document.type : null,
      errors: strictResult.errors.map((message) => ({ path: "Item", message }))
    };
  }

  const errors = [];
  identified.validate(document, errors);

  return {
    ok: errors.length === 0,
    valid: errors.length === 0,
    documentName: identified.documentName,
    type: identified.type,
    errors
  };
}

/**
 * Strict two-step dnd5e v5.3.3 Item JSON validation for Foundry VTT v14.
 *
 * Step 1 identifies the top-level Item type and requires one of:
 *   weapon, equipment, spell, feat
 *
 * Step 2 validates the common Foundry document envelope and the type-specific
 * dnd5e system model, including dynamic system.activities entries.
 *
 * @param {object} data - Parsed Item JSON document.
 * @returns {{isValid: boolean, errors: string[]}}
 */
export function validateItemJSON(data) {
  const errors = [];

  if (!strictIsPlainObject(data)) {
    return { isValid: false, errors: ["root: Item document must be a JSON object."] };
  }

  const type = data.type;
  if (typeof type !== "string" || type.trim() === "") {
    errors.push(`type: Missing required top-level type. Allowed item types: ${[...STRICT_DND5E_ITEM_TYPES].join(", ")}.`);
    return { isValid: false, errors };
  }

  if (!STRICT_DND5E_ITEM_TYPES.has(type)) {
    errors.push(`type: Unsupported dnd5e Item type '${type}'. Allowed item types: ${[...STRICT_DND5E_ITEM_TYPES].join(", ")}.`);
    return { isValid: false, errors };
  }

  validateStrictCommonItemFields(data, errors);
  const system = strictExpectObject(data, "system", errors);
  if (system) {
    validateStrictActivities(system, errors);
    if (type === "weapon") validateStrictWeaponSystem(system, errors);
    else if (type === "equipment") validateStrictEquipmentSystem(system, errors);
    else if (type === "spell") validateStrictSpellSystem(system, errors);
    else if (type === "feat") validateStrictFeatSystem(system, errors);
  }

  return { isValid: errors.length === 0, errors };
}


function validateStrictCommonItemFields(data, errors) {
  strictExpectPath(data, "name", ["string"], errors, { nonEmpty: true });
  strictExpectPath(data, "_id", ["string"], errors, { pattern: /^[A-Za-z0-9]{16}$/u, patternName: "16-character alphanumeric string" });
  strictExpectPath(data, "img", ["string", "null"], errors);
  strictExpectPath(data, "effects", ["array"], errors);
  strictExpectPath(data, "folder", ["string", "null"], errors);
  strictExpectPath(data, "sort", ["number"], errors, { finite: true });

  const stats = strictExpectObject(data, "_stats", errors);
  if (stats) {
    const coreVersion = strictExpectPath(data, "_stats.coreVersion", ["string"], errors);
    if (coreVersion && !coreVersion.startsWith("14")) {
      errors.push(`_stats.coreVersion: Expected Foundry VTT v14 coreVersion, got '${coreVersion}'.`);
    }
    strictExpectExact(data, "_stats.systemId", "dnd5e", errors);
    strictExpectExact(data, "_stats.systemVersion", "5.3.3", errors);
  }

  const ownership = strictExpectObject(data, "ownership", errors);
  if (ownership) {
    for (const [userId, permission] of Object.entries(ownership)) {
      if (typeof permission !== "number" || !Number.isFinite(permission)) {
        errors.push(`ownership.${userId}: Expected numeric permission level, got ${strictTypeOf(permission)}.`);
      }
    }
  }

  strictExpectObject(data, "flags", errors);
  strictExpectObject(data, "system", errors);
}

function validateStrictActivities(system, errors) {
  const activities = strictExpectObject(system, "system.activities", errors);
  if (!activities) return;

  for (const [activityId, activity] of Object.entries(activities)) {
    const basePath = `system.activities.${activityId}`;

    if (!/^[A-Za-z0-9]+$/u.test(activityId)) {
      errors.push(`${basePath}: Activity key must be alphanumeric.`);
    }

    if (!strictIsPlainObject(activity)) {
      errors.push(`${basePath}: Expected Activity object, got ${strictTypeOf(activity)}.`);
      continue;
    }

    const activityRoot = { system: { activities: { [activityId]: activity } } };

    strictExpectPath(activityRoot, `${basePath}.type`, ["string"], errors, { nonEmpty: true });

    validateStrictActivation(activityRoot, `${basePath}.activation`, errors);
    validateStrictConsumption(activityRoot, `${basePath}.consumption`, errors);
    validateStrictDuration(activityRoot, `${basePath}.duration`, errors);
    validateStrictRange(activityRoot, `${basePath}.range`, errors);
    validateStrictTarget(activityRoot, `${basePath}.target`, errors);
    validateStrictUses(activityRoot, `${basePath}.uses`, errors);

    if (strictHasOwn(activity, "attack")) validateStrictActivityAttack(activityRoot, `${basePath}.attack`, errors);
    if (strictHasOwn(activity, "damage")) validateStrictActivityDamage(activityRoot, `${basePath}.damage`, errors);

    if (activity.type === "attack") {
      strictExpectObject(activityRoot, `${basePath}.attack`, errors);
      strictExpectObject(activityRoot, `${basePath}.damage`, errors);
    }
  }
}

function validateStrictWeaponSystem(system, errors) {
  validateStrictDescription(system, errors);
  validateStrictItemTypeObject(system, "system.type", errors, { requiresBaseItem: true, requiresSubtype: false });

  const damage = strictExpectObject(system, "system.damage", errors);
  if (damage) {
    const base = strictExpectObject(system, "system.damage.base", errors);
    if (base) {
      strictExpectArrayOfStrings(system, "system.damage.base.types", errors);
      strictExpectPath(system, "system.damage.base.number", ["number"], errors, { integer: true, min: 0 });
      strictExpectPath(system, "system.damage.base.denomination", ["number"], errors, { integer: true, min: 0 });
      strictExpectPath(system, "system.damage.base.bonus", ["string"], errors);
    }

    if (strictHasOwn(damage, "parts")) validateStrictDamageParts(damage.parts, "system.damage.parts", errors);
    if (strictHasOwn(damage, "versatile")) validateStrictDamageData(system.damage.versatile, "system.damage.versatile", errors);
  }

  if (strictHasOwn(system, "properties")) strictExpectArrayOfStrings(system, "system.properties", errors);
  if (strictHasOwn(system, "proficient")) strictExpectPath(system, "system.proficient", ["number", "null"], errors, { min: 0 });
  if (strictHasOwn(system, "magicalBonus")) strictExpectPath(system, "system.magicalBonus", ["string", "number", "null"], errors);
}

function validateStrictEquipmentSystem(system, errors) {
  validateStrictDescription(system, errors);
  validateStrictItemTypeObject(system, "system.type", errors, { requiresBaseItem: true, requiresSubtype: false });

  const armor = strictExpectObject(system, "system.armor", errors);
  if (armor) {
    strictExpectPath(system, "system.armor.value", ["number"], errors, { integer: true, min: 0 });
    strictExpectPath(system, "system.armor.dex", ["number", "null"], errors, { integer: true });
    strictExpectPath(system, "system.armor.magicalBonus", ["string", "number", "null"], errors);
  }

  if (strictHasOwn(system, "properties")) strictExpectArrayOfStrings(system, "system.properties", errors);
  if (strictHasOwn(system, "equipped")) strictExpectPath(system, "system.equipped", ["boolean"], errors);
  if (strictHasOwn(system, "attunement")) strictExpectPath(system, "system.attunement", ["string"], errors);
}

function validateStrictSpellSystem(system, errors) {
  validateStrictDescription(system, errors);

  strictExpectPath(system, "system.level", ["number"], errors, { integer: true, min: 0 });
  strictExpectPath(system, "system.school", ["string"], errors, { nonEmpty: true });
  strictExpectPath(system, "system.ability", ["string"], errors, { required: false });
  strictExpectPath(system, "system.method", ["string"], errors);
  strictExpectPath(system, "system.sourceItem", ["string"], errors, { required: false });

  const materials = strictExpectObject(system, "system.materials", errors);
  if (materials) {
    strictExpectPath(system, "system.materials.value", ["string"], errors);
    strictExpectPath(system, "system.materials.consumed", ["boolean"], errors);
    strictExpectPath(system, "system.materials.cost", ["number"], errors, { min: 0 });
    strictExpectPath(system, "system.materials.supply", ["number"], errors, { min: 0 });
  }

  strictExpectPath(system, "system.prepared", ["number"], errors, { integer: true, min: 0 });

  const target = strictExpectObject(system, "system.target", errors);
  if (target) validateStrictTarget(system, "system.target", errors);
  strictExpectObject(system, "system.target.affects", errors);
}

function validateStrictFeatSystem(system, errors) {
  validateStrictDescription(system, errors);

  const prerequisites = strictExpectObject(system, "system.prerequisites", errors);
  if (prerequisites) {
    strictExpectPath(system, "system.prerequisites.items", ["array"], errors);
    strictExpectPath(system, "system.prerequisites.repeatable", ["boolean"], errors);
    strictExpectPath(system, "system.prerequisites.level", ["number", "null"], errors, { integer: true, min: 0 });
  }

  strictExpectPath(system, "system.requirements", ["string"], errors);
  validateStrictItemTypeObject(system, "system.type", errors, { requiresBaseItem: false, requiresSubtype: true });
  if (strictHasOwn(system, "properties")) strictExpectArrayOfStrings(system, "system.properties", errors);
}

function validateStrictDescription(system, errors) {
  if (!strictHasOwn(system, "description")) return;
  const description = strictExpectObject(system, "system.description", errors);
  if (!description) return;
  if (strictHasOwn(description, "value")) strictExpectPath(system, "system.description.value", ["string", "null"], errors);
  if (strictHasOwn(description, "chat")) strictExpectPath(system, "system.description.chat", ["string", "null"], errors);
}

function validateStrictActivation(root, pathName, errors) {
  const activation = strictExpectObject(root, pathName, errors);
  if (!activation) return;
  strictExpectPath(root, `${pathName}.type`, ["string"], errors);
  strictExpectPath(root, `${pathName}.value`, ["number", "null"], errors, { required: false, min: 0 });
  strictExpectPath(root, `${pathName}.condition`, ["string"], errors, { required: false });
}

function validateStrictConsumption(root, pathName, errors) {
  const consumption = strictExpectObject(root, pathName, errors);
  if (!consumption) return;
  strictExpectArray(root, `${pathName}.targets`, errors, { required: false });
  strictExpectPath(root, `${pathName}.scaling`, ["object"], errors, { required: false });
  strictExpectPath(root, `${pathName}.spellSlot`, ["boolean"], errors, { required: false });
}

function validateStrictDuration(root, pathName, errors) {
  const duration = strictExpectObject(root, pathName, errors);
  if (!duration) return;
  strictExpectPath(root, `${pathName}.units`, ["string"], errors);
  strictExpectPath(root, `${pathName}.concentration`, ["boolean"], errors, { required: false });
  strictExpectPath(root, `${pathName}.value`, ["string", "number", "null"], errors, { required: false });
}

function validateStrictRange(root, pathName, errors) {
  const range = strictExpectObject(root, pathName, errors);
  if (!range) return;
  strictExpectPath(root, `${pathName}.units`, ["string"], errors);
  strictExpectPath(root, `${pathName}.value`, ["string", "number", "null"], errors, { min: 0, required: false });
  strictExpectPath(root, `${pathName}.long`, ["string", "number", "null"], errors, { min: 0, required: false });
  strictExpectPath(root, `${pathName}.special`, ["string"], errors, { required: false });
}

function validateStrictTarget(root, pathName, errors) {
  const target = strictExpectObject(root, pathName, errors);
  if (!target) return;

  if (strictHasOwn(target, "template")) {
    const template = strictExpectObject(root, `${pathName}.template`, errors);
    if (template) {
      strictExpectPath(root, `${pathName}.template.type`, ["string"], errors, { required: false });
      strictExpectPath(root, `${pathName}.template.units`, ["string"], errors, { required: false });
      strictExpectPath(root, `${pathName}.template.count`, ["string", "number", "null"], errors, { required: false });
      strictExpectPath(root, `${pathName}.template.size`, ["string", "number", "null"], errors, { required: false, min: 0 });
      strictExpectPath(root, `${pathName}.template.width`, ["string", "number", "null"], errors, { required: false, min: 0 });
      strictExpectPath(root, `${pathName}.template.height`, ["string", "number", "null"], errors, { required: false, min: 0 });
    }
  }

  if (strictHasOwn(target, "affects")) {
    const affects = strictExpectObject(root, `${pathName}.affects`, errors);
    if (affects) {
      strictExpectPath(root, `${pathName}.affects.type`, ["string"], errors, { required: false });
      strictExpectPath(root, `${pathName}.affects.count`, ["string", "number", "null"], errors, { required: false });
      strictExpectPath(root, `${pathName}.affects.choice`, ["boolean"], errors, { required: false });
      strictExpectPath(root, `${pathName}.affects.special`, ["string"], errors, { required: false });
    }
  }

  strictExpectPath(root, `${pathName}.prompt`, ["boolean"], errors, { required: false });
}

function validateStrictUses(root, pathName, errors) {
  const uses = strictExpectObject(root, pathName, errors);
  if (!uses) return;
  strictExpectPath(root, `${pathName}.spent`, ["number"], errors, { integer: true, min: 0, required: false });
  strictExpectPath(root, `${pathName}.max`, ["string", "number", "null"], errors, { required: false });
  strictExpectPath(root, `${pathName}.recovery`, ["array"], errors, { required: false });
  strictExpectPath(root, `${pathName}.prompt`, ["boolean"], errors, { required: false });
}

function validateStrictActivityAttack(root, pathName, errors) {
  const attack = strictExpectObject(root, pathName, errors);
  if (!attack) return;
  const attackType = strictExpectPath(root, `${pathName}.type`, ["string", "object"], errors, { required: false });
  if (strictIsPlainObject(attackType)) {
    strictExpectPath(root, `${pathName}.type.value`, ["string"], errors, { required: false });
    strictExpectPath(root, `${pathName}.type.classification`, ["string"], errors, { required: false });
  }
  strictExpectPath(root, `${pathName}.bonus`, ["string"], errors, { required: false });
  strictExpectPath(root, `${pathName}.flat`, ["boolean"], errors, { required: false });
  strictExpectPath(root, `${pathName}.ability`, ["string", "null"], errors, { required: false });
  strictExpectPath(root, `${pathName}.critical`, ["object"], errors, { required: false });
}

function validateStrictActivityDamage(root, pathName, errors) {
  const damage = strictExpectObject(root, pathName, errors);
  if (!damage) return;
  if (strictHasOwn(damage, "parts")) validateStrictDamageParts(damage.parts, `${pathName}.parts`, errors);
  if (strictHasOwn(damage, "critical")) strictExpectPath(root, `${pathName}.critical`, ["object"], errors);
  if (strictHasOwn(damage, "includeBase")) strictExpectPath(root, `${pathName}.includeBase`, ["boolean"], errors);
}

function validateStrictItemTypeObject(root, pathName, errors, options = {}) {
  const { requiresBaseItem = false, requiresSubtype = false } = options;
  const typeObject = strictExpectObject(root, pathName, errors);
  if (!typeObject) return;
  strictExpectPath(root, `${pathName}.value`, ["string"], errors, { nonEmpty: true });
  strictExpectPath(root, `${pathName}.baseItem`, ["string"], errors, { required: requiresBaseItem });
  strictExpectPath(root, `${pathName}.subtype`, ["string"], errors, { required: requiresSubtype });
}

function validateStrictDamageParts(parts, pathName, errors) {
  if (!Array.isArray(parts)) {
    errors.push(`${pathName}: Expected array, got ${strictTypeOf(parts)}.`);
    return;
  }

  parts.forEach((part, index) => {
    const partPath = `${pathName}.${index}`;
    if (strictIsPlainObject(part)) {
      validateStrictDamageData(part, partPath, errors);
      return;
    }
    if (!Array.isArray(part)) {
      errors.push(`${partPath}: Expected DamageData object or damage tuple array, got ${strictTypeOf(part)}.`);
      return;
    }
    if (part.length !== 2) {
      errors.push(`${partPath}: Expected damage tuple [formula, damageType], got ${part.length} entries.`);
      return;
    }
    if (typeof part[0] !== "string") errors.push(`${partPath}.0: Expected string formula, got ${strictTypeOf(part[0])}.`);
    if (typeof part[1] !== "string") errors.push(`${partPath}.1: Expected string damage type, got ${strictTypeOf(part[1])}.`);
  });
}

function validateStrictDamageData(part, pathName, errors) {
  if (!strictIsPlainObject(part)) {
    errors.push(`${pathName}: Expected DamageData object, got ${strictTypeOf(part)}.`);
    return;
  }
  strictExpectPath({ part }, "part.number", ["number", "null"], errors, { required: false, integer: true, min: 0 });
  strictExpectPath({ part }, "part.denomination", ["number", "null"], errors, { required: false, integer: true, min: 0 });
  strictExpectPath({ part }, "part.bonus", ["string"], errors, { required: false });
  strictExpectArrayOfStrings({ part }, "part.types", errors, { required: false });
  strictExpectObject({ part }, "part.custom", errors, { required: false });
  strictExpectObject({ part }, "part.scaling", errors, { required: false });
}

function strictExpectObject(root, pathName, errors, options = {}) {
  const value = strictExpectPath(root, pathName, ["object"], errors, options);
  return strictIsPlainObject(value) ? value : null;
}

function strictExpectArray(root, pathName, errors, options = {}) {
  const value = strictExpectPath(root, pathName, ["array"], errors, options);
  return Array.isArray(value) ? value : null;
}

function strictExpectArrayOfStrings(root, pathName, errors, options = {}) {
  const value = strictExpectArray(root, pathName, errors, options);
  if (!value) return null;
  value.forEach((entry, index) => {
    if (typeof entry !== "string") errors.push(`${pathName}.${index}: Expected string, got ${strictTypeOf(entry)}.`);
  });
  return value;
}

function strictExpectExact(root, pathName, expected, errors) {
  const valueResult = strictGetPath(root, pathName);
  if (!valueResult.exists) {
    errors.push(`${pathName}: Missing required field; expected exact value '${expected}'.`);
    return;
  }
  if (valueResult.value !== expected) {
    errors.push(`${pathName}: Expected exact value '${expected}', got '${String(valueResult.value)}'.`);
  }
}

function strictExpectPath(root, pathName, expectedTypes, errors, options = {}) {
  const {
    required = true,
    integer = false,
    finite = false,
    min,
    max,
    nonEmpty = false,
    pattern = null,
    patternName = "required pattern"
  } = options;

  const valueResult = strictGetPath(root, pathName);
  if (!valueResult.exists) {
    if (required) errors.push(`${pathName}: Missing required field; expected ${expectedTypes.join(" or ")}.`);
    return undefined;
  }

  const value = valueResult.value;
  const actualType = strictTypeOf(value);
  if (!expectedTypes.includes(actualType)) {
    errors.push(`${pathName}: Expected ${expectedTypes.join(" or ")}, got ${actualType}.`);
    return value;
  }

  if (actualType === "number") {
    if (finite && !Number.isFinite(value)) errors.push(`${pathName}: Expected a finite number.`);
    if (integer && !Number.isInteger(value)) errors.push(`${pathName}: Expected an integer.`);
    if (min !== undefined && value < min) errors.push(`${pathName}: Expected value >= ${min}.`);
    if (max !== undefined && value > max) errors.push(`${pathName}: Expected value <= ${max}.`);
  }

  if (actualType === "string") {
    if (nonEmpty && value.trim() === "") errors.push(`${pathName}: Expected a non-empty string.`);
    if (pattern && !pattern.test(value)) errors.push(`${pathName}: Expected ${patternName}.`);
  }

  return value;
}

function strictGetPath(root, pathName) {
  const parts = pathName.split(".");
  let current = root;

  for (const part of parts) {
    if (part === "system" && current === root && !strictHasOwn(root, "system")) continue;
    if (part === "system" && current === root && strictHasOwn(root, "system")) {
      current = root.system;
      continue;
    }

    if (!strictIsObjectLike(current) || !strictHasOwn(current, part)) {
      return { exists: false, value: undefined };
    }

    current = current[part];
  }

  return { exists: true, value: current };
}

function strictTypeOf(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value === "object" ? "object" : typeof value;
}

function strictIsObjectLike(value) {
  return value !== null && typeof value === "object";
}

function strictIsPlainObject(value) {
  return strictIsObjectLike(value) && !Array.isArray(value);
}

function strictHasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}


export function identifyDocumentType(document, options = {}) {
  const errors = [];

  if (!isPlainObject(document)) {
    return failIdentify("root", "Document must be a JSON object.");
  }

  if (!hasOwn(document, "type") || document.type === undefined || document.type === null || document.type === "") {
    return failIdentify(
      "type",
      `Missing required top-level type. Supported dnd5e item types: ${[...DND5E_ITEM_TYPES].join(", ")}. ` +
      `Supported dnd5e actor types: ${[...DND5E_ACTOR_TYPES].join(", ")}.`
    );
  }

  if (typeof document.type !== "string") {
    return failIdentify("type", `Expected top-level type to be string, got ${typeOf(document.type)}.`);
  }

  const requestedDocumentName = options.documentName ?? options.documentType ?? null;
  if (requestedDocumentName) {
    if (!VALID_DOCUMENT_NAMES.has(requestedDocumentName)) {
      return failIdentify(
        "documentName",
        `Unsupported Foundry document kind '${requestedDocumentName}'. Expected Actor, Item, or JournalEntry.`
      );
    }

    if (requestedDocumentName === "Item") return identifyItem(document.type);
    if (requestedDocumentName === "Actor") return identifyActor(document.type);
    return identifyJournalEntry(document.type);
  }

  if (DND5E_ITEM_TYPES.has(document.type)) return identifyItem(document.type);
  if (DND5E_ACTOR_TYPES.has(document.type)) return identifyActor(document.type);
  if (document.type === "JournalEntry") return identifyJournalEntry(document.type);

  return failIdentify(
    "type",
    `Unsupported dnd5e document type '${document.type}'. Supported item types: ${[...DND5E_ITEM_TYPES].join(", ")}. ` +
    `Supported actor types: ${[...DND5E_ACTOR_TYPES].join(", ")}.`
  );

  function identifyItem(type) {
    const validate = ITEM_VALIDATORS.get(type);
    if (!validate) {
      return failIdentify("type", `Unsupported dnd5e Item type '${type}'.`);
    }
    return { ok: true, documentName: "Item", type, validate };
  }

  function identifyActor(type) {
    const validate = ACTOR_VALIDATORS.get(type);
    if (!validate) {
      return failIdentify("type", `Unsupported dnd5e Actor type '${type}'.`);
    }
    return { ok: true, documentName: "Actor", type, validate };
  }

  function identifyJournalEntry(type) {
    if (type !== "JournalEntry") {
      return failIdentify("type", `Unsupported JournalEntry type '${type}'. Expected 'JournalEntry'.`);
    }
    return { ok: true, documentName: "JournalEntry", type, validate: validateJournalEntry };
  }

  function failIdentify(pathName, message) {
    errors.push({ path: pathName, message });
    return { ok: false, errors };
  }
}

function validateWeaponItem(document, errors) {
  validateBaseDocument(document, errors, { documentName: "Item", requiresSystem: true });
  const system = expectObject(document, "system", errors);
  if (!system) return;

  validateItemDescription(system, errors);
  validatePhysicalItemTemplate(system, errors);
  validateEquippableItemTemplate(system, errors);
  validateIdentifiableTemplate(system, errors);
  validateActivatedEffectTemplate(system, errors);
  validateActionTemplate(system, errors);
  validateMountableTemplate(system, errors);

  expectItemTypeField(system, "system.type", errors, { subtype: false, baseItem: true });
  expectArrayOfStrings(system, "system.properties", errors, { required: false });
  expectPath(system, "system.magicalBonus", ["number"], errors, { required: false, integer: true, min: 0 });
  expectPath(system, "system.proficient", ["number"], errors, { required: true, integer: true, min: 0, max: 1 });
}

function validateSpellItem(document, errors) {
  validateBaseDocument(document, errors, { documentName: "Item", requiresSystem: true });
  const system = expectObject(document, "system", errors);
  if (!system) return;

  validateItemDescription(system, errors);
  validateActivatedEffectTemplate(system, errors);
  validateActionTemplate(system, errors);

  expectPath(system, "system.level", ["number"], errors, { required: true, integer: true, min: 0 });
  expectPath(system, "system.school", ["string"], errors, { required: true });
  expectPath(system, "system.sourceClass", ["string"], errors, { required: false });
  expectArrayOfStrings(system, "system.properties", errors, { required: false });

  const materials = expectObject(system, "system.materials", errors);
  if (materials) {
    expectPath(system, "system.materials.value", ["string"], errors);
    expectPath(system, "system.materials.consumed", ["boolean"], errors);
    expectPath(system, "system.materials.cost", ["number"], errors, { min: 0 });
    expectPath(system, "system.materials.supply", ["number"], errors, { min: 0 });
  }

  const preparation = expectObject(system, "system.preparation", errors);
  if (preparation) {
    expectPath(system, "system.preparation.mode", ["string"], errors);
    expectPath(system, "system.preparation.prepared", ["boolean"], errors);
  }

  const scaling = expectObject(system, "system.scaling", errors);
  if (scaling) {
    expectPath(system, "system.scaling.mode", ["string"], errors);
    expectPath(system, "system.scaling.formula", ["string", "null"], errors);
  }
}

function validateFeatItem(document, errors) {
  validateBaseDocument(document, errors, { documentName: "Item", requiresSystem: true });
  const system = expectObject(document, "system", errors);
  if (!system) return;

  validateItemDescription(system, errors);
  validateActivatedEffectTemplate(system, errors);
  validateActionTemplate(system, errors);
  expectItemTypeField(system, "system.type", errors, { subtype: true, baseItem: false });
  expectArrayOfStrings(system, "system.properties", errors, { required: false });
  expectPath(system, "system.requirements", ["string", "null"], errors);

  const prerequisites = expectObject(system, "system.prerequisites", errors, { required: false });
  if (prerequisites) {
    expectPath(system, "system.prerequisites.level", ["number", "null"], errors, {
      required: false,
      integer: true,
      min: 0
    });
  }

  const recharge = expectObject(system, "system.recharge", errors, { required: false });
  if (recharge) {
    expectPath(system, "system.recharge.value", ["number", "null"], errors, { integer: true, min: 1 });
    expectPath(system, "system.recharge.charged", ["boolean"], errors);
  }
}

function validateEquipmentItem(document, errors) {
  validateBaseDocument(document, errors, { documentName: "Item", requiresSystem: true });
  const system = expectObject(document, "system", errors);
  if (!system) return;

  validateItemDescription(system, errors);
  validatePhysicalItemTemplate(system, errors);
  validateEquippableItemTemplate(system, errors);
  validateIdentifiableTemplate(system, errors);
  validateActivatedEffectTemplate(system, errors);
  validateActionTemplate(system, errors);
  validateMountableTemplate(system, errors);

  expectItemTypeField(system, "system.type", errors, { subtype: false, baseItem: true });
  expectArrayOfStrings(system, "system.properties", errors, { required: false });
  expectPath(system, "system.strength", ["number", "null"], errors, { integer: true, min: 0 });
  expectPath(system, "system.proficient", ["number", "null"], errors, { integer: true, min: 0, max: 1 });

  const armor = isPlainObject(system.armor) ? system.armor : null;
  if (armor) {
    expectPath(system, "system.armor.value", ["number"], errors, { integer: true, min: 0 });
    expectPath(system, "system.armor.magicalBonus", ["number", "null"], errors, {
      required: false,
      integer: true,
      min: 0
    });
    expectPath(system, "system.armor.dex", ["number", "null"], errors, { integer: true });
  }

  const speed = expectObject(system, "system.speed", errors);
  if (speed) {
    expectPath(system, "system.speed.value", ["number"], errors, { min: 0 });
    expectPath(system, "system.speed.conditions", ["string"], errors);
  }
}

function validateGenericItem(document, errors) {
  validateBaseDocument(document, errors, { documentName: "Item", requiresSystem: true });
  const system = expectObject(document, "system", errors);
  if (!system) return;

  validateItemDescription(system, errors);
  if (hasOwn(system, "activation")) validateActivatedEffectTemplate(system, errors);
  if (hasOwn(system, "actionType") || hasOwn(system, "damage") || hasOwn(system, "save")) {
    validateActionTemplate(system, errors);
  }
}

function validateNpcActor(document, errors) {
  validateBaseDocument(document, errors, {
    documentName: "Actor",
    requiresSystem: true,
    allowsEmbeddedItems: true
  });

  const system = expectObject(document, "system", errors);
  if (!system) return;

  validateActorAbilities(system, errors);
  validateActorAttributes(system, errors);
  validateActorTraits(system, errors);
  validateActorDetails(system, errors, { requiresCr: true });
}

function validateCharacterActor(document, errors) {
  validateBaseDocument(document, errors, {
    documentName: "Actor",
    requiresSystem: true,
    allowsEmbeddedItems: true
  });

  const system = expectObject(document, "system", errors);
  if (!system) return;

  validateActorAbilities(system, errors);
  validateActorAttributes(system, errors);
  validateActorTraits(system, errors);
  validateActorDetails(system, errors, { requiresCr: false });
}

function validateGenericActor(document, errors) {
  validateBaseDocument(document, errors, {
    documentName: "Actor",
    requiresSystem: true,
    allowsEmbeddedItems: true
  });

  const system = expectObject(document, "system", errors);
  if (!system) return;

  if (hasOwn(system, "abilities")) validateActorAbilities(system, errors);
  if (hasOwn(system, "attributes")) validateActorAttributes(system, errors);
  if (hasOwn(system, "traits")) validateActorTraits(system, errors);
  if (hasOwn(system, "details")) validateActorDetails(system, errors, { requiresCr: false });
}

function validateJournalEntry(document, errors) {
  validateBaseDocument(document, errors, { documentName: "JournalEntry", requiresSystem: false });
  const pages = expectArray(document, "pages", errors);
  if (!pages) return;

  pages.forEach((page, index) => {
    const pagePath = `pages.${index}`;
    if (!isPlainObject(page)) {
      addError(errors, pagePath, `Expected object, got ${typeOf(page)}.`);
      return;
    }

    expectPath(document, `${pagePath}._id`, ["string"], errors, { required: false, nonEmpty: true });
    expectPath(document, `${pagePath}.name`, ["string"], errors, { nonEmpty: true });
    expectPath(document, `${pagePath}.type`, ["string"], errors, { nonEmpty: true });
    expectPath(document, `${pagePath}.sort`, ["number"], errors, { required: false, integer: true });

    if (hasOwn(page, "title")) {
      expectPath(document, `${pagePath}.title.show`, ["boolean"], errors);
      expectPath(document, `${pagePath}.title.level`, ["number"], errors, { integer: true, min: 1 });
    }

    if (page.type === "text") {
      expectPath(document, `${pagePath}.text.format`, ["number"], errors, { integer: true });
      expectPath(document, `${pagePath}.text.content`, ["string"], errors);
    }
  });
}

function validateBaseDocument(document, errors, options) {
  const { documentName, requiresSystem = false, allowsEmbeddedItems = false } = options;

  expectPath(document, "_id", ["string"], errors, { required: false, nonEmpty: true });
  expectPath(document, "_key", ["string"], errors, { required: false, nonEmpty: true });
  expectPath(document, "name", ["string"], errors, { nonEmpty: true });
  expectPath(document, "type", ["string"], errors, { nonEmpty: true });
  expectPath(document, "img", ["string"], errors, { required: false });
  expectPath(document, "folder", ["string", "null"], errors, { required: false });
  expectPath(document, "sort", ["number"], errors, { required: false, integer: true });
  expectPath(document, "flags", ["object"], errors, { required: false });
  expectPath(document, "ownership", ["object"], errors, { required: false });
  expectPath(document, "_stats", ["object"], errors, { required: false });

  if (requiresSystem) expectObject(document, "system", errors);
  else expectPath(document, "system", ["object"], errors, { required: false });

  if (documentName === "Actor" || documentName === "Item") {
    expectArray(document, "effects", errors, { required: false });
    if (hasOwn(document, "effects") && Array.isArray(document.effects)) {
      document.effects.forEach((effect, index) => {
        if (!isPlainObject(effect)) addError(errors, `effects.${index}`, `Expected object, got ${typeOf(effect)}.`);
      });
    }
  }

  if (allowsEmbeddedItems) {
    expectArray(document, "items", errors, { required: false });
    if (Array.isArray(document.items)) {
      document.items.forEach((item, index) => {
        if (!isPlainObject(item)) addError(errors, `items.${index}`, `Expected object, got ${typeOf(item)}.`);
      });
    }
  }
}

function validateItemDescription(system, errors) {
  const description = expectObject(system, "system.description", errors);
  if (description) {
    expectPath(system, "system.description.value", ["string", "null"], errors);
    expectPath(system, "system.description.chat", ["string", "null"], errors);
  }

  const source = expectObject(system, "system.source", errors, { required: false });
  if (source) {
    expectPath(system, "system.source.book", ["string"], errors, { required: false });
    expectPath(system, "system.source.page", ["string"], errors, { required: false });
    expectPath(system, "system.source.custom", ["string"], errors, { required: false });
    expectPath(system, "system.source.license", ["string"], errors, { required: false });
  }
}

function validatePhysicalItemTemplate(system, errors) {
  expectPath(system, "system.container", ["string", "null"], errors, { required: false });
  expectPath(system, "system.quantity", ["number"], errors, { integer: true, min: 0 });
  expectPath(system, "system.rarity", ["string"], errors);

  const weight = expectObject(system, "system.weight", errors);
  if (weight) {
    expectPath(system, "system.weight.value", ["number"], errors, { min: 0 });
    expectPath(system, "system.weight.units", ["string"], errors);
  }

  const price = expectObject(system, "system.price", errors);
  if (price) {
    expectPath(system, "system.price.value", ["number"], errors, { min: 0 });
    expectPath(system, "system.price.denomination", ["string"], errors, { nonEmpty: true });
  }
}

function validateEquippableItemTemplate(system, errors) {
  expectPath(system, "system.attunement", ["string"], errors);
  expectPath(system, "system.attuned", ["boolean"], errors, { required: false });
  expectPath(system, "system.equipped", ["boolean"], errors);
}

function validateIdentifiableTemplate(system, errors) {
  expectPath(system, "system.identified", ["boolean"], errors);
  const unidentified = expectObject(system, "system.unidentified", errors, { required: false });
  if (unidentified) {
    expectPath(system, "system.unidentified.name", ["string"], errors, { required: false });
    expectPath(system, "system.unidentified.description", ["string"], errors, { required: false });
  }
}

function validateActivatedEffectTemplate(system, errors) {
  const activation = expectObject(system, "system.activation", errors);
  if (activation) {
    expectPath(system, "system.activation.type", ["string"], errors);
    expectPath(system, "system.activation.cost", ["number"], errors, { min: 0 });
    expectPath(system, "system.activation.condition", ["string"], errors);
  }

  const duration = expectObject(system, "system.duration", errors);
  if (duration) {
    expectPath(system, "system.duration.value", ["string"], errors);
    expectPath(system, "system.duration.units", ["string"], errors);
  }

  expectPath(system, "system.cover", ["number", "null"], errors, { min: 0, max: 1 });
  expectPath(system, "system.crewed", ["boolean"], errors, { required: false });

  const target = expectObject(system, "system.target", errors);
  if (target) {
    expectPath(system, "system.target.value", ["string"], errors);
    expectPath(system, "system.target.width", ["number"], errors, { min: 0 });
    expectPath(system, "system.target.units", ["string"], errors);
    expectPath(system, "system.target.type", ["string"], errors);
    expectPath(system, "system.target.prompt", ["boolean"], errors, { required: false });
  }

  const range = expectObject(system, "system.range", errors);
  if (range) {
    expectPath(system, "system.range.value", ["number"], errors, { min: 0 });
    expectPath(system, "system.range.long", ["number"], errors, { min: 0 });
    expectPath(system, "system.range.units", ["string"], errors);
  }

  const uses = expectObject(system, "system.uses", errors);
  if (uses) {
    expectPath(system, "system.uses.value", ["number"], errors, { integer: true, min: 0 });
    expectPath(system, "system.uses.max", ["string"], errors);
    expectPath(system, "system.uses.per", ["string", "null"], errors);
    expectPath(system, "system.uses.recovery", ["string"], errors);
    expectPath(system, "system.uses.prompt", ["boolean"], errors, { required: false });
  }

  const consume = expectObject(system, "system.consume", errors, { required: false });
  if (consume) {
    expectPath(system, "system.consume.type", ["string"], errors);
    expectPath(system, "system.consume.target", ["string", "null"], errors);
    expectPath(system, "system.consume.amount", ["number"], errors, { integer: true });
    expectPath(system, "system.consume.scale", ["boolean"], errors, { required: false });
  }
}

function validateMountableTemplate(system, errors) {
  const armor = expectObject(system, "system.armor", errors);
  if (armor) {
    expectPath(system, "system.armor.value", ["number"], errors, { integer: true, min: 0 });
  }

  const hp = expectObject(system, "system.hp", errors);
  if (hp) {
    expectPath(system, "system.hp.value", ["number"], errors, { integer: true, min: 0 });
    expectPath(system, "system.hp.max", ["number"], errors, { integer: true, min: 0 });
    expectPath(system, "system.hp.dt", ["number"], errors, { integer: true, min: 0 });
    expectPath(system, "system.hp.conditions", ["string"], errors);
  }
}

function validateActionTemplate(system, errors) {
  expectPath(system, "system.ability", ["string", "null"], errors);
  expectPath(system, "system.actionType", ["string", "null"], errors);
  expectPath(system, "system.chatFlavor", ["string"], errors);
  expectPath(system, "system.formula", ["string"], errors);

  const attack = expectObject(system, "system.attack", errors);
  if (attack) {
    expectPath(system, "system.attack.bonus", ["string"], errors);
    expectPath(system, "system.attack.flat", ["boolean"], errors, { required: false });
  }

  const critical = expectObject(system, "system.critical", errors);
  if (critical) {
    expectPath(system, "system.critical.threshold", ["number", "null"], errors, { integer: true, min: 1 });
    expectPath(system, "system.critical.damage", ["string"], errors);
  }

  const damage = expectObject(system, "system.damage", errors);
  if (damage) {
    validateDamageParts(system.damage.parts, errors, "system.damage.parts");
    expectPath(system, "system.damage.versatile", ["string"], errors);
  }

  const save = expectObject(system, "system.save", errors);
  if (save) {
    expectPath(system, "system.save.ability", ["string"], errors);
    expectPath(system, "system.save.dc", ["number"], errors, { integer: true, min: 0 });
    expectPath(system, "system.save.scaling", ["string"], errors);
  }
}

function validateDamageParts(parts, errors, pathName) {
  if (!Array.isArray(parts)) {
    addError(errors, pathName, `Expected array, got ${typeOf(parts)}.`);
    return;
  }

  parts.forEach((part, index) => {
    const partPath = `${pathName}.${index}`;
    if (!Array.isArray(part)) {
      addError(errors, partPath, `Expected array, got ${typeOf(part)}.`);
      return;
    }

    if (part.length !== 2) {
      addError(errors, partPath, `Expected damage part tuple [formula, damageType], got ${part.length} entries.`);
      return;
    }

    if (typeof part[0] !== "string") addError(errors, `${partPath}.0`, `Expected string, got ${typeOf(part[0])}.`);
    if (typeof part[1] !== "string") addError(errors, `${partPath}.1`, `Expected string, got ${typeOf(part[1])}.`);
  });
}

function expectItemTypeField(system, pathName, errors, options = {}) {
  const { subtype = true, baseItem = true } = options;
  const type = expectObject(system, pathName, errors);
  if (!type) return;

  expectPath(system, `${pathName}.value`, ["string"], errors);
  if (subtype) expectPath(system, `${pathName}.subtype`, ["string"], errors);
  if (baseItem) expectPath(system, `${pathName}.baseItem`, ["string"], errors);
}

function validateActorAbilities(system, errors) {
  const abilities = expectObject(system, "system.abilities", errors);
  if (!abilities) return;

  for (const ability of ["str", "dex", "con", "int", "wis", "cha"]) {
    const abilityPath = `system.abilities.${ability}`;
    const score = expectObject(system, abilityPath, errors);
    if (!score) continue;

    expectPath(system, `${abilityPath}.value`, ["number", "null"], errors, { integer: true, min: 0 });
    expectPath(system, `${abilityPath}.proficient`, ["number"], errors, { min: 0 });

    const bonuses = expectObject(system, `${abilityPath}.bonuses`, errors, { required: false });
    if (bonuses) {
      expectPath(system, `${abilityPath}.bonuses.check`, ["string"], errors, { required: false });
      expectPath(system, `${abilityPath}.bonuses.save`, ["string"], errors, { required: false });
    }
  }
}

function validateActorAttributes(system, errors) {
  const attributes = expectObject(system, "system.attributes", errors);
  if (!attributes) return;

  const ac = expectObject(system, "system.attributes.ac", errors, { required: false });
  if (ac) {
    expectPath(system, "system.attributes.ac.calc", ["string"], errors, { required: false });
    expectPath(system, "system.attributes.ac.flat", ["number", "null"], errors, { required: false, integer: true });
    expectPath(system, "system.attributes.ac.formula", ["string"], errors, { required: false });
  }

  const hp = expectObject(system, "system.attributes.hp", errors);
  if (hp) {
    expectPath(system, "system.attributes.hp.value", ["number"], errors, { integer: true, min: 0 });
    expectPath(system, "system.attributes.hp.max", ["number"], errors, { integer: true, min: 0 });
    expectPath(system, "system.attributes.hp.temp", ["number", "null"], errors, { integer: true, min: 0 });
    expectPath(system, "system.attributes.hp.tempmax", ["number", "null"], errors, { integer: true, min: 0 });
    expectPath(system, "system.attributes.hp.formula", ["string"], errors, { required: false });
  }

  const movement = expectObject(system, "system.attributes.movement", errors, { required: false });
  if (movement) {
    for (const mode of ["burrow", "climb", "fly", "swim", "walk"]) {
      expectPath(system, `system.attributes.movement.${mode}`, ["number", "null"], errors, {
        required: false,
        min: 0
      });
    }
    expectPath(system, "system.attributes.movement.units", ["string"], errors, { required: false });
    expectPath(system, "system.attributes.movement.hover", ["boolean"], errors, { required: false });
  }

  expectPath(system, "system.attributes.prof", ["number"], errors, { required: false, min: 0 });
  expectPath(system, "system.attributes.spellcasting", ["string"], errors, { required: false });
  expectPath(system, "system.attributes.spelldc", ["number"], errors, { required: false, integer: true, min: 0 });
}

function validateActorTraits(system, errors) {
  const traits = expectObject(system, "system.traits", errors, { required: false });
  if (!traits) return;

  expectPath(system, "system.traits.size", ["string"], errors, { required: false });
  for (const trait of ["di", "dr", "dv", "ci", "languages"]) {
    const traitPath = `system.traits.${trait}`;
    const value = expectObject(system, traitPath, errors, { required: false });
    if (!value) continue;

    expectArrayOfStrings(system, `${traitPath}.value`, errors, { required: false });
    expectPath(system, `${traitPath}.custom`, ["string"], errors, { required: false });
  }
}

function validateActorDetails(system, errors, options = {}) {
  const { requiresCr = false } = options;
  const details = expectObject(system, "system.details", errors);
  if (!details) return;

  if (requiresCr) expectPath(system, "system.details.cr", ["number"], errors, { min: 0 });
  else expectPath(system, "system.details.cr", ["number"], errors, { required: false, min: 0 });

  const biography = expectObject(system, "system.details.biography", errors, { required: false });
  if (biography) {
    expectPath(system, "system.details.biography.value", ["string"], errors, { required: false });
    expectPath(system, "system.details.biography.public", ["string"], errors, { required: false });
  }

  const source = expectObject(system, "system.details.source", errors, { required: false });
  if (source) {
    expectPath(system, "system.details.source.book", ["string"], errors, { required: false });
    expectPath(system, "system.details.source.page", ["string"], errors, { required: false });
    expectPath(system, "system.details.source.custom", ["string"], errors, { required: false });
    expectPath(system, "system.details.source.license", ["string"], errors, { required: false });
  }

  const type = expectObject(system, "system.details.type", errors, { required: false });
  if (type) {
    expectPath(system, "system.details.type.value", ["string"], errors, { required: false });
    expectPath(system, "system.details.type.subtype", ["string"], errors, { required: false });
    expectPath(system, "system.details.type.swarm", ["string"], errors, { required: false });
    expectPath(system, "system.details.type.custom", ["string"], errors, { required: false });
  }

  expectPath(system, "system.details.alignment", ["string"], errors, { required: false });
}

function expectObject(root, pathName, errors, options = {}) {
  const value = expectPath(root, pathName, ["object"], errors, options);
  return isPlainObject(value) ? value : null;
}

function expectArray(root, pathName, errors, options = {}) {
  const value = expectPath(root, pathName, ["array"], errors, options);
  return Array.isArray(value) ? value : null;
}

function expectArrayOfStrings(root, pathName, errors, options = {}) {
  const value = expectArray(root, pathName, errors, options);
  if (!value) return null;

  value.forEach((entry, index) => {
    if (typeof entry !== "string") {
      addError(errors, `${pathName}.${index}`, `Expected string, got ${typeOf(entry)}.`);
    }
  });

  return value;
}

function expectPath(root, pathName, expectedTypes, errors, options = {}) {
  const {
    required = true,
    integer = false,
    min,
    max,
    nonEmpty = false
  } = options;
  const valueResult = getPath(root, pathName);

  if (!valueResult.exists) {
    if (required) addError(errors, pathName, `Missing required field; expected ${formatExpected(expectedTypes)}.`);
    return undefined;
  }

  const value = valueResult.value;
  const actualType = typeOf(value);
  if (!expectedTypes.includes(actualType)) {
    addError(errors, pathName, `Expected ${formatExpected(expectedTypes)}, got ${actualType}.`);
    return value;
  }

  if (actualType === "number") {
    if (!Number.isFinite(value)) addError(errors, pathName, "Expected a finite number.");
    if (integer && !Number.isInteger(value)) addError(errors, pathName, "Expected an integer.");
    if (min !== undefined && value < min) addError(errors, pathName, `Expected value >= ${min}.`);
    if (max !== undefined && value > max) addError(errors, pathName, `Expected value <= ${max}.`);
  }

  if (actualType === "string" && nonEmpty && value.trim() === "") {
    addError(errors, pathName, "Expected a non-empty string.");
  }

  return value;
}

function getPath(root, pathName) {
  const parts = pathName.split(".");
  let current = root;

  for (const part of parts) {
    if (part === "system" && current === root && !hasOwn(root, "system")) continue;
    if (part === "system" && current === root && hasOwn(root, "system")) {
      current = root.system;
      continue;
    }

    if (!isObjectLike(current) || !hasOwn(current, part)) {
      return { exists: false, value: undefined };
    }
    current = current[part];
  }

  return { exists: true, value: current };
}

function addError(errors, pathName, message) {
  errors.push({ path: pathName, message });
}

function formatExpected(types) {
  return types.join(" or ");
}

function typeOf(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value === "object" ? "object" : typeof value;
}

function isObjectLike(value) {
  return value !== null && typeof value === "object";
}

function isPlainObject(value) {
  return isObjectLike(value) && !Array.isArray(value);
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function collectJsonFiles(root) {
  const files = [];
  if (!fs.existsSync(root)) return files;

  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...collectJsonFiles(fullPath));
    else if (entry.isFile() && entry.name.endsWith(".json")) files.push(fullPath);
  }

  return files;
}

function loadPackDocumentMap(moduleRoot) {
  const manifestPath = path.join(moduleRoot, DEFAULT_MANIFEST);
  if (!fs.existsSync(manifestPath)) return new Map();

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const map = new Map();
  for (const pack of manifest.packs ?? []) {
    if (!pack?.name || !pack?.type) continue;
    map.set(path.normalize(path.join(moduleRoot, DEFAULT_SOURCE_ROOT, pack.name)), pack.type);
  }

  return map;
}

function getDocumentNameForFile(filePath, packDocumentMap) {
  let current = path.dirname(path.resolve(filePath));
  const root = path.parse(current).root;

  while (current !== root) {
    const documentName = packDocumentMap.get(path.normalize(current));
    if (documentName) return documentName;
    current = path.dirname(current);
  }

  return null;
}

function runCli() {
  const moduleRoot = process.cwd();
  const sourceRoot = path.resolve(moduleRoot, process.argv[2] ?? DEFAULT_SOURCE_ROOT);
  const packDocumentMap = loadPackDocumentMap(moduleRoot);
  const files = collectJsonFiles(sourceRoot);
  const allErrors = [];
  const counts = new Map();

  for (const file of files) {
    const relativeFile = path.relative(moduleRoot, file);
    let document;

    try {
      document = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (error) {
      allErrors.push({ file: relativeFile, path: "root", message: `Invalid JSON: ${error.message}` });
      continue;
    }

    const documentName = getDocumentNameForFile(file, packDocumentMap);
    const result = validateDocument(document, { documentName });
    const key = result.documentName && result.type ? `${result.documentName}:${result.type}` : "unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);

    for (const error of result.errors) {
      allErrors.push({ file: relativeFile, path: error.path, message: error.message });
    }
  }

  if (allErrors.length) {
    for (const error of allErrors.slice(0, 120)) {
      console.error(`${error.file}: ${error.path}: ${error.message}`);
    }
    if (allErrors.length > 120) console.error(`...and ${allErrors.length - 120} more errors.`);
    console.error(`Validation failed: files=${files.length}; errors=${allErrors.length}.`);
    process.exitCode = 1;
    return;
  }

  const summary = [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, count]) => `${key}=${count}`)
    .join("; ");

  console.log(`Validation passed: files=${files.length}${summary ? `; ${summary}` : ""}.`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) runCli();
