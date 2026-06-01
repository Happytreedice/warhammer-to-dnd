const MODULE_ID = "warhammer-to-dnd";
const FORCE_RECREATE_SETTING = "forceRecreateCompendiumFolders";
const COMPENDIUM_FOLDER_TYPE = "Compendium";

const PACK_GROUPS = {
  "faction-actors": [
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
  ],
  "universal-libraries": [
    "warhammer-weapons",
    "warhammer-features",
    "warhammer-equipment",
    "warhammer-spells"
  ],
  journals: [
    "conversion-journals"
  ]
};

const FOLDER_DEFINITIONS = [
  {
    key: "root",
    nameKey: "FOLDER.warhammer-conversions.name",
    color: "#651414",
    children: [
      {
        key: "faction-actors",
        nameKey: "FOLDER.warhammer-conversions.faction-actors.name",
        color: "#8a1f1f"
      },
      {
        key: "universal-libraries",
        nameKey: "FOLDER.warhammer-conversions.universal-libraries.name",
        color: "#4f6f52"
      },
      {
        key: "journals",
        nameKey: "FOLDER.warhammer-conversions.journals.name",
        color: "#6d5b2f"
      }
    ]
  }
];

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, FORCE_RECREATE_SETTING, {
    name: game.i18n.localize("WARHAMMER_TO_DND.settings.forceRecreateCompendiumFolders.name"),
    hint: game.i18n.localize("WARHAMMER_TO_DND.settings.forceRecreateCompendiumFolders.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });
});

Hooks.once("ready", async () => {
  if (!game.user.isGM) return;

  try {
    await ensureCompendiumFolders();
  } catch (error) {
    console.error(`${MODULE_ID} | Failed to prepare compendium folders`, error);
    ui.notifications?.error(game.i18n.localize("FOLDER.warhammer-conversions.errors.folder-setup"));
  }
});

async function ensureCompendiumFolders() {
  const forceRecreate = game.settings.get(MODULE_ID, FORCE_RECREATE_SETTING);
  if (!forceRecreate && hasExpectedCompendiumStructure()) return;

  if (forceRecreate) await deleteManagedCompendiumFolders();

  const folderByKey = new Map();
  for (const definition of FOLDER_DEFINITIONS) {
    await createFolderTree(definition, null, folderByKey);
  }

  for (const [folderKey, packNames] of Object.entries(PACK_GROUPS)) {
    const folder = folderByKey.get(folderKey);
    for (const packName of packNames) {
      const pack = game.packs.get(`${MODULE_ID}.${packName}`);
      if (!pack) {
        console.warn(`${MODULE_ID} | Missing compendium pack ${packName}`);
        continue;
      }

      await pack.setFolder(folder);
    }
  }

  if (forceRecreate) await game.settings.set(MODULE_ID, FORCE_RECREATE_SETTING, false);
  renderCompendiumSidebar();
}

async function createFolderTree(definition, parent, folderByKey) {
  const name = game.i18n.localize(definition.nameKey);
  const parentId = parent?.id ?? null;
  const existing = findReusableFolder(definition, name, parentId);
  let folder = existing;

  if (folder) {
    const update = {};
    if (folder.name !== name) update.name = name;
    if ((folder.folder?.id ?? folder.folder ?? null) !== parentId) update.folder = parentId;
    if (folder.color !== definition.color) update.color = definition.color;
    if (!isManagedCompendiumFolder(folder)) update[`flags.${MODULE_ID}.managedCompendiumFolder`] = true;
    if (folder.getFlag(MODULE_ID, "compendiumFolderKey") !== definition.key) {
      update[`flags.${MODULE_ID}.compendiumFolderKey`] = definition.key;
    }
    if (Object.keys(update).length) folder = await folder.update(update);
  } else {
    folder = await Folder.create({
      name,
      type: COMPENDIUM_FOLDER_TYPE,
      folder: parentId,
      sorting: "a",
      color: definition.color,
      flags: {
        [MODULE_ID]: {
          managedCompendiumFolder: true,
          compendiumFolderKey: definition.key
        }
      }
    });
  }

  folderByKey.set(definition.key, folder);

  for (const child of definition.children ?? []) {
    await createFolderTree(child, folder, folderByKey);
  }
}

async function deleteManagedCompendiumFolders() {
  const managed = game.folders.filter((folder) => isManagedCompendiumFolder(folder));
  if (!managed.length) return;

  await Folder.deleteDocuments(managed.map((folder) => folder.id));
}

function hasExpectedCompendiumStructure() {
  const requiredFolderKeys = new Set(["root", ...Object.keys(PACK_GROUPS)]);
  for (const key of requiredFolderKeys) {
    if (!findManagedFolder(key)) return false;
  }

  for (const [folderKey, packNames] of Object.entries(PACK_GROUPS)) {
    const folder = findManagedFolder(folderKey);
    for (const packName of packNames) {
      const pack = game.packs.get(`${MODULE_ID}.${packName}`);
      if (!pack) return false;
      const currentFolderId = pack.folder?.id ?? pack.folder;
      if (currentFolderId !== folder.id) return false;
    }
  }

  return true;
}

function findManagedFolder(key) {
  return game.folders.find((folder) => {
    return isManagedCompendiumFolder(folder) && folder.getFlag(MODULE_ID, "compendiumFolderKey") === key;
  });
}

function findReusableFolder(definition, name, parentId) {
  return findManagedFolder(definition.key) ?? game.folders.find((folder) => {
    if (folder.type !== COMPENDIUM_FOLDER_TYPE) return false;
    if (folder.name !== name) return false;
    return (folder.folder?.id ?? folder.folder ?? null) === parentId;
  });
}

function isManagedCompendiumFolder(folder) {
  return folder.type === COMPENDIUM_FOLDER_TYPE && folder.getFlag(MODULE_ID, "managedCompendiumFolder") === true;
}

function renderCompendiumSidebar() {
  ui.compendium?.render?.(true);
  ui.sidebar?.tabs?.compendium?.render?.(true);
}
