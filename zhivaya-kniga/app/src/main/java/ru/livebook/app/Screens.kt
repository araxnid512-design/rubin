package ru.livebook.app

import android.content.Context
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Slider
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.livebook.core.game.GameInfo
import ru.livebook.core.lore.BookInfo

val BOOK_MIME = arrayOf("text/plain", "application/epub+zip", "application/pdf", "application/x-fictionbook+xml", "application/x-fictionbook", "application/zip", "text/xml", "application/xml", "application/octet-stream", "*/*")

@Composable
fun Header(title: String, back: (() -> Unit)? = null, action: String? = null, onAction: () -> Unit = {}) {
    Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        if (back != null) TextButton(onClick = back) { Text("← Назад") }
        Text(title, style = MaterialTheme.typography.titleLarge, fontFamily = FontFamily.Serif, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f).padding(horizontal = 6.dp))
        if (action != null) TextButton(onClick = onAction) { Text(action) }
    }
}

@Composable
fun Card(modifier: Modifier = Modifier, warn: Boolean = false, content: @Composable () -> Unit) {
    Surface(color = if (warn) MaterialTheme.colorScheme.surfaceVariant else MaterialTheme.colorScheme.surface, shape = RoundedCornerShape(10.dp), modifier = modifier.fillMaxWidth()) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) { content() }
    }
}

@Composable
fun Label(text: String) = Text(text.uppercase(), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 6.dp))

@Composable
fun Dim(text: String) = Text(text, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)

fun openIntent(ctx: Context, intent: android.content.Intent, vm: MainViewModel) {
    runCatching { ctx.startActivity(intent) }.onFailure { vm.message("Не удалось открыть системные настройки синтеза речи. Открой их вручную: Настройки → Специальные возможности → Синтез речи.") }
}

@Composable
fun ModelCard(vm: MainViewModel, ui: UiState) {
    val pick = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri: Uri? -> if (uri != null) vm.installModel(uri) }
    Card(warn = !ui.model.installed) {
        Text(if (ui.model.installed) "Модель установлена" else "Нужна локальная модель", fontWeight = FontWeight.SemiBold)
        if (ui.model.installed) Dim(ui.model.label) else Dim("Игра работает только с моделью на самом телефоне. Скопируй на телефон файл модели Qwen3 в формате GGUF и выбери его здесь. Qwen3-1.7B (1,1 ГБ) пишет заметно связнее, Qwen3-0.6B (400 МБ) — быстрее. Интернет для этого не нужен.")
        if (ui.model.busy) { Dim(ui.model.label); if (ui.model.progress >= 0f) LinearProgressIndicator(progress = { ui.model.progress }, modifier = Modifier.fillMaxWidth()) else LinearProgressIndicator(Modifier.fillMaxWidth()) }
        if (ui.model.error.isNotEmpty()) Text(ui.model.error, color = MaterialTheme.colorScheme.error)
        if (!ui.model.busy) Button(onClick = { pick.launch(arrayOf("*/*")) }) { Text(if (ui.model.installed) "Заменить модель из файла" else "Установить модель из файла") }
    }
}

@Composable
fun VoiceWarning(vm: MainViewModel, voice: VoiceState) {
    if (voice.status == "ready" || voice.status == "init") return
    val ctx = LocalContext.current
    Card(warn = true) {
        Text(if (voice.status == "no_engine") "На телефоне нет синтеза речи" else "Нет русского голоса, работающего без интернета", fontWeight = FontWeight.SemiBold)
        Dim("Озвучка пока недоступна — играть можно и без неё. Проще всего установить встроенный голос из файла-пакета (golos-dmitri.zip): он не требует ни интернета, ни настроек. Другой путь — системный синтез речи: открой его настройки, выбери язык «Русский» и скачай голосовые данные.")
        val pickVoice = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri: Uri? -> if (uri != null) vm.installVoice(uri) }
        Button(onClick = { pickVoice.launch(arrayOf("application/zip", "application/octet-stream", "*/*")) }) { Text("Установить голос из файла") }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = { openIntent(ctx, vm.narrator.settingsIntent(), vm) }) { Text("Настройки речи") }
            OutlinedButton(onClick = { openIntent(ctx, vm.narrator.installDataIntent(), vm) }) { Text("Скачать голос") }
        }
        TextButton(onClick = { vm.narrator.refresh() }) { Text("Проверить ещё раз") }
    }
}

