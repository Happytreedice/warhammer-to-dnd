# Warhammer: The Old World to D&D 5e

This module neatly translates the bestiary, items, faction equipment, and spells of Warhammer Fantasy / Warhammer: The Old World into the Dungeons & Dragons 5e for Foundry VTT.

The project's goal is simple and practical: to provide DMs with ready-made compendium packs where Old World armies are already organized by faction, actors are prepared for the dnd5e system, and items and spells can be quickly assigned to creatures, NPCs, or campaign characters.

## What's inside

- Warhammer Actors: actors for armies and creatures, grouped by faction.
- `Warhammer Items`: weapons, traits, faction equipment, and spells.
- Support for Foundry VTT v14.
- System dependency: `dnd5e` version 5.3.3 or later.
- Localizations: English and Russian.

## Project Structure

- `module.json`: Foundry VTT manifest, list of packs, languages, and compatibility.
- `src/packs/warhammer-actors`: Actor source JSON documents.
- `src/packs/warhammer-items`: Item, trait, equipment, and spell source JSON documents.
- `packs`: Built Foundry compendium packs.
- `lang`: Localization files.
- `scripts`: Pack building, testing, and release packaging.
- `tools`: release support tools.

## Commands

```powershell
npm install
npm run validate
npm run pack
npm run zip
```

`npm run pack` compiles the contents of `src/packs` into working Foundry compendium packs. `npm run validate` verifies the data structure, and `npm run zip` prepares the module archive for publication.

## Statistics

The calculation is based on the current contents of `src/packs`.

| Section | Quantity |
| --- | ---: |
| Army Sections | 19 |
| Actors | 422 |
| All Items | 290 |
| Weapons | 109 |
| Traits | 48 |
| Faction Equipment | 95 |
| Spells | 38 |

### Armies

| Army | Actors | Faction Items |
| --- | ---: | --- |
| Beastmen Brayherds | 20 | 5 |
| Chaos Dwarfs | 20 | 5 |
| Daemons of Chaos | 25 | 5 |
| Dark Elf | 26 | 5 |
| Dwarfen Mountain Holds | 24 | 5 |
| Empire of Man | 27 | 5 |
| High Elf Realms | 24 | 5 |
| Khemri | 25 | 5 |
| Kingdom of Bretonnia | 21 | 5 |
| Lizardmen | 20 | 5 |
| Ogre Kingdoms | 17 | 5 |
| Orc and Goblin Tribes | 31 | 5 |
| Skaven | 27 | 5 |
| Vampire Counts | 30 | 5 |
| Vyrkos Dynasty | 17 | 5 |
| Warriors of Chaos | 22 | 15 |
| Warriors of Chaos Khorne | 14 | Warriors of Chaos General Folder |
| Warriors of Chaos Tzeentch | 13 | Warriors of Chaos General Folder |
| Wood Elf Realms | 19 | 5 |

### Spells

| Magic Section | Quantity | Spells |
| --- | ---: | --- |
| Battle Prayers | 1 | Steel Resolve |
| Default Spell | 6 | Drain Magic; Gehenna Golden Hounds; Hammer of Witches; Khorne Blood Surge; Killing Volley; The Dwellers Below |
| Dwarfen Runes | 1 | Rune of Warding |
| Lore of Dark Magic | 2 | Bladewind; Infernal Gateway |
| Lore of Death | 2 | Doom Word; Purple Sun of Xereus |
| Lore of Fire | 3 | Fire Dart; Fireball of Aqshy; Flaming Blade |
| Lore of Heavens | 2 | Comet of Casandora; Urannon Thunderbolt |
| Lore of High Magic | 4 | Apotheosis; Arrow Storm; Concordance of Winds; Soul Quench |
| Lore of Light | 2 | Cleansing Flare; Silver Shield |
| Lore of Metal | 1 | Final Transmutation |
| Lore of Plague | 2 | Plague Breath; Plague |
| Lore of Ruin | 1 | Warp Lightning |
| Lore of Shadows | 2 | Okkam Mindrazor; Spirit Leech |
| Lore of the Wild | 2 | Curse of Da Bad Moon; Hand of Gork |
| Lore of Tzeentch | 2 | Doombolt; Tzeentch Chromatic Fire |
| Lore of Vampires | 5 | Curse of Years; Dance of the Dead [Danse Macabre]; Hellish Vigour; Invocation of Nehek; Invocation of Nehek |

## Legal Status

All rights to Warhammer Fantasy, Warhammer: The Old World, Dungeons & Dragons, Foundry Virtual Tabletop, related titles, worlds, images, and other copyrighted materials belong to their respective owners.

This module is an unofficial user adaptation and does not replace the original books, rules, or digital products. This project's user-generated content is created and distributed under the open access permission granted by the authors of the respective content. When further using this material, please comply with the terms of the copyright holders and authors of the original user-generated content.