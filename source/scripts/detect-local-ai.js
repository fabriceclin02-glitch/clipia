#!/usr/bin/env node
/** CLIPIA — Détecte les IA locales installées sur cette machine. */
import { loadEnv } from '../server/lib/env.js';
import { PROVIDERS, baseUrl } from '../server/providers/registry.js';
import { execSync } from 'node:child_process';
loadEnv();

const has = bin => { try { execSync(process.platform === 'win32' ? `where ${bin}` : `command -v ${bin}`, { stdio: 'ignore' }); return true; } catch { return false; } };

const probe = async p => {
  const url = baseUrl(p);
  if (p.base === 'local') return { ok: has(p.id === 'ffmpeg' ? 'ffmpeg' : 'whisper-cli'), note: 'binaire' };
  try {
    const r = await fetch(url.replace(/\/v1$/, '') + (p.probe || '/models'), { signal: AbortSignal.timeout(2500) });
    const j = await r.json().catch(() => ({}));
    const models = (j.models || j.data || []).map(m => m.name || m.id || m.model_name).filter(Boolean);
    return { ok: r.ok, models: models.slice(0, 25) };
  } catch { return { ok: false }; }
};

console.log('\n  CLIPIA — détection des IA locales\n  ' + '─'.repeat(50));
const locals = PROVIDERS.filter(p => p.tier === 'local-gratuit');
let found = 0;
for (const p of locals) {
  const r = await probe(p);
  if (r.ok) found++;
  const mark = r.ok ? '  ✅' : '  ⬜';
  console.log(`${mark} ${p.label.padEnd(34)} ${r.ok ? (r.models?.length ? r.models.length + ' modèle(s)' : 'actif') : 'non détecté'}`);
  if (r.ok && r.models?.length) console.log('      ' + r.models.slice(0, 6).join(', '));
  if (!r.ok && p.install) console.log('      installer : ' + p.install);
}
console.log('  ' + '─'.repeat(50));
console.log(`  ${found}/${locals.length} moteur(s) local(aux) disponible(s)\n`);