@Composable
fun LibraryScreen(vm: MainViewModel, ui: UiState, voice: VoiceState) {
    val pickBook = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri: Uri? -> if (uri != null) vm.importBook(uri) }
    Column(Modifier.fillMaxSize()) {
        Header("Живая книга", action = "Настройки", onAction = { vm.go(Screen.SETTINGS) })
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            if (!ui.model.installed || ui.model.busy || ui.model.error.isNotEmpty()) ModelCard(vm, ui)
            if (ui.benchRunning.isNotEmpty()) Card { Dim(ui.benchRunning); LinearProgressIndicator(Modifier.fillMaxWidth()) }
            VoiceWarning(vm, voice)
            ui.importing?.let { imp ->
                Card {
                    Text(imp.title, fontWeight = FontWeight.SemiBold)
                    if (imp.total > 0) { LinearProgressIndicator(progress = { imp.done.toFloat() / imp.total }, modifier = Modifier.fillMaxWidth()); Dim("Глав разобрано: ${imp.done} из ${imp.total}. Играть можно уже после первой главы.") } else LinearProgressIndicator(Modifier.fillMaxWidth())
                    TextButton(onClick = { vm.cancelImport() }) { Text("Остановить разбор") }
                }
            }
            val recent = ui.games.take(3)
            if (recent.isNotEmpty()) {
                Label("Продолжить")
                recent.forEach { g -> GameRow(g, onOpen = { vm.openGame(g.id) }) }
            }
            Label("Мои книги")
            if (ui.books.isEmpty()) Dim("Пока пусто. Добавь книгу из памяти телефона — TXT, FB2, EPUB или PDF с текстом. Книга остаётся на телефоне и никуда не отправляется.")
            ui.books.forEach { b -> BookRow(b) { vm.openBook(b.id) } }
            Button(onClick = { pickBook.launch(BOOK_MIME) }, modifier = Modifier.fillMaxWidth()) { Text("Добавить книгу") }
            Spacer(Modifier.height(16.dp))
        }
    }
}

@Composable
fun BookRow(b: BookInfo, onClick: () -> Unit) {
    Surface(color = MaterialTheme.colorScheme.surface, shape = RoundedCornerShape(10.dp), modifier = Modifier.fillMaxWidth().clickable(onClick = onClick)) {
        Column(Modifier.padding(14.dp)) {
            Text(b.title, style = MaterialTheme.typography.titleMedium, fontFamily = FontFamily.Serif)
            Dim(listOf(b.author, b.format.uppercase(), "${b.chars / 1000} тыс. знаков", if (b.fullyIndexed) "разобрана полностью" else "разобрано глав: ${b.indexedChapters} из ${b.chapters}").filter { it.isNotBlank() }.joinToString(" · "))
        }
    }
}

