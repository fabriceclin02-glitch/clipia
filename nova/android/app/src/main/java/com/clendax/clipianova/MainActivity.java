package com.clendax.clipianova;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.InputType;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputMethodManager;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ProgressBar;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Scanner;

/**
 * Clipia Nova pour Android — navigateur CLENDAX avec IA Clipia, Store et bouclier.
 */
public class MainActivity extends Activity {

    static final String HOME = "file:///android_asset/nova/index.html";

    WebView web;
    EditText url;
    ProgressBar progress;
    volatile String currentUrl = HOME;
    volatile String pageContext = "";
    volatile int blocked = 0;
    final Handler ui = new Handler(Looper.getMainLooper());
    SharedPreferences prefs;

    static final String[] TRACKERS = {
        "doubleclick.net", "google-analytics.com", "googletagmanager.com", "googlesyndication.com",
        "googleadservices.com", "adservice.google.com", "scorecardresearch.com", "quantserve.com",
        "criteo.com", "criteo.net", "taboola.com", "outbrain.com", "adnxs.com", "amazon-adsystem.com",
        "hotjar.com", "hotjar.io", "mixpanel.com", "segment.io", "moatads.com", "rubiconproject.com",
        "pubmatic.com", "openx.net", "casalemedia.com", "smartadserver.com", "adsrvr.org", "teads.tv",
        "clarity.ms", "bat.bing.com", "ads-twitter.com", "analytics.tiktok.com"
    };

