package ru.livebook.app

import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.ScrollableTabRow
import androidx.compose.material3.Surface
import androidx.compose.material3.Tab
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.livebook.core.game.GameOrchestrator
import ru.livebook.core.narration.NarrationQueue

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GameScreen(vm: MainViewModel, ui: UiState, voice: VoiceState) {
    val g = ui.game ?: return
    var input by rememberSaveable(g.id) { mutableStateOf("") }
    var sheet by rememberSaveable { mutableStateOf(false) }
    val list = rememberLazyListState()
    val keyboard = LocalSoftwareKeyboardController.current
    val scale = ui.prefs.fontScale
    val count = g.feed.size + (if (g.streaming.isNotEmpty() || g.status.isNotEmpty()) 1 else 0)
    LaunchedEffect(count, g.streaming.length / 40) { if (count > 0) list.scrollToItem(count - 1, 100000) }
    fun submit() { val t = input.trim(); if (t.isNotEmpty() && !g.busy) { input = ""; keyboard?.hide(); vm.send(t) } }

    Column(Modifier.fillMaxSize()) {
        // Шапка: место и короткая панель состояния.
        Row(Modifier.fillMaxWidth().padding(start = 4.dp, end = 8.dp, top = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            TextButton(onClick = { vm.go(if (ui.book != null) Screen.BOOK else Screen.LIBRARY) }) { Text("←") }
            Column(Modifier.weight(1f)) {
                Text(g.state.location, style = MaterialTheme.typography.titleMedium, fontFamily = FontFamily.Serif, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text("${g.state.hero.name} · здоровье ${g.state.hero.hp}/${g.state.hero.maxHp} · монеты ${g.state.hero.gold} · ход ${g.state.timeTick}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            OutlinedButton(onClick = { sheet = true }) { Text("Лист героя") }
        }
        HorizontalDivider(Modifier.padding(top = 4.dp))

        LazyColumn(Modifier.weight(1f).fillMaxWidth().padding(horizontal = 14.dp), state = list, verticalArrangement = Arrangement.spacedBy(10.dp)) {
            item { Spacer(Modifier.height(4.dp)) }
            items(g.feed) { item -> FeedRow(item, scale) }
            if (g.streaming.isNotEmpty()) item { Text(g.streaming, fontFamily = FontFamily.Serif, fontSize = (18 * scale).sp, lineHeight = (27 * scale).sp) }
            else if (g.status.isNotEmpty()) item { Text(g.status, fontStyle = FontStyle.Italic, color = MaterialTheme.colorScheme.onSurfaceVariant) }
            item { Spacer(Modifier.height(4.dp)) }
        }
        if (g.busy) LinearProgressIndicator(Modifier.fillMaxWidth())

        // Голос рассказчика.
        Row(Modifier.fillMaxWidth().padding(horizontal = 10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            if (voice.status == "ready") {
                when (voice.playback) {
                    NarrationQueue.State.PLAYING -> TextButton(onClick = { vm.narrator.queue.pause() }) { Text("Пауза") }
                    NarrationQueue.State.PAUSED -> TextButton(onClick = { vm.narrator.queue.resume() }) { Text("Продолжить") }
                    else -> TextButton(onClick = { val last = g.feed.lastOrNull { it.kind == "narrator" || it.kind == "system" }; if (last != null) vm.narrator.queue.setText(ru.livebook.core.model.Text.splitSentences(last.text), true) }) { Text("Прочитать вслух") }
                }
                if (voice.playback != NarrationQueue.State.IDLE) TextButton(onClick = { vm.narrator.queue.stop() }) { Text("Стоп") }
            } else Text("Озвучка недоступна — см. «Настройки»", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(8.dp))
            Spacer(Modifier.weight(1f))
            if (g.lastStats.isNotEmpty() && !g.busy) Text(g.lastStats.substringAfterLast("· "), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }

        // Необязательные подсказки: по нажатию текст попадает в поле ввода, его можно изменить.
        if (g.suggestions.isNotEmpty() && !g.busy && ui.prefs.suggestions) {
            Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 10.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                g.suggestions.forEach { s -> Surface(color = MaterialTheme.colorScheme.surfaceVariant, shape = RoundedCornerShape(16.dp), modifier = Modifier.clickable { input = s }) { Text(s, modifier = Modifier.padding(horizontal = 12.dp, vertical = 7.dp), style = MaterialTheme.typography.bodyMedium) } }
            }
        }

        Row(Modifier.fillMaxWidth().padding(10.dp), verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(
                value = input, onValueChange = { input = it.take(300) }, modifier = Modifier.weight(1f).heightIn(min = 54.dp), placeholder = { Text("Что ты делаешь?") }, maxLines = 4,
                keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences, imeAction = ImeAction.Send), keyboardActions = KeyboardActions(onSend = { submit() }),
            )
            if (g.busy) OutlinedButton(onClick = { vm.cancelGeneration() }, modifier = Modifier.height(54.dp)) { Text("Стоп") }
            else Button(onClick = { submit() }, enabled = input.isNotBlank(), modifier = Modifier.height(54.dp)) { Text("Отправить") }
        }
    }

    if (sheet) {
        ModalBottomSheet(onDismissRequest = { sheet = false }, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) { HeroSheet(vm, ui, g, voice) }
    }
}

@Composable
fun FeedRow(item: FeedItem, scale: Float) {
    when (item.kind) {
        "hero" -> Text("— " + item.text, color = MaterialTheme.colorScheme.primary, fontSize = (16 * scale).sp, lineHeight = (23 * scale).sp)
        "narrator" -> Column {
            Text(item.text, fontFamily = FontFamily.Serif, fontSize = (18 * scale).sp, lineHeight = (27 * scale).sp)
            if (item.meta.isNotEmpty()) Text(item.meta, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.secondary, modifier = Modifier.padding(top = 3.dp))
        }
        "system" -> Surface(color = MaterialTheme.colorScheme.surfaceVariant, shape = RoundedCornerShape(8.dp)) { Text(item.text, modifier = Modifier.padding(10.dp), fontSize = (15 * scale).sp) }
        else -> Text(item.text, color = MaterialTheme.colorScheme.error, fontSize = (14 * scale).sp)
    }
}

@Composable
fun HeroSheet(vm: MainViewModel, ui: UiState, g: GameUi, voice: VoiceState) {
    var tab by remember { mutableIntStateOf(0) }
    val tabs = listOf("Герой", "Инвентарь", "Журнал", "Персонажи", "Книга", "Настройки")
    val s = g.state
    Column(Modifier.fillMaxWidth().heightIn(min = 360.dp)) {
        ScrollableTabRow(selectedTabIndex = tab, edgePadding = 8.dp) { tabs.forEachIndexed { i, t -> Tab(selected = tab == i, onClick = { tab = i }, text = { Text(t) }) } }
        Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            when (tab) {
                0 -> {
                    Text(s.hero.name + if (s.hero.role.isBlank()) "" else ", " + s.hero.role, style = MaterialTheme.typography.titleLarge, fontFamily = FontFamily.Serif)
                    Text("Здоровье ${s.hero.hp} из ${s.hero.maxHp} · монеты ${s.hero.gold}")
                    Dim("Место: ${s.location} · ход ${s.timeTick} · режим: ${if (s.storyMode == "canon") "ближе к канону" else "свободная история"}")
                    Label("Задания")
                    if (s.quests.isEmpty()) Dim("Пока нет. Задание появится, когда герой что-то пообещает («обещаю найти…»).")
                    s.quests.forEach { q -> Text((if (q.status == "done") "✓ " else "• ") + q.title) }
                    Label("Сохранения")
                    Dim("Игра сохраняется сама после каждого хода. Слоты — для ручных точек возврата.")
                    (1..3).forEach { n ->
                        val slot = g.slots.firstOrNull { it.slot == n }
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text("Слот $n: " + (slot?.label ?: "пусто"), modifier = Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
                            TextButton(onClick = { vm.saveSlot(n) }, enabled = !g.busy) { Text("Сохранить") }
                            TextButton(onClick = { vm.loadSlot(n) }, enabled = slot != null && !g.busy) { Text("Загрузить") }
                        }
                    }
                    OutlinedButton(onClick = { vm.undo() }, enabled = g.canUndo && !g.busy) { Text("Переиграть последний ход") }
                    if (g.lastStats.isNotEmpty()) { Label("Последний ход"); Dim(g.lastStats) }
                }
                1 -> {
                    Text("Монеты: ${s.hero.gold}", fontWeight = FontWeight.SemiBold)
                    if (s.inventory.isEmpty()) Dim("Вещей нет.")
                    s.inventory.forEach { Text("• " + it.name + if (it.qty > 1) " × ${it.qty}" else "") }
                    Dim("Вещи появляются и пропадают только по правилам игры: модель не может выдать предмет, которого не было в сцене.")
                }
                2 -> { if (s.journal.isEmpty()) Dim("Журнал пуст: пока ничего не изменилось."); s.journal.asReversed().take(80).forEach { Text(it) } }
                3 -> {
                    val near = s.nearbyNpcs()
                    Label("Рядом")
                    if (near.isEmpty()) Dim("Никого знакомого.")
                    near.forEach { Text("${it.name} — ${GameOrchestrator.relationWord(it.relation)}") }
                    Label("Известные персонажи")
                    s.characters.filter { it !in near }.take(40).forEach { c ->
                        Column { Text(c.name + (if (!c.alive) " — погиб" else if (c.relation != 0) " — ${GameOrchestrator.relationWord(c.relation)}" else "") + if (!c.canon) " (появился в игре)" else ""); if (c.lastSeen.isNotEmpty()) Dim("Последний раз: ${c.lastSeen}") }
                    }
                }
                4 -> {
                    Label("Факты книги (канон)")
                    if (s.canonFacts.isEmpty()) Dim("Правил мира в разобранных главах не найдено.")
                    s.canonFacts.forEach { Text("• $it", fontFamily = FontFamily.Serif) }
                    Label("Что изменил ты")
                    if (s.storyFacts.isEmpty()) Dim("Пока ничего.")
                    s.storyFacts.asReversed().take(30).forEach { Text("• $it") }
                    Label("Известные места")
                    Text(s.knownLocations.joinToString(" · "))
                }
                else -> { GameToggles(vm, ui); HorizontalDivider(); VoiceSettings(vm, voice) }
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}