@Composable
fun GameRow(g: GameInfo, onOpen: () -> Unit, onDelete: (() -> Unit)? = null) {
    Surface(color = MaterialTheme.colorScheme.surface, shape = RoundedCornerShape(10.dp), modifier = Modifier.fillMaxWidth().clickable(onClick = onOpen)) {
        Row(Modifier.padding(start = 14.dp, top = 8.dp, bottom = 8.dp, end = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) { Text(g.title, maxLines = 1, overflow = TextOverflow.Ellipsis); Dim("Ход ${g.turn}") }
            if (onDelete != null) TextButton(onClick = onDelete) { Text("Удалить") }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun BookScreen(vm: MainViewModel, ui: UiState) {
    val b = ui.book ?: return
    val persons = ui.entities.filter { it.kind == "person" }
    val places = ui.entities.filter { it.kind == "place" }
    var bookHero by remember(b.id) { mutableStateOf(persons.isNotEmpty()) }
    var name by remember(b.id) { mutableStateOf(persons.firstOrNull()?.name ?: "") }
    var role by remember(b.id) { mutableStateOf("") }
    var mode by remember(b.id) { mutableStateOf("canon") }
    var gamebook by remember(b.id) { mutableStateOf(true) }
    var confirmDelete by remember { mutableStateOf(false) }
    Column(Modifier.fillMaxSize()) {
        Header(b.title, back = { vm.go(Screen.LIBRARY) })
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Card {
                Dim(listOf(b.author, b.format.uppercase(), "глав: ${b.chapters}", "${b.chars / 1000} тыс. знаков").filter { it.isNotBlank() }.joinToString(" · "))
                if (b.fullyIndexed) Dim("Книга разобрана полностью: найдено персонажей — ${persons.size}, мест — ${places.size}.")
                else {
                    Text("Разобрано глав: ${b.indexedChapters} из ${b.chapters}. Остальная часть книги игре пока неизвестна.", color = MaterialTheme.colorScheme.primary)
                    if (ui.importing == null) OutlinedButton(onClick = { vm.continueIndexing(b.id) }) { Text("Продолжить разбор") }
                }
            }
            val mine = ui.games.filter { it.bookId == b.id }
            if (mine.isNotEmpty()) { Label("Сохранённые приключения"); mine.forEach { g -> GameRow(g, onOpen = { vm.openGame(g.id) }, onDelete = { vm.deleteGame(g.id) }) } }

            Label("Новое приключение")
            Card {
                Row(Modifier.selectable(selected = gamebook, onClick = { gamebook = true }), verticalAlignment = Alignment.CenterVertically) { RadioButton(selected = gamebook, onClick = null); Column(Modifier.padding(start = 8.dp)) { Text("Книга-игра"); Dim("Параграфы, выбор из вариантов, Ловкость, Сила и Удача, бои на кубиках.") } }
                Row(Modifier.selectable(selected = !gamebook, onClick = { gamebook = false }), verticalAlignment = Alignment.CenterVertically) { RadioButton(selected = !gamebook, onClick = null); Column(Modifier.padding(start = 8.dp)) { Text("Свободная игра"); Dim("Действия пишешь сам, своими словами.") } }
                HorizontalDivider()
                Row(Modifier.selectable(selected = bookHero, onClick = { bookHero = true; name = persons.firstOrNull()?.name ?: "" }), verticalAlignment = Alignment.CenterVertically) { RadioButton(selected = bookHero, onClick = null, enabled = persons.isNotEmpty()); Text("  Герой книги") }
                Row(Modifier.selectable(selected = !bookHero, onClick = { bookHero = false; name = "" }), verticalAlignment = Alignment.CenterVertically) { RadioButton(selected = !bookHero, onClick = null); Text("  Свой герой") }
                if (bookHero) FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) { persons.take(8).forEach { p -> FilterChip(selected = name == p.name, onClick = { name = p.name }, label = { Text(p.name) }) } }
                else OutlinedTextField(value = name, onValueChange = { name = it.take(40) }, label = { Text("Имя героя") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = role, onValueChange = { role = it.take(60) }, label = { Text("Кто он — коротко (например: странник)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                HorizontalDivider()
                Row(Modifier.selectable(selected = mode == "canon", onClick = { mode = "canon" }), verticalAlignment = Alignment.CenterVertically) { RadioButton(selected = mode == "canon", onClick = null); Column(Modifier.padding(start = 8.dp)) { Text("Ближе к канону"); Dim("Бережно к событиям и героям книги.") } }
                Row(Modifier.selectable(selected = mode == "alternate", onClick = { mode = "alternate" }), verticalAlignment = Alignment.CenterVertically) { RadioButton(selected = mode == "alternate", onClick = null); Column(Modifier.padding(start = 8.dp)) { Text("Свободная история"); Dim("Сюжет может уйти в сторону, появляются новые персонажи.") } }
                Button(onClick = { vm.newGame(b.id, name, role, mode, bookHero, gamebook) }, enabled = name.isNotBlank() && b.indexedChapters > 0 && !ui.model.busy, modifier = Modifier.fillMaxWidth()) { Text("Начать приключение") }
                if (!ui.model.installed) Text("Сначала установи модель в настройках.", color = MaterialTheme.colorScheme.error)
                if (gamebook) {
                    HorizontalDivider()
                    Text("Страниц квеста готово: ${ui.pages}", fontWeight = FontWeight.SemiBold)
                    Dim("Квест можно написать заранее. Тогда в игре не будет ожидания: каждый выбор сразу открывает готовую страницу, как в бумажной книге-игре. Подготовка идёт несколько минут или дольше; её можно остановить и продолжить. Страницы пишутся для выбранного героя.")
                    if (ui.preparing.isNotEmpty()) { Dim(ui.preparing); LinearProgressIndicator(Modifier.fillMaxWidth()); TextButton(onClick = { vm.cancelRefine() }) { Text("Остановить") } }
                    else Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(onClick = { vm.prepareQuest(b.id, name, role, mode, bookHero) }, enabled = name.isNotBlank() && ui.model.installed && b.indexedChapters > 0) { Text(if (ui.pages > 0) "Дописать квест" else "Подготовить квест заранее") }
                        if (ui.pages > 0) TextButton(onClick = { vm.clearPages(b.id) }) { Text("Стереть страницы") }
                    }
                }
            }

            Label("Что игра знает о книге")
            Card {
                Dim("Найдено автоматически по тексту, возможны ошибки.")
                EntityList("Персонажи", persons.map { it.name to it.descr })
                EntityList("Места", places.map { it.name to it.descr })
                EntityList("Группы", ui.entities.filter { it.kind == "faction" }.map { it.name to it.descr })
                EntityList("Предметы", ui.entities.filter { it.kind == "item" }.map { it.name to "" })
                EntityList("Правила мира", ui.entities.filter { it.kind == "rule" }.map { it.descr to "" })
                EntityList("Запертые места", ui.entities.filter { it.kind == "lock" }.map { it.name to it.descr })
                val r = ui.refine
                if (r != null) { Dim("Модель уточняет карточки: ${r.first} из ${r.second}"); LinearProgressIndicator(progress = { r.first.toFloat() / r.second.coerceAtLeast(1) }, modifier = Modifier.fillMaxWidth()); TextButton(onClick = { vm.cancelRefine() }) { Text("Остановить") } }
                else OutlinedButton(onClick = { vm.refineBook(b.id) }, enabled = ui.model.installed) { Text("Уточнить карточки моделью") }
                Dim("Уточнение идёт долго (несколько секунд на карточку), его можно остановить и продолжить позже.")
            }
            TextButton(onClick = { confirmDelete = true }) { Text("Удалить книгу и её сохранения", color = MaterialTheme.colorScheme.error) }
            Spacer(Modifier.height(16.dp))
        }
    }
    if (confirmDelete) AlertDialog(onDismissRequest = { confirmDelete = false }, title = { Text("Удалить книгу?") }, text = { Text("Вместе с книгой удалятся все приключения по ней. Отменить это нельзя.") },
        confirmButton = { TextButton(onClick = { confirmDelete = false; vm.deleteBook(b.id) }) { Text("Удалить") } }, dismissButton = { TextButton(onClick = { confirmDelete = false }) { Text("Отмена") } })
}

@Composable
fun EntityList(title: String, items: List<Pair<String, String>>) {
    if (items.isEmpty()) return
    var open by remember { mutableStateOf(false) }
    Row(Modifier.fillMaxWidth().clickable { open = !open }.padding(vertical = 4.dp)) { Text("$title · ${items.size}", fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f)); Text(if (open) "Свернуть" else "Показать", color = MaterialTheme.colorScheme.primary) }
    if (open) items.take(40).forEach { (n, d) -> Column(Modifier.padding(start = 6.dp, bottom = 4.dp)) { Text(n); if (d.isNotBlank()) Dim(d) } }
}

@Composable
fun SettingsScreen(vm: MainViewModel, ui: UiState, voice: VoiceState) {
    val ctx = LocalContext.current
    var includeBooks by remember { mutableStateOf(false) }
    val export = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/zip")) { uri: Uri? -> if (uri != null) vm.exportBackup(uri, includeBooks) }
    val import = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri: Uri? -> if (uri != null) vm.importBackup(uri) }
    Column(Modifier.fillMaxSize()) {
        Header("Настройки", back = { vm.go(Screen.LIBRARY) })
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Label("Локальная модель")
            ModelCard(vm, ui)
            if (ui.model.installed) Card {
                Text("Скорость на этом телефоне", fontWeight = FontWeight.SemiBold)
                if (ui.benchRunning.isNotEmpty()) { Dim(ui.benchRunning); LinearProgressIndicator(Modifier.fillMaxWidth()) }
                if (ui.bench.isEmpty()) Dim("Замеров пока нет.")
                ui.bench.take(4).forEach { r ->
                    Dim("${r.threads} поток.${if (r.bigOnly) " (быстрые ядра)" else ""}: до первого слова ${"%.1f".format(r.ttftMs / 1000)} с · ${"%.1f".format(r.tokPerSec)} токенов/с · 30 токенов за ${"%.1f".format(r.t30Ms / 1000)} с · 60 за ${"%.1f".format(r.t60Ms / 1000)} с · память ${r.ramMb.toInt()} МБ")
                }
                ui.bench.firstOrNull()?.let { Dim("Ожидание короткого хода: около ${"%.0f".format(it.estimateTurnSeconds())} с (расчёт по последнему замеру).") }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    OutlinedButton(onClick = { vm.runBenchmark(auto = false) }, enabled = ui.benchRunning.isEmpty()) { Text("Замерить") }
                    OutlinedButton(onClick = { vm.runBenchmark(auto = true) }, enabled = ui.benchRunning.isEmpty()) { Text("Подобрать потоки") }
                }
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("Потоки:"); listOf(2, 4, 6, 8).filter { it <= Runtime.getRuntime().availableProcessors() }.forEach { n -> FilterChip(selected = ui.prefs.threads == n, onClick = { vm.setPrefs { it.copy(threads = n) } }, label = { Text("$n") }) }
                }
                ToggleRow("Только быстрые ядра", "Считать на самых мощных ядрах процессора. Часто быстрее и меньше греет; проверь замером.", ui.prefs.bigOnly) { v -> vm.setPrefs { it.copy(bigOnly = v) } }
                TextButton(onClick = { vm.removeModel() }) { Text("Удалить модель с телефона", color = MaterialTheme.colorScheme.error) }
            }

            Label("Игра")
            Card { GameToggles(vm, ui) }

            Label("Голос рассказчика")
            VoiceWarning(vm, voice)
            Card { VoiceSettings(vm, voice); OutlinedButton(onClick = { openIntent(ctx, vm.narrator.settingsIntent(), vm) }) { Text("Системные настройки речи") } }

            Label("Резервная копия")
            Card {
                Dim("Копия — это ZIP-файл с сохранениями. Тексты книг в него не входят, пока не отмечено ниже.")
                Row(Modifier.clickable { includeBooks = !includeBooks }, verticalAlignment = Alignment.CenterVertically) { Checkbox(checked = includeBooks, onCheckedChange = { includeBooks = it }); Text("Включить тексты книг") }
                if (includeBooks) Text("Файл станет больше и будет содержать полный текст твоих книг — не передавай его посторонним.", color = MaterialTheme.colorScheme.primary)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(onClick = { export.launch("zhivaya-kniga-kopiya.zip") }) { Text("Сохранить копию") }
                    OutlinedButton(onClick = { import.launch(arrayOf("application/zip", "application/octet-stream", "*/*")) }) { Text("Восстановить") }
                }
            }

            Label("О приложении")
            Card {
                Dim("Живая книга 1.2. Работает без интернета: у приложения нет разрешения на доступ к сети. Книги, сохранения и модель хранятся только на этом телефоне.")
                Dim("Модель пишет только сцены. За предметами, монетами, здоровьем, перемещениями и ходом сюжета следят правила игры. Qwen3-0.6B пишет небрежно; Qwen3-1.7B — заметно связнее, но медленнее.")
                Dim("Используются: llama.cpp (MIT), Qwen3 (Apache 2.0), sherpa-onnx и ONNX Runtime (Apache 2.0 и MIT; содержит espeak-ng, GPL 3.0), PdfBox-Android (Apache 2.0), jsoup (MIT), SQLite (общественное достояние), Jetpack Compose и kotlinx (Apache 2.0).")
            }
            Spacer(Modifier.height(16.dp))
        }
    }
}

