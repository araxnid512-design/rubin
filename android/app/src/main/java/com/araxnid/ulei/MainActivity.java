package com.araxnid.ulei;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.webkit.WebViewAssetLoader;

/**
 * Игра на весь экран, в горизонтальном положении: WebView открывает assets/index.html (скачиваемая версия —
 * всё встроено, сеть не нужна) с адреса https://appassets.androidplatform.net — у страницы постоянный адрес,
 * и сохранение в её localStorage переживает обновления приложения. Внешние ссылки (новая версия на GitHub)
 * открываются в браузере. «Назад» закрывает окно игры, а если открытых нет — сворачивает приложение.
 */
public class MainActivity extends Activity {
	private static final String HOST = "appassets.androidplatform.net";
	private WebView web;

	@Override
	protected void onCreate(Bundle state) {
		super.onCreate(state);
		getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
		final WebViewAssetLoader assets = new WebViewAssetLoader.Builder()
			.addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
			.build();
		web = new WebView(this);
		WebSettings s = web.getSettings();
		s.setJavaScriptEnabled(true);
		s.setDomStorageEnabled(true);
		s.setMediaPlaybackRequiresUserGesture(false);
		s.setAllowFileAccess(false);
		s.setAllowContentAccess(false);
		web.setWebViewClient(new WebViewClient() {
			@Override
			public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
				return assets.shouldInterceptRequest(request.getUrl());
			}

			@Override
			public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
				Uri url = request.getUrl();
				if (HOST.equals(url.getHost())) return false;
				try {
					startActivity(new Intent(Intent.ACTION_VIEW, url));
				} catch (Exception ignored) {
					// нет браузера — ничего не делаем
				}
				return true;
			}
		});
		setContentView(web);
		if (state != null) web.restoreState(state);
		else web.loadUrl("https://" + HOST + "/assets/index.html");
	}

	@Override
	public void onWindowFocusChanged(boolean focus) {
		super.onWindowFocusChanged(focus);
		if (focus) immersive();
	}

	/** Без строки состояния и кнопок навигации; свайп от края показывает их ненадолго. */
	@SuppressWarnings("deprecation")
	private void immersive() {
		getWindow().getDecorView().setSystemUiVisibility(
			View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
				| View.SYSTEM_UI_FLAG_FULLSCREEN
				| View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
				| View.SYSTEM_UI_FLAG_LAYOUT_STABLE
				| View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
				| View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
	}

	@Override
	@SuppressWarnings("deprecation")
	public void onBackPressed() {
		web.evaluateJavascript("window.__back ? window.__back() : false", (closed) -> {
			if (!"true".equals(closed)) moveTaskToBack(true);
		});
	}

	@Override
	protected void onPause() {
		web.onPause();
		super.onPause();
	}

	@Override
	protected void onResume() {
		super.onResume();
		web.onResume();
	}

	@Override
	protected void onSaveInstanceState(Bundle out) {
		super.onSaveInstanceState(out);
		web.saveState(out);
	}

	@Override
	protected void onDestroy() {
		web.destroy();
		super.onDestroy();
	}
}
