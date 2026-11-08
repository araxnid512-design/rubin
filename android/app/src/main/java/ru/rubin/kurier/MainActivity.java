package ru.rubin.kurier;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

/** Курьер миров: игра из assets/index.html на весь экран. */
public class MainActivity extends Activity {
    private static final String GAME = "file:///android_asset/index.html";
    private WebView web;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON | WindowManager.LayoutParams.FLAG_FULLSCREEN);
        if (Build.VERSION.SDK_INT >= 28) {
            getWindow().getAttributes().layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }
        try {
            web = new WebView(this);
        } catch (Throwable e) {
            // На телефоне нет рабочего «Android System WebView»: объясняем, что делать, вместо молчаливого вылета.
            showNoWebView(e);
            return;
        }
        web.setBackgroundColor(0xFF08070F);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(true);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                // Процесс WebView упал (нехватка памяти и т. п.): пересоздаём экран, а не роняем приложение.
                recreate();
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient());
        setContentView(web);
        if (state != null) web.restoreState(state);
        else web.loadUrl(GAME);
    }

    private void showNoWebView(Throwable e) {
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setGravity(Gravity.CENTER);
        box.setBackgroundColor(0xFF08070F);
        box.setPadding(48, 48, 48, 48);
        TextView t = new TextView(this);
        t.setTextColor(Color.WHITE);
        t.setTextSize(18);
        t.setGravity(Gravity.CENTER);
        t.setText("Для игры нужен компонент «Android System WebView».\n\nОбновите или включите его в Play Маркете и откройте игру снова.\n\n(" + e.getClass().getSimpleName() + ")");
        Button b = new Button(this);
        b.setText("Открыть в Play Маркете");
        b.setOnClickListener(v -> {
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=com.google.android.webview")));
            } catch (Throwable ignored) {
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/apps/details?id=com.google.android.webview")));
            }
        });
        box.addView(t);
        box.addView(b);
        setContentView(box);
    }

    @SuppressWarnings("deprecation")
    private void immersive() {
        if (web == null) return;
        web.setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) immersive();
    }

    @Override
    protected void onPause() {
        if (web != null) web.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
        immersive();
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        if (web != null) web.saveState(out);
    }

    @Override
    protected void onDestroy() {
        if (web != null) web.destroy();
        super.onDestroy();
    }

    // «Назад» во время уровня ставит игру на паузу, в меню — закрывает приложение.
    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (web == null) { finish(); return; }
        web.evaluateJavascript("(window.K && K.debug) ? K.debug.mode() : ''", value -> {
            if ("\"play\"".equals(value) || "\"pause\"".equals(value)) {
                web.evaluateJavascript("window.dispatchEvent(new KeyboardEvent('keydown', {code: 'Escape'}))", null);
            } else {
                finish();
            }
        });
    }
}