@Composable
fun GameToggles(vm: MainViewModel, ui: UiState) {
    ToggleRow("Подробнее", "Сцены длиннее, ход дольше.", ui.prefs.detail) { v -> vm.setPrefs { it.copy(detail = v, economy = if (v) false else it.economy) } }
    ToggleRow("Экономичный режим", "Короче сцены и меньше контекста — быстрее на слабом телефоне.", ui.prefs.economy) { v -> vm.setPrefs { it.copy(economy = v, detail = if (v) false else it.detail) } }
    ToggleRow("Подсказки действий", "Три варианта от модели под лентой. Без них ход чуть быстрее.", ui.prefs.suggestions) { v -> vm.setPrefs { it.copy(suggestions = v) } }
    Text("Размер текста")
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) { listOf(0.9f to "Мелкий", 1f to "Обычный", 1.15f to "Крупный", 1.3f to "Очень крупный").forEach { (f, l) -> FilterChip(selected = ui.prefs.fontScale == f, onClick = { vm.setPrefs { it.copy(fontScale = f) } }, label = { Text(l, fontSize = 12.sp) }) } }
}

@Composable
fun ToggleRow(title: String, hint: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth().clickable { onChange(!checked) }, verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) { Text(title); Dim(hint) }
        Switch(checked = checked, onCheckedChange = onChange)
    }
}

