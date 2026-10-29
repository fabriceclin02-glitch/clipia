// test Kodi : outil enregistré, catalogue, accord pour « activer »
import assert from 'node:assert';
const { OUTILS } = await import(new URL('../server/noyau/outils.js', import.meta.url).href);
const { CATALOGUE } = await import(new URL('../server/noyau/logitheque.js', import.meta.url).href);
assert(OUTILS.kodi && OUTILS.streaming_ouvrir);
assert(CATALOGUE.find(e => e.id === 'kodi' && e.winget === 'XBMCFoundation.Kodi'));
assert(CATALOGUE.filter(e => e.cat === 'streaming').length >= 7);
const r = await OUTILS.kodi.run({ action: 'activer' }); assert.equal(r.arret, 'accord');
await assert.rejects(OUTILS.streaming_ouvrir.run({ service: 'inconnu' }));
console.log('kodi OK');
