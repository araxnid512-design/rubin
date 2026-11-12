package com.deadworld.foothold;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.DisplayCutout;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * Обёртка для HTML5-игры «Мёртвый мир: Плацдарм».
 * Игра лежит в assets (папка game/ репозитория) и работает полностью офлайн.
 */
public class MainActivity extends Activity {
    private WebView web;
    private int cutLeft = 0;
    private int cutRight = 0;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        web = new WebView(this);
        web.setBackgroundColor(Color.BLACK);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        // атласы 3D-спрайтов (assets3d/*.webp) — тот же источник, что и страница: холсты не «пачкаются»
        s.setAllowFileAccessFromFileURLs(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setTextZoom(100);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);

        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        web.addJavascriptInterface(new Bridge(), "AndroidBridge");
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                applyCutout();
            }
        });
        web.setOnApplyWindowInsetsListener((v, insets) -> {
            int l = 0, r = 0;
            if (Build.VERSION.SDK_INT >= 28) {
                DisplayCutout dc = insets.getDisplayCutout();
                if (dc != null) {
                    l = dc.getSafeInsetLeft();
                    r = dc.getSafeInsetRight();
                }
            }
            float d = getResources().getDisplayMetrics().density;
            cutLeft = Math.round(l / d);
            cutRight = Math.round(r / d);
            applyCutout();
            return v.onApplyWindowInsets(insets);
        });

        hideSystemUi();
        web.loadUrl("file:///android_asset/index.html");
    }

    /** Передаём в CSS отступы под вырез камеры. */
    private void applyCutout() {
        if (web == null) return;
        web.evaluateJavascript(
                "document.documentElement.style.setProperty('--sl','" + cutLeft + "px');" +
                "document.documentElement.style.setProperty('--sr','" + cutRight + "px');", null);
    }

    @SuppressWarnings("deprecation")
    private void hideSystemUi() {
        Window w = getWindow();
        if (Build.VERSION.SDK_INT >= 30) {
            w.setDecorFitsSystemWindows(false);
            WindowInsetsController c = w.getInsetsController();
            if (c != null) {
                c.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            w.getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                            | View.SYSTEM_UI_FLAG_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemUi();
    }

    @Override
    protected void onPause() {
        if (web != null) {
            web.evaluateJavascript("window.DW && DW.onPause && DW.onPause();", null);
            web.onPause();
        }
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) {
            web.onResume();
            web.evaluateJavascript("window.DW && DW.onResume && DW.onResume();", null);
        }
        hideSystemUi();
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }

    /** Кнопка «Назад» обрабатывается игрой: закрывает окна или открывает меню. */
    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        if (web != null) web.evaluateJavascript("window.DW && DW.onBack ? DW.onBack() : false", null);
    }

    /** Мост JS → Android: сохранения в SharedPreferences и выход. */
    private class Bridge {
        private SharedPreferences prefs() {
            return getSharedPreferences("deadworld", Context.MODE_PRIVATE);
        }

        @JavascriptInterface
        public void save(String key, String value) {
            prefs().edit().putString(key, value).commit();
        }

        @JavascriptInterface
        public String load(String key) {
            return prefs().getString(key, null);
        }

        @JavascriptInterface
        public void remove(String key) {
            prefs().edit().remove(key).commit();
        }

        @JavascriptInterface
        public void exit() {
            runOnUiThread(MainActivity.this::finishAndRemoveTask);
        }
    }
}
