/* Voix de Clipia : écoute (micro + transcription Whisper), parole (voix du système), mode mains libres. */
(function () {
  const V = {
    stream: null, ctx: null, analyser: null, data: null,
    level: 0, speaking: false, recording: false, handsFree: false, lastTalk: 0,
    getCfg: () => ({}), getKeys: () => ({}), onState: () => {}, onHeard: () => {}, onCommand: () => {}, onError: () => {}
  };

  V.voicesAll = () => (window.speechSynthesis ? speechSynthesis.getVoices() : []);
  V.voices = () => (window.speechSynthesis ? speechSynthesis.getVoices().filter(v => /^fr/i.test(v.lang)) : []);
  if (window.speechSynthesis) speechSynthesis.onvoiceschanged = () => {};

  V.engine = () => {
    const c = V.getCfg(), k = V.getKeys();
    if (c.sttEngine && k[c.sttEngine]) return c.sttEngine;
    if (k.groq) return 'groq';
    if (k.openai) return 'openai';
    return null;
  };

  async function ensureMic() {
    if (V.stream) return true;
    try {
      V.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      V.ctx = new AudioContext();
      const src = V.ctx.createMediaStreamSource(V.stream);
      V.analyser = V.ctx.createAnalyser(); V.analyser.fftSize = 1024; src.connect(V.analyser);
      V.data = new Uint8Array(V.analyser.fftSize);
      (function meter() {
        if (!V.analyser) return;
        V.analyser.getByteTimeDomainData(V.data);
        let s = 0; for (const x of V.data) { const v = (x - 128) / 128; s += v * v; }
        V.level = Math.min(1, Math.sqrt(s / V.data.length) * 6);
        if (!V.speaking && (V.recording || V.handsFree)) window.Orb && Orb.setAll(undefined, V.level);
        requestAnimationFrame(meter);
      })();
      return true;
    } catch (e) { V.onError('Micro indisponible : autorisez le micro pour Clipia Nova dans les réglages de votre système.'); return false; }
  }

  /* Enregistre une phrase : démarre quand on parle, s'arrête après un silence. */
  function recordUtterance({ waitMs = 8000, silenceMs = 1100, maxMs = 25000 } = {}) {
    return new Promise(resolve => {
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
      const rec = new MediaRecorder(V.stream, { mimeType: mime });
      const chunks = []; let started = false, lastLoud = 0; const t0 = performance.now();
      rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      rec.onstop = async () => { V.recording = false; if (!started) return resolve(null); resolve({ blob: new Blob(chunks, { type: mime }), mime }); };
      rec.start(250); V.recording = true;
      const THR = 0.12;
      (function watch() {
        if (rec.state !== 'recording') return;
        const now = performance.now();
        if (V.speaking) { lastLoud = now; }
        else if (V.level > THR) { if (!started) { started = true; V.onState('listening-voice'); } lastLoud = now; }
        if (!started && waitMs && now - t0 > waitMs) return rec.stop();
        if (started && now - lastLoud > silenceMs) return rec.stop();
        if (now - t0 > maxMs + (started ? 0 : waitMs)) return rec.stop();
        if (V.cancelRec) { V.cancelRec = false; started = false; return rec.stop(); }
        if (V.forceStop) { V.forceStop = false; return rec.stop(); }
        setTimeout(watch, 60);
      })();
    });
  }

  async function transcribe(rec) {
    const engine = V.engine();
    if (!engine) { V.onError('Pour parler à Clipia, ajoutez une clé Groq (gratuite) ou OpenAI dans ⚙ Réglages → Voix.'); return ''; }
    V.onState('transcribing');
    const r = await window.nova.transcribe({ engine, apiKey: V.getKeys()[engine], audio: await rec.blob.arrayBuffer(), mime: rec.mime });
    if (r.error) { V.onError(r.error); return ''; }
    return r.text || '';
  }

  /* Un tour de parole (bouton micro / Ctrl+M) */
  V.listenOnce = async () => {
    if (V.recording) { V.forceStop = true; return; }
    V.stop();
    if (!(await ensureMic())) return;
    V.onState('listening');
    const rec = await recordUtterance({ waitMs: 7000 });
    if (!rec) { V.onState('idle'); return; }
    const text = await transcribe(rec);
    if (text) { V.lastTalk = Date.now(); V.onCommand(text); } else V.onState('idle');
  };

  /* Mains libres : Clipia écoute en continu et répond quand on l'appelle par son nom */
  V.setHandsFree = async (on) => {
    V.handsFree = on;
    if (!on) { V.cancelRec = true; V.onState('idle'); return; }
    if (!(await ensureMic())) { V.handsFree = false; return; }
    if (!V.engine()) { V.onError('Le mode mains libres a besoin d\'une clé Groq (gratuite) ou OpenAI pour la voix : ⚙ Réglages → Voix.'); V.handsFree = false; return; }
    V.onState('listening');
    while (V.handsFree) {
      if (V.speaking || V.busy) { await new Promise(r => setTimeout(r, 150)); continue; }
      const rec = await recordUtterance({ waitMs: 0, maxMs: 25000 });
      if (!V.handsFree) break;
      if (!rec) continue;
      const text = await transcribe(rec);
      if (!text) { V.onState('listening'); continue; }
      const wake = /\b(clipia|clipya|klipia|cli pia|clip ia)\b[,!.\s]*/i;
      const inConvo = Date.now() - V.lastTalk < 30000;
      if (wake.test(text) || inConvo) {
        const cmd = text.replace(wake, '').trim();
        V.lastTalk = Date.now();
        if (cmd) V.onCommand(cmd); else { V.speak('Oui ? Je t\'écoute.'); }
      } else { V.onHeard(text); V.onState('listening'); }
    }
  };

  /* Clipia parle */
  V.speak = (text) => new Promise(resolve => {
    if (!window.speechSynthesis) return resolve();
    speechSynthesis.cancel();
    const clean = String(text).replace(/```[\s\S]*?```/g, ' (code) ').replace(/[*#_`>|]/g, '').replace(/https?:\/\/\S+/g, 'lien').slice(0, 2500);
    if (!V.voicesAll().length || V.simulate) {           // pas de voix installée (ou démo) : animation seule
      V.speaking = true; V.onState('speaking');
      const ms = Math.min(9000, 900 + clean.length * 55);
      const iv = setInterval(() => window.Orb && Orb.setAll(undefined, 0.4 + Math.random() * 0.6), 110);
      setTimeout(() => { clearInterval(iv); V.speaking = false; V.lastTalk = Date.now(); window.Orb && Orb.setAll(undefined, 0); V.onState(V.handsFree ? 'listening' : 'idle'); resolve(); }, ms);
      return;
    }
    const u = new SpeechSynthesisUtterance(clean);
    const c = V.getCfg(), list = V.voices();
    const pick = list.find(v => v.name === c.voiceName) || list.find(v => /natural|online|neural/i.test(v.name)) || list.find(v => /fr-FR/i.test(v.lang)) || list[0];
    if (pick) u.voice = pick;
    u.lang = (pick && pick.lang) || 'fr-FR';
    u.rate = c.voiceRate || 1.02; u.pitch = 1;
    V.speaking = true; V.onState('speaking');
    u.onboundary = () => window.Orb && Orb.setAll(undefined, 0.6 + Math.random() * 0.4);
    const end = () => { V.speaking = false; V.lastTalk = Date.now(); window.Orb && Orb.setAll(undefined, 0); V.onState(V.handsFree ? 'listening' : 'idle'); resolve(); };
    u.onend = end; u.onerror = end;
    speechSynthesis.speak(u);
  });
  V.stop = () => { if (window.speechSynthesis) speechSynthesis.cancel(); V.speaking = false; };

  window.Voice = V;
})();