@Composable
fun VoiceSettings(vm: MainViewModel, voice: VoiceState) {
    val n = vm.narrator
    var auto by remember { mutableStateOf(n.auto) }
    var rate by remember { mutableFloatStateOf(n.rate) }
    var pitch by remember { mutableFloatStateOf(n.pitch) }
    var volume by remember { mutableFloatStateOf(n.volume) }
    val pickVoice = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri: Uri? -> if (uri != null) vm.installVoice(uri) }
    Text(when { voice.builtinActive -> "Встроенный голос «${voice.builtinName}» готов"; voice.status == "ready" -> "Системный офлайн-голос готов"; voice.status == "init" -> "Проверяю синтез речи…"; voice.status == "no_engine" -> "Синтез речи не найден"; else -> "Русского офлайн-голоса нет" }, fontWeight = FontWeight.SemiBold)
    if (voice.latencyMs >= 0) Dim("Задержка до начала речи: ${voice.latencyMs} мс.")
    if (voice.builtinInstalled) {
        Row(Modifier.fillMaxWidth().selectable(selected = voice.builtinActive, onClick = { vm.useBuiltinVoice(true) }), verticalAlignment = Alignment.CenterVertically) { RadioButton(selected = voice.builtinActive, onClick = null); Text("  Встроенный: ${voice.builtinName} · без сети") }
        if (voice.systemStatus == "ready") Row(Modifier.fillMaxWidth().selectable(selected = !voice.builtinActive, onClick = { vm.useBuiltinVoice(false) }), verticalAlignment = Alignment.CenterVertically) { RadioButton(selected = !voice.builtinActive, onClick = null); Text("  Системный синтез речи") }
    } else Dim("Встроенный голос не установлен. Он ставится из файла-пакета golos-dmitri.zip и не требует системного синтеза.")
    OutlinedButton(onClick = { pickVoice.launch(arrayOf("application/zip", "application/octet-stream", "*/*")) }) { Text(if (voice.builtinInstalled) "Заменить встроенный голос из файла" else "Установить голос из файла") }
    if (!voice.builtinActive && voice.systemStatus == "ready") {
        Dim("Системные голоса: используются только те, которым не нужен интернет.")
        voice.voices.take(6).forEach { v -> Row(Modifier.fillMaxWidth().selectable(selected = v.name == voice.selected, onClick = { n.select(v.name) }), verticalAlignment = Alignment.CenterVertically) { RadioButton(selected = v.name == voice.selected, onClick = null); Text("  " + v.label) } }
    }
    if (voice.status == "ready") OutlinedButton(onClick = { n.queue.setText(listOf("Вечер опускается на долину.", "У очага тепло, и хозяйка трактира ждёт твоего слова."), true) }) { Text("Прослушать пример") }
    ToggleRow("Читать ответы автоматически", "Рассказчик начинает читать, как только готово первое предложение.", auto) { auto = it; n.auto = it }
    Text("Скорость речи: ${"%.2f".format(rate)}"); Slider(value = rate, onValueChange = { rate = it }, onValueChangeFinished = { n.rate = rate }, valueRange = 0.85f..1.15f)
    if (!voice.builtinActive) { Text("Высота тона: ${"%.2f".format(pitch)}"); Slider(value = pitch, onValueChange = { pitch = it }, onValueChangeFinished = { n.pitch = pitch }, valueRange = 0.8f..1.2f) }
    Text("Громкость: ${(volume * 100).toInt()}%"); Slider(value = volume, onValueChange = { volume = it }, onValueChangeFinished = { n.volume = volume }, valueRange = 0.2f..1f)
}

