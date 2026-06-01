
import fs from 'node:fs';
import path from 'node:path';
const root='src/packs';
let files=0, actors=0, refs=0, items=0, spells=0;
const errors=[];
const forbiddenText=[/This option is available/i,/Этот вариант вооружения явно доступен/i,/use the creature/i,/используйте профиль атаки/i];
const activationAllowed=new Set(['action','bonus','reaction','legendary','special','none','minute','hour','day']);
function walk(o, fn, p='') { fn(o,p); if (Array.isArray(o)) o.forEach((v,i)=>walk(v,fn,`${p}/${i}`)); else if (o && typeof o==='object') for (const [k,v] of Object.entries(o)) walk(v,fn,`${p}/${k}`); }
function fail(file,msg){errors.push(`${file}: ${msg}`)}
for (const pack of fs.readdirSync(root)) {
 const dir=path.join(root,pack); if (!fs.statSync(dir).isDirectory()) continue;
 for (const file of fs.readdirSync(dir).filter(f=>f.endsWith('.json'))) {
   const fp=path.join(dir,file); files++;
   const txt=fs.readFileSync(fp,'utf8');
   if (Buffer.byteLength(txt,'utf8') < 1200) fail(fp,'JSON below 1200 bytes; possible stub/truncation');
   let doc; try { doc=JSON.parse(txt); } catch(e) { fail(fp,'invalid JSON '+e.message); continue; }
   if (!doc._id || !doc.name || !doc.type) fail(fp,'missing required _id/name/type');
   if (txt.includes('flags.warhammer-tow-dnd5e') || txt.includes('"warhammer-tow-dnd5e"')) fail(fp,'forbidden flags.warhammer-tow-dnd5e present');
   if (txt.includes('"save": null') || txt.includes('"dc": null')) fail(fp,'null save/dc present');
   if (txt.includes('levelIndex')) fail(fp,'levelIndex present');
   if (txt.includes('flags.dnd5e.disadvantage') || txt.includes('"disadvantage"')) fail(fp,'deprecated disadvantage flag/key present');
   
   walk(doc,(v,p)=>{
     if (p.endsWith('/save/dc') && (v===null || v==='' || (typeof v==='number'))) fail(fp,`save.dc must be dynamic formula at ${p}`);
     if (p.endsWith('/save/dc') && typeof v==='string' && !/^8 \+ @prof \+ @abilities\.(str|dex|con|int|wis|cha)\.mod$/.test(v)) fail(fp,`bad save.dc formula ${v}`);
     if (p.endsWith('/activation/type') && typeof v==='string' && !activationAllowed.has(v)) fail(fp,`bad activation type ${v}`);
   });
   if (doc.type==='npc') {
     actors++;
     if (!doc.system?.details || typeof doc.system.details.cr !== 'number') fail(fp,'actor CR must be numeric in system.details.cr');
     if (Array.isArray(doc.items) && doc.items.length) fail(fp,'ZERO EMBEDDING VIOLATION: actor.items is not empty');
     const itemUuids=doc.flags?.warhammerConversions?.itemUuids;
     if (!Array.isArray(itemUuids) || !itemUuids.length) fail(fp,'actor missing UUID item references');
     else {
       refs += itemUuids.length;
       for (const u of itemUuids) if (!/^Compendium\.warhammer-to-dnd\.[a-z0-9-]+\.Item\.[A-Za-z0-9]{16}$/.test(u)) fail(fp,'bad item UUID '+u);
     }
     const lname=(doc.name+' '+pack).toLowerCase();
     if (lname.includes('skaven') && !JSON.stringify(itemUuids||[]).includes('Item.')) fail(fp,'skaven lacks item references');
   } else if (['weapon','feat','equipment','spell','consumable','loot','tool'].includes(doc.type)) {
     items++; if (doc.type==='spell') spells++;
     const a=doc.system?.activation?.type;
     if (!a) fail(fp,'item/spell/feature missing system.activation.type');
     const desc=doc.system?.description?.value || '';
     if (!desc || desc.length < 300) fail(fp,'description too short');
     for (const rx of forbiddenText) if (rx.test(desc)) fail(fp,'forbidden meta-template text in description: '+rx);
     if (/@details\.level \+ @details\.cr/.test(desc)) fail(fp,'raw scaling formula printed in description');
     if (doc.system?.formula !== '(@details.level + @details.cr)') fail(fp,'missing internal scaling formula');
   }
 }
}
if (errors.length) { console.error(errors.slice(0,80).join('\n')); console.error(`Errors: ${errors.length}`); process.exit(1); }
console.log(`Validation passed: files=${files}; actors=${actors}; topLevelItems=${items}; spells=${spells}; uuidRefs=${refs}; zeroEmbedding=ok; no stubs or forbidden flags.`);
