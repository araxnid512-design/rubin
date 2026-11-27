plugins {
    id("org.jetbrains.kotlin.jvm")
    id("org.jetbrains.kotlin.plugin.serialization")
}

kotlin { jvmToolchain(21) }
java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}
tasks.withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile>().configureEach {
    compilerOptions.jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
}

dependencies {
    api("org.jetbrains.kotlinx:kotlinx-serialization-json:1.8.1")
    api("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.10.2")
    api("androidx.sqlite:sqlite-bundled:2.5.1")
    implementation("org.jsoup:jsoup:1.20.1")
    testImplementation(kotlin("test"))
    testImplementation("org.apache.pdfbox:pdfbox:2.0.34")
}

tasks.test {
    useJUnitPlatform()
    // Интеграционные тесты с настоящей моделью включаются переменными окружения
    // LIVEBOOK_MODEL (путь к GGUF) и LIVEBOOK_NATIVE_DIR (каталог с liblivebook_llm.so).
    System.getenv("LIVEBOOK_NATIVE_DIR")?.let { systemProperty("java.library.path", it) }
    testLogging { events("failed"); showStandardStreams = System.getenv("LIVEBOOK_VERBOSE") != null; exceptionFormat = org.gradle.api.tasks.testing.logging.TestExceptionFormat.FULL }
    maxHeapSize = "2g"
}
