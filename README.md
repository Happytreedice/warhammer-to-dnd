# Warhammer: The Old World D&D 5e Conversions — Zero Embedded Items

This revision enforces a strict zero-embedding Actor policy. Actor documents keep `items: []` and store UUID references to atomized shared Items in `flags.warhammerConversions.itemUuids`.

Build commands:

```bash
npm install
npm run validate
npm run pack
```

All compendium packs are grouped under **Warhammer Conversions** via `module.json -> packFolders`.
