package ru.livebook.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.background
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.core.view.WindowCompat

class MainActivity : ComponentActivity() {
    private val vm: MainViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        setContent { LiveBookTheme { Root(vm) } }
    }

    override fun onResume() { super.onResume(); vm.narrator.refresh() }
    override fun onStop() { super.onStop(); vm.narrator.queue.pause() }
}

private val Dark = darkColorScheme(
    primary = Color(0xFFE0A040), onPrimary = Color(0xFF241A08), secondary = Color(0xFF9DB7A4), onSecondary = Color(0xFF10201A),
    background = Color(0xFF17140F), onBackground = Color(0xFFE9DFC8), surface = Color(0xFF211D16), onSurface = Color(0xFFE9DFC8),
    surfaceVariant = Color(0xFF2C271E), onSurfaceVariant = Color(0xFFB5AA92), outline = Color(0xFF5A5142), error = Color(0xFFE5806B), onError = Color(0xFF2B0D06),
    surfaceContainer = Color(0xFF211D16), surfaceContainerHigh = Color(0xFF2C271E), surfaceContainerLow = Color(0xFF1C1813),
)
private val Light = lightColorScheme(
    primary = Color(0xFF8A5A10), onPrimary = Color(0xFFFFF8EA), secondary = Color(0xFF3F6B55), onSecondary = Color.White,
    background = Color(0xFFF3ECDB), onBackground = Color(0xFF2A241A), surface = Color(0xFFFBF6EA), onSurface = Color(0xFF2A241A),
    surfaceVariant = Color(0xFFE8DFC9), onSurfaceVariant = Color(0xFF5E5544), outline = Color(0xFFB3A78D), error = Color(0xFFA63A22), onError = Color.White,
    surfaceContainer = Color(0xFFFBF6EA), surfaceContainerHigh = Color(0xFFE8DFC9), surfaceContainerLow = Color(0xFFF7F1E2),
)

@Composable
fun LiveBookTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = if (isSystemInDarkTheme()) Dark else Light, typography = Typography(), content = content)
}

@Composable
fun Root(vm: MainViewModel) {
    val ui by vm.ui.collectAsState()
    val voice by vm.voice.collectAsState()
    BackHandler(enabled = ui.screen != Screen.LIBRARY) { vm.go(if (ui.screen == Screen.GAME && ui.book != null) Screen.BOOK else Screen.LIBRARY) }
    Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background).safeDrawingPadding()) {
        when (ui.screen) {
            Screen.LIBRARY -> LibraryScreen(vm, ui, voice)
            Screen.BOOK -> BookScreen(vm, ui)
            Screen.GAME -> GameScreen(vm, ui, voice)
            Screen.SETTINGS -> SettingsScreen(vm, ui, voice)
        }
        Overlays(vm, ui)
    }
}
