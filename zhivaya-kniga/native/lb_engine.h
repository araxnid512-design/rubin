// Живая книга: тонкая обёртка над llama.cpp (общая для Android JNI и настольных тестов).
#pragma once
#include <functional>
#include <string>
#include <cstdint>

struct LbEngine;

struct LbGenParams {
    int max_tokens = 96;
    float temp = 0.7f;
    float top_p = 0.85f;
    int top_k = 30;
    float repeat_penalty = 1.12f;
    uint32_t seed = 0xFFFFFFFFu;   // 0xFFFFFFFF = случайное зерно
    std::string grammar;           // GBNF, пусто = без ограничений
    std::string avoid;             // текст прошлой сцены: его токены штрафуются, чтобы модель не повторялась
};

struct LbStats {
    int prompt_tokens = 0;   // всего токенов в промпте
    int reused_tokens = 0;   // взято из KV-кеша без пересчёта
    int gen_tokens = 0;      // сгенерировано
    double prompt_ms = 0;    // время обработки промпта
    double ttft_ms = 0;      // время до первого токена (от вызова)
    double gen_ms = 0;       // время генерации после первого токена
    int stop_reason = 0;     // 0 = конец ответа, 1 = лимит токенов, 2 = отмена, 3 = стоп из колбэка
};

LbEngine *lb_load(const char *path, int n_ctx, int n_threads, std::string &err);
void lb_free(LbEngine *e);
void lb_set_threads(LbEngine *e, int n_threads);
// Пул потоков с привязкой к быстрым ядрам (big.LITTLE). Возвращает число найденных быстрых ядер (0 = определить не удалось).
// Вызывать из того же потока, который потом вызывает lb_generate.
int lb_configure_threads(LbEngine *e, int n_threads, bool big_only);
int lb_big_core_count();
int lb_n_ctx(LbEngine *e);
int lb_count_tokens(LbEngine *e, const std::string &text);
std::string lb_meta(LbEngine *e, const char *key);
void lb_cancel(LbEngine *e);
void lb_clear_cache(LbEngine *e);
// cb получает только целые UTF-8 последовательности; вернуть false = остановить.
bool lb_generate(LbEngine *e, const std::string &prompt, const LbGenParams &p,
                 const std::function<bool(const std::string &)> &cb, LbStats &st, std::string &err);
std::string lb_system_info();