    int dp(int v) { return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics()); }

    Button barButton(String label) {
        Button b = new Button(this);
        b.setText(label);
        b.setTextColor(Color.parseColor("#ECEBFF"));
        b.setTextSize(18);
        b.setAllCaps(false);
        b.setBackgroundColor(Color.TRANSPARENT);
        b.setMinWidth(0); b.setMinimumWidth(0);
        b.setPadding(dp(10), 0, dp(10), 0);
        return b;
    }

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        prefs = getSharedPreferences("nova", Context.MODE_PRIVATE);
        getWindow().setStatusBarColor(Color.parseColor("#07061A"));
        getWindow().setNavigationBarColor(Color.parseColor("#07061A"));

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.parseColor("#07061A"));

        // ---- Barre du haut ----
        LinearLayout bar = new LinearLayout(this);
        bar.setOrientation(LinearLayout.HORIZONTAL);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        bar.setPadding(dp(4), dp(6), dp(4), dp(6));
        bar.setBackgroundColor(Color.parseColor("#0F0D2A"));

        Button home = barButton("⌂");
        home.setOnClickListener(v -> web.loadUrl(HOME));
        bar.addView(home, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, dp(44)));

        url = new EditText(this);
        url.setSingleLine(true);
        url.setHint("Rechercher ou saisir une adresse");
        url.setHintTextColor(Color.parseColor("#7C78A8"));
        url.setTextColor(Color.parseColor("#ECEBFF"));
        url.setTextSize(15);
        url.setInputType(InputType.TYPE_TEXT_VARIATION_URI);
        url.setImeOptions(EditorInfo.IME_ACTION_GO);
        url.setSelectAllOnFocus(true);
        GradientDrawable pill = new GradientDrawable();
        pill.setColor(Color.parseColor("#0A0824"));
        pill.setCornerRadius(dp(22));
        pill.setStroke(dp(1), Color.parseColor("#2A2560"));
        url.setBackground(pill);
        url.setPadding(dp(16), 0, dp(16), 0);
        url.setOnEditorActionListener((v, actionId, e) -> {
            if (actionId == EditorInfo.IME_ACTION_GO || (e != null && e.getKeyCode() == KeyEvent.KEYCODE_ENTER)) {
                go(url.getText().toString());
                hideKeyboard();
                return true;
            }
            return false;
        });
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, dp(44), 1f);
        bar.addView(url, lp);

        Button ai = barButton("✦");
        ai.setTextColor(Color.parseColor("#C4B5FD"));
        ai.setOnClickListener(v -> openClipia());
        bar.addView(ai, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, dp(44)));
        root.addView(bar);

        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setMax(100);
        progress.setProgressTintList(android.content.res.ColorStateList.valueOf(Color.parseColor("#8B5CF6")));
        root.addView(progress, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(3)));

        // ---- Le navigateur ----
        web = new WebView(this);
        root.addView(web, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f));
        setContentView(root);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setSupportZoom(true);
        s.setBuiltInZoomControls(true);
        s.setDisplayZoomControls(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setUserAgentString(s.getUserAgentString().replace("; wv", ""));

        CookieManager cm = CookieManager.getInstance();
        cm.setAcceptCookie(true);
        cm.setAcceptThirdPartyCookies(web, false); // bouclier : pas de cookies tiers

        web.addJavascriptInterface(new Bridge(), "NovaAndroid");
        web.setWebViewClient(new NovaClient());
        web.setWebChromeClient(new NovaChrome());

        Intent it = getIntent();
        if (it != null && it.getData() != null) web.loadUrl(upgrade(it.getData().toString()));
        else web.loadUrl(HOME);
    }

    void hideKeyboard() {
        InputMethodManager imm = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
        if (imm != null) imm.hideSoftInputFromWindow(url.getWindowToken(), 0);
        url.clearFocus();
    }

    boolean shieldOn(String k) { return prefs.getBoolean(k, true); }

    String upgrade(String u) {
        if (shieldOn("https") && u.startsWith("http://") && !u.startsWith("http://localhost") && !u.startsWith("http://192.168.")) {
            return "https://" + u.substring(7);
        }
        return u;
    }

    void go(String input) {
        String q = input.trim();
        if (q.isEmpty()) return;
        String target;
        if (q.startsWith("https://") || q.startsWith("http://")) target = q;
        else if (q.matches("^[\\w-]+(\\.[\\w-]+)+(:\\d+)?(/\\S*)?$")) target = "https://" + q;
        else {
            String engine = prefs.getString("engineUrl", "https://www.google.com/search?q=");
            try { target = engine + URLEncoder.encode(q, "UTF-8"); } catch (Exception e) { target = engine + q; }
        }
        web.loadUrl(upgrade(target));
    }

    /** Ouvre Clipia IA ; sur une page web, on transmet son contenu pour résumer/traduire. */
    void openClipia() {
        if (currentUrl.startsWith(HOME)) {
            web.evaluateJavascript("window.novaShow && novaShow('ai')", null);
            return;
        }
        final String from = currentUrl;
        web.evaluateJavascript("JSON.stringify({title:document.title,url:location.href,text:(document.body?document.body.innerText:'').slice(0,12000)})", value -> {
            try {
                pageContext = new JSONArray("[" + value + "]").getString(0);
            } catch (Exception e) { pageContext = ""; }
            web.loadUrl(HOME + "#ai");
        });
    }

    boolean isTracker(String host) {
        if (host == null) return false;
        for (String t : TRACKERS) if (host.equals(t) || host.endsWith("." + t)) return true;
        return false;
    }

    class NovaClient extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
            String u = req.getUrl().toString();
            if (u.startsWith("http://") && shieldOn("https")) { view.loadUrl(upgrade(u)); return true; }
            if (u.startsWith("https://") || u.startsWith("http://") || u.startsWith("file:///android_asset/")) return false;
            try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(u))); } catch (Exception ignored) {}
            return true;
        }

        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
            if (shieldOn("trackers") && !req.isForMainFrame() && isTracker(req.getUrl().getHost())) {
                blocked++;
                return new WebResourceResponse("text/plain", "utf-8", new ByteArrayInputStream(new byte[0]));
            }
            return null;
        }

        @Override
        public void onPageStarted(WebView view, String u, Bitmap favicon) {
            currentUrl = u;
            url.setText(u.startsWith(HOME) ? "" : u);
        }

        @Override
        public void onPageFinished(WebView view, String u) {
            currentUrl = u;
            if (!u.startsWith(HOME)) {
                String t = view.getTitle();
                try {
                    JSONArray h = new JSONArray(prefs.getString("history", "[]"));
                    JSONArray n = new JSONArray();
                    n.put(new JSONObject().put("url", u).put("title", t == null ? u : t));
                    for (int i = 0; i < h.length() && n.length() < 30; i++) {
                        if (!h.getJSONObject(i).optString("url").equals(u)) n.put(h.getJSONObject(i));
                    }
                    prefs.edit().putString("history", n.toString()).apply();
                } catch (Exception ignored) {}
            }
        }
    }

    class NovaChrome extends WebChromeClient {
        @Override public void onProgressChanged(WebView v, int p) { progress.setProgress(p); progress.setVisibility(p >= 100 ? View.INVISIBLE : View.VISIBLE); }

        @Override
        public void onPermissionRequest(final PermissionRequest request) {
            ui.post(() -> new AlertDialog.Builder(MainActivity.this)
                .setTitle("Bouclier Clipia Nova")
                .setMessage(request.getOrigin().getHost() + " demande l'accès à la caméra ou au micro.")
                .setNegativeButton("Refuser", (d, w) -> request.deny())
                .setPositiveButton("Autoriser", (d, w) -> request.grant(request.getResources()))
                .setCancelable(false).show());
        }

        @Override
        public void onGeolocationPermissionsShowPrompt(final String origin, final GeolocationPermissions.Callback cb) {
            ui.post(() -> new AlertDialog.Builder(MainActivity.this)
                .setTitle("Bouclier Clipia Nova")
                .setMessage(origin + " veut connaître votre position.")
                .setNegativeButton("Refuser", (d, w) -> cb.invoke(origin, false, false))
                .setPositiveButton("Autoriser", (d, w) -> cb.invoke(origin, true, false))
                .setCancelable(false).show());
        }
    }

    /** Pont réservé aux pages internes de Clipia Nova : un site web ne peut jamais l'utiliser. */
    class Bridge {
        boolean trusted() { return currentUrl != null && currentUrl.startsWith(HOME); }

        @JavascriptInterface public String get(String key) { return trusted() ? prefs.getString("js_" + key, "") : ""; }
        @JavascriptInterface public void set(String key, String value) { if (trusted()) prefs.edit().putString("js_" + key, value).apply(); }
        @JavascriptInterface public int blocked() { return blocked; }
        @JavascriptInterface public String history() { return trusted() ? prefs.getString("history", "[]") : "[]"; }
        @JavascriptInterface public void clearHistory() { if (trusted()) ui.post(() -> { prefs.edit().remove("history").apply(); web.clearCache(true); CookieManager.getInstance().removeAllCookies(null); }); }
        @JavascriptInterface public String pageContext() { if (!trusted()) return ""; String p = pageContext; pageContext = ""; return p; }
        @JavascriptInterface public void shield(String key, boolean on) { if (trusted()) prefs.edit().putBoolean(key, on).apply(); }
        @JavascriptInterface public void engine(String engineUrl) { if (trusted()) prefs.edit().putString("engineUrl", engineUrl).apply(); }
        @JavascriptInterface public void open(String u) { if (trusted()) ui.post(() -> go(u)); }
        @JavascriptInterface public void openOutside(String u) {
            if (!trusted()) return;
            ui.post(() -> { try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(u))); } catch (Exception ignored) {} });
        }

        /** Appel IA en arrière-plan ; la réponse revient par window.novaAI(id, json). */
        @JavascriptInterface public void request(final String id, final String method, final String endpoint, final String headersJson, final String body) {
            if (!trusted()) return;
            new Thread(() -> {
                JSONObject out = new JSONObject();
                try {
                    HttpURLConnection c = (HttpURLConnection) new URL(endpoint).openConnection();
                    c.setRequestMethod(method);
                    c.setConnectTimeout(20000);
                    c.setReadTimeout(120000);
                    JSONObject h = new JSONObject(headersJson);
                    java.util.Iterator<String> it = h.keys();
                    while (it.hasNext()) { String k = it.next(); c.setRequestProperty(k, h.getString(k)); }
                    if (body != null && !body.isEmpty()) {
                        c.setDoOutput(true);
                        try (OutputStream os = c.getOutputStream()) { os.write(body.getBytes(StandardCharsets.UTF_8)); }
                    }
                    int code = c.getResponseCode();
                    InputStream is = code >= 400 ? c.getErrorStream() : c.getInputStream();
                    String txt = "";
                    if (is != null) { Scanner sc = new Scanner(is, "UTF-8").useDelimiter("\\A"); txt = sc.hasNext() ? sc.next() : ""; }
                    out.put("status", code).put("body", txt);
                } catch (Exception e) {
                    try { out.put("status", 0).put("body", "").put("error", String.valueOf(e.getMessage())); } catch (Exception ignored) {}
                }
                final String js = "window.novaAI && novaAI(" + JSONObject.quote(id) + "," + JSONObject.quote(out.toString()) + ")";
                ui.post(() -> { if (trusted()) web.evaluateJavascript(js, null); });
            }).start();
        }
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (intent != null && intent.getData() != null) web.loadUrl(upgrade(intent.getData().toString()));
    }
}
