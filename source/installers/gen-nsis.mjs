// Génère les sections optionnelles « logiciels libres » de l'installateur Windows depuis le catalogue de la Logithèque.
import { CATALOGUE, CATEGORIES } from '../server/noyau/logitheque.js';
const q = s => String(s).replace(/"/g, "'").replace(/\$/g, '$$$$');
let o = '; généré par installers/gen-nsis.mjs — ne pas modifier à la main\n';
o += '!macro LOGICIEL NOM ID\n  Section /o "${NOM}"\n    DetailPrint "Installation de ${NOM} (winget)…"\n    nsExec::ExecToLog \'winget install -e --id ${ID} --silent --accept-package-agreements --accept-source-agreements\'\n    Pop $0\n    ${If} $0 != 0\n      DetailPrint "${NOM} : winget n\'a pas pu l\'installer (code $0). Tu pourras le refaire depuis Clipia > Logithèque."\n    ${EndIf}\n  SectionEnd\n!macroend\n';
for (const [cat, titre] of Object.entries(CATEGORIES)) {
  const l = CATALOGUE.filter(e => e.cat === cat && e.winget && !e.lienSeul && e.id !== 'ffmpeg');
  if (!l.length) continue;
  o += `SectionGroup /e "${q(titre.replace(/^\S+\s/, ''))}"\n`;
  for (const e of l) o += `  !insertmacro LOGICIEL "${q(e.nom)}" "${e.winget}"\n`;
  if (cat === 'google') o += `  Section /o "Gemma 3 (cerveau local de Google, ~3 Go)"\n    DetailPrint "Téléchargement de Gemma 3 dans Ollama…"\n    nsExec::ExecToLog '"$LOCALAPPDATA\\Programs\\Ollama\\ollama.exe" pull gemma3'\n    Pop $0\n    \${If} $0 != 0\n      DetailPrint "Gemma 3 : Ollama n'est pas encore installé. Coche d'abord Ollama (groupe IA locale) ou utilise Clipia > Logithèque."\n    \${EndIf}\n  SectionEnd\n`;
  o += 'SectionGroupEnd\n';
}
process.stdout.write(o);
