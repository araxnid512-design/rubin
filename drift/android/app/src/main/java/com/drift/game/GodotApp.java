package com.drift.game;

import org.godotengine.godot.Godot;
import org.godotengine.godot.GodotActivity;

/**
 * Активность BUNKER SURVIVAL: движок Godot (официальная библиотека) запускает игру из assets.
 * Полноэкранный режим без системных панелей.
 */
public class GodotApp extends GodotActivity {
	@Override
	public void onResume() {
		super.onResume();
		Godot godot = getGodot();
		if (godot != null) {
			godot.enableImmersiveMode(true, true);
		}
	}
}
