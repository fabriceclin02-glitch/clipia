#!/usr/bin/env node
/** CLIPIA — diagnostic complet de l'installation. */
import { loadEnv, ROOT, DATA_DIR } from '../server/lib/env.js';
loadEnv();
import { PROVIDERS, byTier } from '../server/providers/registry.js';
import { credential, ping } from '../server/providers/gateway.js';
import { CONNECTORS } from '../server/connectors/manifests.js';
import { isConfigured } from '../server/connectors/oauth.js';
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const V='\x1b[32m', J='\x1b[33m', R='\x1b[31m', G='\x1b[90m', N='\x1b[0m', B='\x1b[1m';
const ligne = (ok, t, d='') => console.log(`  ${ok ? V+'✓' : (ok === null ? J+'~' : R+'✗')}${N} ${t.padEnd(36)} ${G}${d}${N}`);
const titre = t => console.log(`\n${B}${J}  ${t}${N}\n  ${'─'.repeat(58)}`);

console.log(`\n${B}${J}  CLIPIA — diagnostic${N}`);

titre('Environnement');
const nv = +process.versions.node.split('.')[0];
ligne(nv >= 20, 'Node.js', process.version + (nv < 20 ? ' — version 20 minimum requise' : ''));
let ff = false; try { execSync('ffmpeg -version', {stdio:'ignore'}); ff = true; } catch {}
ligne(ff, 'FFmpeg', ff ? 'montage vidéo disponible' : 'absent — le montage échouera');
let fp = false; try { execSync('ffprobe -version', {stdio:'ignore'}); fp = true; } catch {}
ligne(fp, 'FFprobe', fp ? 'analyse audio disponible' : 'absent');
ligne(fs.existsSync(DATA_DIR), 'Dossier de données', DATA_DIR);
ligne(Boolean(process.env.CLIPIA_MASTER_KEY), 'Clé maîtresse du coffre', 'AES-256-GCM');
ligne(fs.existsSync(ROOT + '/.env'), 'Fichier .env', fs.existsSync(ROOT + '/.env') ? 'présent' : 'absent — copiez .env.example');

titre('Moteurs IA cloud');
const cloud = PROVIDERS.filter(p => p.tier !== 'local-gratuit');
const prets = cloud.filter(p => credential(p));
if (!prets.length) ligne(null, 'Aucune clé enregistrée', 'les moteurs locaux suffisent');
for (const p of prets) ligne(true, p.label, p.modalities.join(' · '));
console.log(`  ${G}${prets.length}/${cloud.length} configurés${N}`);

titre('Moteurs locaux (gratuits)');
let actifs = 0;
for (const p of byTier('local-gratuit')) {
  if (p.base === 'local') { const o = p.id === 'ffmpeg' ? ff : false; if (o) actifs++; ligne(o, p.label, o ? 'disponible' : p.install); continue; }
  const r = await ping(p.id);
  if (r.ok) actifs++;
  ligne(r.ok || null, p.label, r.ok ? (r.models?.length ? r.models.length + ' modèle(s)' : 'actif') : p.install);
}
console.log(`  ${G}${actifs} moteur(s) local(aux) actif(s)${N}`);

titre('Connecteurs');
const conf = CONNECTORS.filter(isConfigured);
for (const c of conf) ligne(true, c.label, c.group);
console.log(`  ${G}${conf.length}/${CONNECTORS.length} configurés${N}`);

titre('Verdict');
const peutTexte = prets.length > 0 || actifs > 1;
const peutMonter = ff && fp;
ligne(peutTexte, 'Génération de texte possible');
ligne(peutMonter, 'Montage vidéo possible');
ligne(peutTexte && peutMonter, 'Production de clips possible',
  peutTexte && peutMonter ? 'tout est prêt' : 'voir ci-dessus');
console.log('');
