/**
 * Lecture des métadonnées d'un média : ffprobe s'il est là, sinon « ffmpeg -i » (même information, format ffprobe).
 * Permet de n'embarquer que ffmpeg.exe (≈ 65 Mo) au lieu de ffmpeg + ffprobe.
 */
import { spawnSync } from 'node:child_process';
import { binaire, ffmpegBin, ffprobeBin } from './env.js';

export function sondeJson(chemin) {
  if (binaire('ffprobe')) {
    const r = spawnSync(ffprobeBin(), ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', chemin], { encoding: 'utf8', timeout: 60000, windowsHide: true, maxBuffer: 20e6 });
    if (r.status !== 0) throw new Error('Fichier illisible : ' + String(r.stderr).slice(0, 200));
    return JSON.parse(r.stdout);
  }
  const r = spawnSync(ffmpegBin(), ['-hide_banner', '-i', chemin], { encoding: 'utf8', timeout: 60000, windowsHide: true, maxBuffer: 20e6 });
  if (r.error) throw new Error("ffmpeg n'est pas installé : " + r.error.message);
  const t = String(r.stderr || '');
  if (/No such file|Invalid data found|does not contain/i.test(t) && !/Duration:/.test(t)) throw new Error('Fichier illisible : ' + t.split('\n').slice(-3).join(' ').slice(0, 200));
  const d = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(t);
  const duree = d ? (+d[1]) * 3600 + (+d[2]) * 60 + parseFloat(d[3]) : 0;
  const kb = /bitrate:\s*(\d+)\s*kb\/s/.exec(t);
  const streams = [];
  for (const m of t.matchAll(/Stream #\d+:\d+[^:]*:\s*(Audio|Video):\s*([^\s,]+)([^\n]*)/g)) {
    const reste = m[3] || '';
    if (m[1] === 'Audio') {
      const hz = /(\d+)\s*Hz/.exec(reste); const ch = /\b(mono|stereo|5\.1|7\.1)\b/.exec(reste);
      streams.push({ codec_type: 'audio', codec_name: m[2], sample_rate: hz ? hz[1] : undefined, channels: ch ? ({ mono: 1, stereo: 2, '5.1': 6, '7.1': 8 })[ch[1]] : 2 });
    } else {
      const wh = /(\d{2,5})x(\d{2,5})/.exec(reste); const fps = /(\d+(?:\.\d+)?)\s*fps/.exec(reste);
      streams.push({ codec_type: 'video', codec_name: m[2], width: wh ? +wh[1] : undefined, height: wh ? +wh[2] : undefined, r_frame_rate: fps ? `${fps[1]}/1` : '0/0' });
    }
  }
  if (!streams.length && !d) throw new Error('Fichier illisible ou format inconnu.');
  const taille = (() => { try { return require_fs().statSync(chemin).size; } catch { return 0; } })();
  return { streams, format: { duration: String(duree), size: String(taille), bit_rate: kb ? String(+kb[1] * 1000) : undefined } };
}
import fs from 'node:fs';
const require_fs = () => fs;
