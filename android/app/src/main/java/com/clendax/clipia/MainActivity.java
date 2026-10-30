package com.clendax.clipia;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.speech.tts.Voice;
import android.view.View;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Locale;
import java.util.Set;

/**
 * Clipia pour Android.
 *
 * La page de Clipia est affichee dans une WebView, et l'application lui prete
 * la voix d'Android : la reconnaissance vocale et la synthese vocale du
 * telephone, qui ne sont pas disponibles autrement dans une WebView.
 */
public class MainActivity extends AppCompatActivity {

    private static final String HOTE = "fabriceclin02-glitch.github.io";
    private static final String ACCUEIL = "https://" + HOTE + "/clipia/app/?source=android";
    private static final int DEMANDE_MICRO = 4201;

    private WebView vue;
    private View horsLigne;
    private final Handler principal = new Handler(Looper.getMainLooper());

    private SpeechRecognizer micro;
    private TextToSpeech voix;
    private boolean voixPrete = false;
    private boolean ecouteEnCours = false;
    private boolean microDemandeApresPermission = false;
    private ValueCallback<Uri[]> choixCb;
    private final ActivityResultLauncher<Intent> choixFichier = registerForActivityResult(
        new ActivityResultContracts.StartActivityForResult(), r -> {
            if (choixCb == null) return;
            Uri[] res = null;
            Intent d = r.getData();
            if (r.getResultCode() == RESULT_OK && d != null) {
                if (d.getClipData() != null) {
                    int n = d.getClipData().getItemCount();
                    res = new Uri[n];
                    for (int i = 0; i < n; i++) res[i] = d.getClipData().getItemAt(i).getUri();
                } else if (d.getData() != null) {
                    res = new Uri[]{ d.getData() };
                }
            }
            choixCb.onReceiveValue(res);
            choixCb = null;
        });
    private float vitesseVoix = 1.0f;
    private float hauteurVoix = 1.0f;
    private String uaWeb = "";
    private final HashMap<String, File> synthFichiers = new HashMap<>();
    private String voixChoisie = null;

