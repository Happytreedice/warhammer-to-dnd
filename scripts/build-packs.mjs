import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const srcRoot='src/packs';
fs.rmSync('packs',{recursive:true,force:true}); fs.mkdirSync('packs',{recursive:true});
const fvtt='node_modules/@foundryvtt/foundryvtt-cli/fvtt.mjs';
for (const pack of fs.readdirSync(srcRoot).sort()) {
 const input=path.join(srcRoot,pack); if (!fs.statSync(input).isDirectory()) continue;
 console.log(`Packing ${pack}`);
 execFileSync(process.execPath,[fvtt,'package','pack',pack,'--inputDirectory',input,'--outputDirectory','packs','--recursive'],{stdio:'inherit'});
}