@Composable
fun Overlays(vm: MainViewModel, ui: UiState) {
    if (ui.message.isNotEmpty()) {
        Box(Modifier.fillMaxSize().padding(12.dp), contentAlignment = Alignment.BottomCenter) {
            Surface(color = MaterialTheme.colorScheme.inverseSurface, shape = RoundedCornerShape(10.dp), modifier = Modifier.padding(bottom = 90.dp).clickable { vm.clearMessage() }) {
                Row(Modifier.padding(start = 14.dp, top = 6.dp, bottom = 6.dp, end = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(ui.message, color = MaterialTheme.colorScheme.inverseOnSurface, modifier = Modifier.weight(1f))
                    Spacer(Modifier.width(6.dp)); TextButton(onClick = { vm.clearMessage() }) { Text("Понятно", color = MaterialTheme.colorScheme.inversePrimary) }
                }
            }
        }
    }
    ui.pendingCharset?.let { uri ->
        AlertDialog(onDismissRequest = { vm.dismissCharset() }, title = { Text("Выбери кодировку") },
            text = { Column { Text("Текст не удалось прочитать автоматически. Попробуй одну из кодировок:"); listOf("windows-1251" to "Windows-1251 (чаще всего)", "UTF-8" to "UTF-8", "KOI8-R" to "KOI8-R", "IBM866" to "DOS (866)", "UTF-16LE" to "UTF-16").forEach { (cs, label) -> TextButton(onClick = { vm.importBook(uri, cs) }) { Text(label) } } } },
            confirmButton = {}, dismissButton = { TextButton(onClick = { vm.dismissCharset() }) { Text("Отмена") } })
    }
}