    // ------------------------------------------------------------------
    // Cycle de vie
    // ------------------------------------------------------------------
    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle etat) {
        super.onCreate(etat);
        setContentView(R.layout.activity_main);

        vue = findViewById(R.id.vue);
        horsLigne = findViewById(R.id.horsLigne);
        findViewById(R.id.bReessayer).setOnClickListener(v -> recharger());

        WebSettings s = vue.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setTextZoom(100);
        uaWeb = s.getUserAgentString();
        s.setUserAgentString(uaWeb + " ClipiaAndroid/8.5.0");

        vue.setBackgroundColor(0xFF080A1C);
        WebView.setWebContentsDebuggingEnabled(false);

        vue.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView w, WebResourceRequest r) {
                Uri u = r.getUrl();
                if (HOTE.equals(u.getHost())) return false;     // notre site : on reste dedans
                ouvrirDehors(u);                                 // le reste : navigateur du telephone
                return true;
            }

            @Override
            public void onPageFinished(WebView w, String url) {
                injecterPont();
            }

            @Override
            public void onReceivedError(WebView w, WebResourceRequest r, WebResourceError e) {
                if (r != null && r.isForMainFrame()) montrerHorsLigne(true);
            }
        });

        vue.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView w, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (choixCb != null) choixCb.onReceiveValue(null);
                choixCb = cb;
                try {
                    Intent i = p.createIntent();
                    i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                    choixFichier.launch(i);
                } catch (Exception e) { choixCb = null; return false; }
                return true;
            }

            @Override
            public void onPermissionRequest(final PermissionRequest demande) {
                principal.post(() -> {
                    for (String res : demande.getResources()) {
                        if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(res)) {
                            if (microAutorise()) { demande.grant(demande.getResources()); return; }
                        }
                    }
                    demande.deny();
                });
            }

            @Override
            public boolean onConsoleMessage(ConsoleMessage m) { return true; }
        });

        // Le bouton retour remonte l'historique de la page avant de quitter.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (vue.canGoBack()) vue.goBack();
                else finish();
            }
        });

        vue.addJavascriptInterface(new Pont(), "ClipiaAndroid");

        preparerVoix();
        recharger();
    }

    @Override
    protected void onDestroy() {
        libererMicro();
        if (voix != null) { voix.stop(); voix.shutdown(); voix = null; }
        if (vue != null) vue.destroy();
        super.onDestroy();
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (voix != null) voix.stop();
        arreterEcouteInterne();
    }

    // ------------------------------------------------------------------
    // Chargement de la page
    // ------------------------------------------------------------------
    private void recharger() {
        if (!reseauPresent()) { montrerHorsLigne(true); return; }
        montrerHorsLigne(false);
        vue.loadUrl(ACCUEIL);
    }

    private void montrerHorsLigne(boolean oui) {
        horsLigne.setVisibility(oui ? View.VISIBLE : View.GONE);
        vue.setVisibility(oui ? View.GONE : View.VISIBLE);
    }

    private boolean reseauPresent() {
        ConnectivityManager cm = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
        if (cm == null) return true;
        NetworkCapabilities c = cm.getNetworkCapabilities(cm.getActiveNetwork());
        return c != null && c.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
    }

    private void ouvrirDehors(Uri u) {
        try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignore) {}
    }

    /** Previent la page qu'elle tourne dans l'application Android. */
    private void injecterPont() {
        versJs("window.dispatchEvent(new Event('clipia-android-pret'))");
    }

    private void versJs(final String code) {
        principal.post(() -> {
            if (vue != null) vue.evaluateJavascript(code, null);
        });
    }

    private static String texteJs(String t) {
        return JSONObject.quote(t == null ? "" : t);
    }

    // ------------------------------------------------------------------
    // Permission micro
    // ------------------------------------------------------------------
    private boolean microAutorise() {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
                == PackageManager.PERMISSION_GRANTED;
    }

    @Override
    public void onRequestPermissionsResult(int code, @NonNull String[] perms, @NonNull int[] res) {
        super.onRequestPermissionsResult(code, perms, res);
        if (code != DEMANDE_MICRO) return;
        boolean ok = res.length > 0 && res[0] == PackageManager.PERMISSION_GRANTED;
        if (ok && microDemandeApresPermission) demarrerEcouteInterne();
        else if (!ok) versJs("window.__clipiaVoix&&window.__clipiaVoix.erreur('not-allowed')");
        microDemandeApresPermission = false;
    }

    // ------------------------------------------------------------------
    // Reconnaissance vocale
    // ------------------------------------------------------------------
    private void demarrerEcouteInterne() {
        if (ecouteEnCours) return;

        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            versJs("window.__clipiaVoix&&window.__clipiaVoix.erreur('indisponible')");
            return;
        }
        if (!microAutorise()) {
            microDemandeApresPermission = true;
            ActivityCompat.requestPermissions(this,
                    new String[]{Manifest.permission.RECORD_AUDIO}, DEMANDE_MICRO);
            return;
        }
        if (voix != null) voix.stop();

        libererMicro();
        micro = SpeechRecognizer.createSpeechRecognizer(this);
        micro.setRecognitionListener(new RecognitionListener() {
            @Override public void onReadyForSpeech(Bundle b) {
                ecouteEnCours = true;
                versJs("window.__clipiaVoix&&window.__clipiaVoix.debut()");
            }
            @Override public void onBeginningOfSpeech() {}
            @Override public void onRmsChanged(float v) { versJs("window.__clipiaVoix&&window.__clipiaVoix.niveau&&window.__clipiaVoix.niveau(" + v + ")"); }
            @Override public void onBufferReceived(byte[] b) {}
            @Override public void onEndOfSpeech() {}

            @Override public void onError(int code) {
                ecouteEnCours = false;
                versJs("window.__clipiaVoix&&window.__clipiaVoix.erreur(" + texteJs(nomErreur(code)) + ")");
            }

            @Override public void onResults(Bundle b) {
                ecouteEnCours = false;
                ArrayList<String> l = b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                String t = (l != null && !l.isEmpty()) ? l.get(0) : "";
                versJs("window.__clipiaVoix&&window.__clipiaVoix.final(" + texteJs(t) + ")");
            }

            @Override public void onPartialResults(Bundle b) {
                ArrayList<String> l = b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                if (l != null && !l.isEmpty()) {
                    versJs("window.__clipiaVoix&&window.__clipiaVoix.partiel(" + texteJs(l.get(0)) + ")");
                }
            }

            @Override public void onEvent(int i, Bundle b) {}
        });

        Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "fr-FR");
        i.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        i.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, getPackageName());
        i.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 1300L);
        i.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 1300L);
        try { micro.startListening(i); }
        catch (Exception e) {
            ecouteEnCours = false;
            versJs("window.__clipiaVoix&&window.__clipiaVoix.erreur('demarrage')");
        }
    }

    private void arreterEcouteInterne() {
        if (micro != null) { try { micro.stopListening(); } catch (Exception ignore) {} }
        ecouteEnCours = false;
    }

    private void libererMicro() {
        if (micro != null) {
            try { micro.cancel(); micro.destroy(); } catch (Exception ignore) {}
            micro = null;
        }
        ecouteEnCours = false;
    }

    private static String nomErreur(int code) {
        switch (code) {
            case SpeechRecognizer.ERROR_AUDIO: return "audio";
            case SpeechRecognizer.ERROR_CLIENT: return "client";
            case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS: return "not-allowed";
            case SpeechRecognizer.ERROR_NETWORK:
            case SpeechRecognizer.ERROR_NETWORK_TIMEOUT: return "reseau";
            case SpeechRecognizer.ERROR_NO_MATCH: return "no-speech";
            case SpeechRecognizer.ERROR_SPEECH_TIMEOUT: return "no-speech";
            case SpeechRecognizer.ERROR_RECOGNIZER_BUSY: return "occupe";
            default: return "inconnu";
        }
    }

    // ------------------------------------------------------------------
    // Synthese vocale
    // ------------------------------------------------------------------
    private void preparerVoix() {
        voix = new TextToSpeech(this, statut -> {
            voixPrete = (statut == TextToSpeech.SUCCESS);
            if (!voixPrete) return;
            try { voix.setLanguage(Locale.FRENCH); } catch (Exception ignore) {}
            voix.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                @Override public void onStart(String id) {
                    if (id != null && id.startsWith("synth:")) return;
                    versJs("window.__clipiaVoix&&window.__clipiaVoix.paroleDebut()");
                }
                @Override public void onDone(String id) {
                    if (id != null && id.startsWith("synth:")) { synthTermine(id, true); return; }
                    versJs("window.__clipiaVoix&&window.__clipiaVoix.paroleFin()");
                }
                @Override public void onError(String id) {
                    if (id != null && id.startsWith("synth:")) { synthTermine(id, false); return; }
                    versJs("window.__clipiaVoix&&window.__clipiaVoix.paroleFin()");
                }
            });
            versJs("window.dispatchEvent(new Event('clipia-voix-prete'))");
        });
    }

    private void parlerInterne(String texte) {
        if (!voixPrete || voix == null || texte == null || texte.trim().isEmpty()) {
            versJs("window.__clipiaVoix&&window.__clipiaVoix.paroleFin()");
            return;
        }
        arreterEcouteInterne();
        voix.setSpeechRate(vitesseVoix);
        voix.setPitch(hauteurVoix);
        if (voixChoisie != null) appliquerVoix(voixChoisie);
        HashMap<String, String> p = new HashMap<>();
        p.put(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, "clipia");
        voix.speak(texte, TextToSpeech.QUEUE_FLUSH, p);
    }

    /** Fin de la synthese vers un fichier : renvoie le WAV en base64 a la page. */
    private void synthTermine(String id, boolean ok) {
        File f = synthFichiers.remove(id);
        String b64 = "";
        try {
            if (ok && f != null && f.exists()) {
                java.io.FileInputStream in = new java.io.FileInputStream(f);
                ByteArrayOutputStream bo = new ByteArrayOutputStream();
                byte[] buf = new byte[16384]; int n;
                while ((n = in.read(buf)) > 0) bo.write(buf, 0, n);
                in.close();
                b64 = Base64.encodeToString(bo.toByteArray(), Base64.NO_WRAP);
            }
        } catch (Exception e) { ok = false; }
        if (f != null) f.delete();
        versJs("window.__clipiaSynth&&window.__clipiaSynth(" + texteJs(id.substring(6)) + "," + (ok && !b64.isEmpty()) + "," + texteJs(b64) + ")");
    }

    private void appliquerVoix(String nom) {
        try {
            Set<Voice> dispo = voix.getVoices();
            if (dispo == null) return;
            for (Voice v : dispo) {
                if (nom.equals(v.getName())) { voix.setVoice(v); return; }
            }
        } catch (Exception ignore) {}
    }

    private java.io.OutputStream flux; private Uri fluxUri; private String fluxNom = "", fluxMime = "", fluxChemin = "";
    private int fluxCompteur = 0;
    private final HashMap<String, Uri> fichiers = new HashMap<>();
    private void fermerFlux() { try { if (flux != null) flux.close(); } catch (Exception ignore) {} flux = null; }
    private String mimeDe(Uri u) { try { String t = getContentResolver().getType(u); return t == null ? "*/*" : t; } catch (Exception e) { return "*/*"; } }

    // ------------------------------------------------------------------
    // Pont expose a la page
    // ------------------------------------------------------------------
    private class Pont {

        @JavascriptInterface
        public String version() { return "8.5.0"; }

        @JavascriptInterface
        public boolean voixNative() { return true; }

        @JavascriptInterface
        public void ecouter() { principal.post(MainActivity.this::demarrerEcouteInterne); }

        @JavascriptInterface
        public void stopEcoute() { principal.post(MainActivity.this::arreterEcouteInterne); }

        @JavascriptInterface
        public void parler(final String texte) { principal.post(() -> parlerInterne(texte)); }

        @JavascriptInterface
        public void stopParole() {
            principal.post(() -> { if (voix != null) voix.stop(); });
        }

        @JavascriptInterface
        public void reglerVitesse(final float v) {
            vitesseVoix = (v < 0.5f) ? 0.5f : (v > 2.0f ? 2.0f : v);
        }

        @JavascriptInterface
        public void reglerHauteur(final float v) {
            hauteurVoix = (v < 0.5f) ? 0.5f : (v > 2.0f ? 2.0f : v);
        }

        /** Fabrique un fichier WAV de narration. Reponse : __clipiaSynth(id, ok, base64). */
        @JavascriptInterface
        public void synthetiser(final String id, final String texte, final String nomVoix, final float vitesse, final float hauteur) {
            principal.post(() -> {
                if (!voixPrete || voix == null || texte == null || texte.trim().isEmpty()) {
                    versJs("window.__clipiaSynth&&window.__clipiaSynth(" + texteJs(id) + ",false,\"\")");
                    return;
                }
                try {
                    voix.setSpeechRate(vitesse < 0.5f ? 0.5f : (vitesse > 2f ? 2f : vitesse));
                    voix.setPitch(hauteur < 0.5f ? 0.5f : (hauteur > 2f ? 2f : hauteur));
                    if (nomVoix != null && !nomVoix.isEmpty()) appliquerVoix(nomVoix);
                    File f = new File(getCacheDir(), "synth-" + id + ".wav");
                    synthFichiers.put("synth:" + id, f);
                    Bundle b = new Bundle();
                    int r = voix.synthesizeToFile(texte, b, f, "synth:" + id);
                    if (r != TextToSpeech.SUCCESS) synthTermine("synth:" + id, false);
                } catch (Exception e) { synthTermine("synth:" + id, false); }
            });
        }

        @JavascriptInterface
        public void choisirVoix(final String nom) {
            voixChoisie = (nom == null || nom.isEmpty()) ? null : nom;
        }

        @JavascriptInterface
        public String listeVoix() {
            JSONArray out = new JSONArray();
            try {
                if (voix != null && voixPrete && voix.getVoices() != null) {
                    for (Voice v : voix.getVoices()) {
                        String langue = v.getLocale() != null ? v.getLocale().toString() : "";
                        if (!langue.toLowerCase(Locale.ROOT).startsWith("fr")) continue;
                        JSONObject o = new JSONObject();
                        o.put("nom", v.getName());
                        o.put("langue", langue);
                        out.put(o);
                    }
                }
            } catch (Exception ignore) {}
            return out.toString();
        }

        /** Appel vers Clipia sur le PC de la personne (adresse locale en http possible). Reponse rendue a la page par __clipiaPC(id, ok, texte). */
        @JavascriptInterface
        public void requetePC(final String id, final String url, final String jeton, final String corps) {
            new Thread(() -> {
                boolean ok = false; String texte;
                HttpURLConnection c = null;
                try {
                    c = (HttpURLConnection) new URL(url).openConnection();
                    c.setRequestMethod("POST");
                    c.setConnectTimeout(8000);
                    c.setReadTimeout(120000);
                    c.setDoOutput(true);
                    c.setRequestProperty("Content-Type", "application/json");
                    c.setRequestProperty("Accept", "application/json");
                    if (jeton != null && !jeton.isEmpty()) c.setRequestProperty("Authorization", "Bearer " + jeton);
                    byte[] b = corps.getBytes(StandardCharsets.UTF_8);
                    try (OutputStream o = c.getOutputStream()) { o.write(b); }
                    int code = c.getResponseCode();
                    java.io.InputStream in = code >= 400 ? c.getErrorStream() : c.getInputStream();
                    StringBuilder sb = new StringBuilder();
                    if (in != null) {
                        try (BufferedReader r = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8))) {
                            String l; while ((l = r.readLine()) != null) sb.append(l).append('\n');
                        }
                    }
                    ok = code < 400;
                    texte = ok ? sb.toString() : ("HTTP " + code + " " + sb);
                } catch (Exception e) {
                    texte = String.valueOf(e.getMessage());
                } finally {
                    if (c != null) c.disconnect();
                }
                final boolean fok = ok; final String ft = texte;
                versJs("window.__clipiaPC&&window.__clipiaPC(" + texteJs(id) + "," + fok + "," + texteJs(ft) + ")");
            }).start();
        }

        /** Requete HTTP native (sans restriction CORS). Reponse : __clipiaHttp(id, ok, statut, mime, donnees) ; donnees en base64 si mode = "binaire". */
        @JavascriptInterface
        public void http(final String id, final String methode, final String url, final String entetes, final String corpsB64, final String mode) {
            new Thread(() -> {
                boolean ok = false; int code = 0; String mime = ""; String data = "";
                HttpURLConnection c = null;
                try {
                    c = (HttpURLConnection) new URL(url).openConnection();
                    c.setRequestMethod(methode == null || methode.isEmpty() ? "GET" : methode);
                    c.setConnectTimeout(15000);
                    c.setReadTimeout(240000);
                    c.setInstanceFollowRedirects(true);
                    c.setRequestProperty("User-Agent", uaWeb.isEmpty() ? "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36" : uaWeb);
                    c.setRequestProperty("Accept", "*/*");
                    if (entetes != null && !entetes.isEmpty()) {
                        JSONObject h = new JSONObject(entetes);
                        java.util.Iterator<String> it = h.keys();
                        while (it.hasNext()) { String k = it.next(); c.setRequestProperty(k, h.getString(k)); }
                    }
                    if (corpsB64 != null && !corpsB64.isEmpty()) {
                        c.setDoOutput(true);
                        byte[] b = Base64.decode(corpsB64, Base64.DEFAULT);
                        try (OutputStream o = c.getOutputStream()) { o.write(b); }
                    }
                    code = c.getResponseCode();
                    mime = c.getContentType() == null ? "" : c.getContentType();
                    java.io.InputStream in = code >= 400 ? c.getErrorStream() : c.getInputStream();
                    ByteArrayOutputStream bo = new ByteArrayOutputStream();
                    if (in != null) {
                        byte[] buf = new byte[16384]; int n;
                        while ((n = in.read(buf)) > 0) bo.write(buf, 0, n);
                        in.close();
                    }
                    byte[] rep = bo.toByteArray();
                    ok = code < 400;
                    data = "binaire".equals(mode) ? Base64.encodeToString(rep, Base64.NO_WRAP) : new String(rep, StandardCharsets.UTF_8);
                } catch (Exception e) {
                    data = String.valueOf(e.getMessage());
                } finally {
                    if (c != null) c.disconnect();
                }
                versJs("window.__clipiaHttp&&window.__clipiaHttp(" + texteJs(id) + "," + ok + "," + code + "," + texteJs(mime) + "," + texteJs(data) + ")");
            }).start();
        }

        /** Enregistrement d'un fichier dans Telechargements/Clipia, par morceaux base64. */
        @JavascriptInterface
        public boolean ecrireDebut(final String nom, final String mime) {
            try {
                fermerFlux();
                fluxNom = nom; fluxMime = mime; fluxUri = null;
                if (Build.VERSION.SDK_INT >= 29) {
                    ContentValues cv = new ContentValues();
                    cv.put(MediaStore.MediaColumns.DISPLAY_NAME, nom);
                    cv.put(MediaStore.MediaColumns.MIME_TYPE, mime);
                    cv.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Clipia");
                    fluxUri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
                    if (fluxUri == null) return false;
                    flux = getContentResolver().openOutputStream(fluxUri);
                } else {
                    File d = new File(getExternalFilesDir(null), "Clipia"); d.mkdirs();
                    flux = new FileOutputStream(new File(d, nom));
                    fluxChemin = new File(d, nom).getAbsolutePath();
                }
                return flux != null;
            } catch (Exception e) { return false; }
        }

        @JavascriptInterface
        public boolean ecrireMorceau(final String b64) {
            try { flux.write(Base64.decode(b64, Base64.DEFAULT)); return true; } catch (Exception e) { return false; }
        }

        @JavascriptInterface
        public String ecrireFin() {
            JSONObject o = new JSONObject();
            try {
                fermerFlux();
                String id = "f" + (++fluxCompteur);
                if (fluxUri != null) fichiers.put(id, fluxUri);
                o.put("ok", true); o.put("id", id);
                o.put("chemin", fluxUri != null ? ("Téléchargements/Clipia/" + fluxNom) : fluxChemin);
            } catch (Exception e) { try { o.put("ok", false); } catch (Exception ignore) {} }
            return o.toString();
        }

        @JavascriptInterface
        public void ouvrirFichier(final String id) {
            principal.post(() -> {
                Uri u = fichiers.get(id); if (u == null) return;
                try {
                    Intent i = new Intent(Intent.ACTION_VIEW).setDataAndType(u, mimeDe(u)).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(i);
                } catch (Exception ignore) {}
            });
        }

        @JavascriptInterface
        public void partagerFichier(final String id) {
            principal.post(() -> {
                Uri u = fichiers.get(id); if (u == null) return;
                try {
                    Intent i = new Intent(Intent.ACTION_SEND).setType(mimeDe(u)).putExtra(Intent.EXTRA_STREAM, u).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    startActivity(Intent.createChooser(i, "Partager").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
                } catch (Exception ignore) {}
            });
        }

        @JavascriptInterface
        public void ouvrirLien(final String url) {
            principal.post(() -> ouvrirDehors(Uri.parse(url)));
        }
    }
}
