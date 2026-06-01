import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
const out='/mnt/data/warhammer-tow-dnd5e-v14-atomized-dedup-maneuvers.zip';
try { fs.rmSync(out,{force:true}); } catch {}
execFileSync('zip',['-r',out,'.','-x','node_modules/*'],{stdio:'inherit'});
console.log(out);
