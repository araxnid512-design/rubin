plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "ru.livebook.app"
    compileSdk = 35
    ndkVersion = "27.2.12479018"

    defaultConfig {
        applicationId = "ru.livebook.quest"
        // Android 8.0+: все такие устройства 64-битные в массе, есть нужные API хранения и TTS.
        minSdk = 26
        targetSdk = 35
        versionCode = 2
        versionName = "1.1"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        // Основная сборка — только arm64. Для проверки в эмуляторе: ./gradlew assembleDebug -PemulatorAbi
        ndk { abiFilters += if (project.hasProperty("emulatorAbi")) listOf("arm64-v8a", "x86_64") else listOf("arm64-v8a") }
        externalNativeBuild { cmake { arguments += listOf("-DANDROID_STL=c++_static", "-DCMAKE_BUILD_TYPE=Release") } }
    }

    // Один общий ключ подписи для debug и release, чтобы обновления ставились поверх без потери сохранений.
    // Это учебный ключ частной сборки (пароль в открытом виде) — для публикации в магазине создайте свой.
    signingConfigs {
        create("project") {
            storeFile = rootProject.file("keystore/zhivaya-kniga.jks")
            storePassword = "livebook"; keyAlias = "livebook"; keyPassword = "livebook"
        }
    }
    buildTypes {
        debug { signingConfig = signingConfigs.getByName("project") }
        release { isMinifyEnabled = false; signingConfig = signingConfigs.getByName("project") }
    }
    externalNativeBuild { cmake { path = file("../native/CMakeLists.txt"); version = "3.22.1" } }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures { compose = true }
    // Если положить модель в app/src/main/assets/model.gguf, она попадёт в APK без сжатия и установится при первом запуске.
    androidResources { noCompress += "gguf" }
    packaging { jniLibs { excludes += setOf("**/libsherpa-onnx-c-api.so", "**/libsherpa-onnx-cxx-api.so") }; resources { excludes += setOf("META-INF/{AL2.0,LGPL2.1}", "META-INF/*.kotlin_module", "META-INF/DEPENDENCIES") } }
    testOptions { unitTests.isReturnDefaultValues = true }
}

dependencies {
    implementation(project(":core"))
    implementation(platform("androidx.compose:compose-bom:2025.05.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.activity:activity-compose:1.10.1")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.9.0")
    implementation("androidx.core:core-ktx:1.16.0")
    implementation("com.tom-roush:pdfbox-android:2.0.27.0")
    // Встроенный синтез речи sherpa-onnx (Apache 2.0); файл взят с huggingface.co/csukuangfj/sherpa-onnx-libs.
    implementation(files("libs/sherpa-onnx-1.12.21.aar"))
    testImplementation("junit:junit:4.13.2")
    // Проверка на устройстве или эмуляторе: ./gradlew :app:connectedDebugAndroidTest
    androidTestImplementation(platform("androidx.compose:compose-bom:2025.05.00"))
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test:runner:1.6.2")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
}
