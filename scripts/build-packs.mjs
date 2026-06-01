import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(fs.readFileSync(path.join(moduleRoot, 'module.json'), 'utf8'));
const srcRoot = path.join(moduleRoot, 'src/packs');
const packRoot = path.join(moduleRoot, 'packs');
const stageRoot = path.join(moduleRoot, 'dist/pack-source');
const foundryCliVersion = process.env.FOUNDRY_CLI_VERSION || '3.0.3';

const collectionByType = {
  ActiveEffect: 'effects',
  Actor: 'actors',
  Adventure: 'adventures',
  Cards: 'cards',
  ChatMessage: 'messages',
  Combat: 'combats',
  FogExploration: 'fog',
  Folder: 'folders',
  Item: 'items',
  JournalEntry: 'journal',
  Macro: 'macros',
  Playlist: 'playlists',
  RollTable: 'tables',
  Scene: 'scenes',
  Setting: 'settings',
  User: 'users'
};

const hierarchy = {
  actors: ['items', 'effects'],
  cards: ['cards'],
  combats: ['combatants', 'groups'],
  delta: ['items', 'effects'],
  effects: [],
  items: ['effects'],
  journal: ['pages', 'categories'],
  playlists: ['sounds'],
  regions: ['behaviors'],
  tables: ['results'],
  tokens: ['delta'],
  scenes: ['drawings', 'lights', 'notes', 'regions', 'sounds', 'templates', 'tokens', 'tiles', 'walls']
};

function runFoundryCli(args) {
  const localCli = path.join(moduleRoot, 'node_modules/@foundryvtt/foundryvtt-cli/fvtt.mjs');
  if (fs.existsSync(localCli)) {
    execFileSync(process.execPath, [localCli, ...args], { cwd: moduleRoot, stdio: 'inherit' });
    return;
  }

  if (process.platform === 'win32') {
    execFileSync(
      'cmd.exe',
      ['/d', '/s', '/c', 'npx', '--yes', `@foundryvtt/foundryvtt-cli@${foundryCliVersion}`, ...args],
      { cwd: moduleRoot, stdio: 'inherit' }
    );
  } else {
    execFileSync(
      'npx',
      ['--yes', `@foundryvtt/foundryvtt-cli@${foundryCliVersion}`, ...args],
      { cwd: moduleRoot, stdio: 'inherit' }
    );
  }
}

function copyJsonWithKey(sourceFile, destinationFile, collection) {
  const document = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
  if (!document._id) throw new Error(`Missing _id in ${sourceFile}`);
  addDocumentKeys(document, collection);

  fs.mkdirSync(path.dirname(destinationFile), { recursive: true });
  fs.writeFileSync(destinationFile, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
}

function createEmbeddedId(parentId, embeddedCollection, index, embeddedDocument) {
  const label = embeddedDocument?.name ?? embeddedDocument?.label ?? embeddedDocument?.type ?? '';
  return crypto
    .createHash('sha1')
    .update(`${parentId}:${embeddedCollection}:${index}:${label}`)
    .digest('hex')
    .slice(0, 16);
}

function addDocumentKeys(document, collection, collectionPrefix = collection, idPrefix = document._id) {
  if (!document?._id) throw new Error(`Missing _id while assigning a ${collection} key`);
  document._key = `!${collectionPrefix}!${idPrefix}`;

  for (const embeddedCollection of hierarchy[collection] ?? []) {
    const value = document[embeddedCollection];
    if (Array.isArray(value)) {
      for (const [index, embeddedDocument] of value.entries()) {
        if (!embeddedDocument || typeof embeddedDocument !== 'object') continue;
        embeddedDocument._id ??= createEmbeddedId(idPrefix, embeddedCollection, index, embeddedDocument);
        addDocumentKeys(
          embeddedDocument,
          embeddedCollection,
          `${collectionPrefix}.${embeddedCollection}`,
          `${idPrefix}.${embeddedDocument._id}`
        );
      }
    } else if (value && typeof value === 'object') {
      value._id ??= createEmbeddedId(idPrefix, embeddedCollection, 0, value);
      addDocumentKeys(
        value,
        embeddedCollection,
        `${collectionPrefix}.${embeddedCollection}`,
        `${idPrefix}.${value._id}`
      );
    }
  }
}

function stagePackSource(sourceDir, destinationDir, collection) {
  fs.rmSync(destinationDir, { recursive: true, force: true });

  const walk = (currentSource, currentDestination) => {
    for (const entry of fs.readdirSync(currentSource, { withFileTypes: true })) {
      const sourcePath = path.join(currentSource, entry.name);
      const destinationPath = path.join(currentDestination, entry.name);
      if (entry.isDirectory()) {
        walk(sourcePath, destinationPath);
      } else if (entry.isFile() && entry.name.endsWith('.json')) {
        copyJsonWithKey(sourcePath, destinationPath, collection);
      }
    }
  };

  walk(sourceDir, destinationDir);
}

function assertPacked(packName) {
  const outDir = path.join(packRoot, packName);
  const hasDataFile = fs.readdirSync(outDir).some((file) => file.endsWith('.ldb') && fs.statSync(path.join(outDir, file)).size > 0);
  if (!hasDataFile) throw new Error(`Pack ${packName} was created without LevelDB data. Check staged _key values.`);
}

fs.rmSync(packRoot, { recursive: true, force: true });
fs.rmSync(stageRoot, { recursive: true, force: true });
fs.mkdirSync(packRoot, { recursive: true });

for (const pack of manifest.packs) {
  const packName = pack.name ?? path.basename(pack.path);
  const collection = collectionByType[pack.type];
  if (!collection) throw new Error(`Unsupported document type for ${packName}: ${pack.type}`);

  const sourceDir = path.join(srcRoot, packName);
  const stagedSourceDir = path.join(stageRoot, packName);
  if (!fs.existsSync(sourceDir)) throw new Error(`Missing source directory for ${packName}: ${sourceDir}`);

  console.log(`Packing ${packName}`);
  stagePackSource(sourceDir, stagedSourceDir, collection);
  runFoundryCli([
    'package',
    'pack',
    packName,
    '--inputDirectory',
    stagedSourceDir,
    '--outputDirectory',
    packRoot,
    '--recursive'
  ]);
  assertPacked(packName);
}

fs.rmSync(stageRoot, { recursive: true, force: true });
