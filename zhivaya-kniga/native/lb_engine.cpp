#include "lb_engine.h"
#include "llama.h"
#include "ggml-cpu.h"
#include <cstdio>
#if defined(__linux__)
#include <sched.h>
#include <unistd.h>
#endif
#include <atomic>
#include <chrono>
#include <cmath>
#include <cstring>
#include <mutex>
#include <vector>

#if defined(__GNUC__) || defined(__clang__)
#pragma GCC diagnostic ignored "-Wdeprecated-declarations"
#endif

struct LbEngine {
    llama_model *model = nullptr;
    llama_context *ctx = nullptr;
    const llama_vocab *vocab = nullptr;
    std::vector<llama_token> cache;   // токены, уже лежащие в KV-кеше
    std::atomic<bool> cancel{false};
    std::mutex mu;
    int n_ctx = 0;
    int n_batch = 256;
    ggml_threadpool *pool = nullptr;
    bool big_only = false;
};

static double now_ms() {
    using namespace std::chrono;
    return duration<double, std::milli>(steady_clock::now().time_since_epoch()).count();
}

static void quiet_log(enum ggml_log_level level, const char *text, void *) {
    if (level >= GGML_LOG_LEVEL_ERROR) fputs(text, stderr);
}

static std::once_flag g_init;

LbEngine *lb_load(const char *path, int n_ctx, int n_threads, std::string &err) {
    std::call_once(g_init, [] {
        llama_log_set(quiet_log, nullptr);
        llama_backend_init();
    });
    llama_model_params mp = llama_model_default_params();
    mp.n_gpu_layers = 0;
    llama_model *model = llama_model_load_from_file(path, mp);
    if (!model) { err = "не удалось загрузить файл модели (повреждён или неподдерживаемый формат)"; return nullptr; }
    llama_context_params cp = llama_context_default_params();
    cp.n_ctx = (uint32_t) n_ctx;
    cp.n_batch = 256;
    cp.n_ubatch = 256;
    cp.n_threads = n_threads;
    cp.n_threads_batch = n_threads;
    cp.no_perf = true;
    llama_context *ctx = llama_init_from_model(model, cp);
    if (!ctx) { llama_model_free(model); err = "не удалось создать контекст (недостаточно памяти?)"; return nullptr; }
    auto *e = new LbEngine();
    e->model = model;
    e->ctx = ctx;
    e->vocab = llama_model_get_vocab(model);
    e->n_ctx = (int) llama_n_ctx(ctx);
    return e;
}

void lb_free(LbEngine *e) {
    if (!e) return;
    std::lock_guard<std::mutex> lk(e->mu);
    if (e->ctx) llama_detach_threadpool(e->ctx);
    if (e->pool) ggml_threadpool_free(e->pool);
    if (e->ctx) llama_free(e->ctx);
    if (e->model) llama_model_free(e->model);
    e->ctx = nullptr; e->model = nullptr;
    delete e;
}

// Быстрые ядра определяем по максимальной частоте из sysfs: у Dimensity 6100+ это 2 ядра Cortex-A76.
static std::vector<int> big_cores(int *total) {
    std::vector<std::pair<long, int>> freq;
    for (int i = 0; i < 64; i++) {
        char path[128];
        snprintf(path, sizeof(path), "/sys/devices/system/cpu/cpu%d/cpufreq/cpuinfo_max_freq", i);
        FILE *f = fopen(path, "r");
        if (!f) continue;
        long v = 0;
        if (fscanf(f, "%ld", &v) == 1 && v > 0) freq.push_back({v, i});
        fclose(f);
    }
    if (total) *total = (int) freq.size();
    std::vector<int> out;
    if (freq.empty()) return out;
    long mx = 0;
    for (auto &p : freq) if (p.first > mx) mx = p.first;
    for (auto &p : freq) if (p.first * 100 >= mx * 90) out.push_back(p.second);
    if (out.size() == freq.size()) out.clear();   // все ядра одинаковые — привязывать нечего
    return out;
}

int lb_big_core_count() { return (int) big_cores(nullptr).size(); }

static void apply_affinity(bool big_only) {
#if defined(__linux__)
    int total = 0;
    std::vector<int> big = big_cores(&total);
    cpu_set_t set;
    CPU_ZERO(&set);
    if (big_only && !big.empty()) { for (int c : big) CPU_SET(c, &set); }
    else { long n = sysconf(_SC_NPROCESSORS_CONF); for (long c = 0; c < n && c < CPU_SETSIZE; c++) CPU_SET((int) c, &set); }
    sched_setaffinity(0, sizeof(set), &set);
#else
    (void) big_only;
#endif
}

int lb_configure_threads(LbEngine *e, int n_threads, bool big_only) {
    if (!e || !e->ctx) return 0;
    std::lock_guard<std::mutex> lk(e->mu);
    int big = lb_big_core_count();
    e->big_only = big_only && big > 0;
    // Потоки пула создаются из текущего потока и наследуют его привязку к ядрам.
    apply_affinity(e->big_only);
    llama_detach_threadpool(e->ctx);
    if (e->pool) { ggml_threadpool_free(e->pool); e->pool = nullptr; }
    ggml_threadpool_params tp = ggml_threadpool_params_default(n_threads);
    e->pool = ggml_threadpool_new(&tp);
    if (e->pool) llama_attach_threadpool(e->ctx, e->pool, e->pool);
    llama_set_n_threads(e->ctx, n_threads, n_threads);
    return big;
}

void lb_set_threads(LbEngine *e, int n) { if (e && e->ctx) llama_set_n_threads(e->ctx, n, n); }
int lb_n_ctx(LbEngine *e) { return e ? e->n_ctx : 0; }
void lb_cancel(LbEngine *e) { if (e) e->cancel.store(true); }

void lb_clear_cache(LbEngine *e) {
    if (!e) return;
    std::lock_guard<std::mutex> lk(e->mu);
    llama_memory_clear(llama_get_memory(e->ctx), true);
    e->cache.clear();
}

static std::vector<llama_token> tokenize(LbEngine *e, const std::string &text) {
    int n = -llama_tokenize(e->vocab, text.c_str(), (int32_t) text.size(), nullptr, 0, false, true);
    std::vector<llama_token> out((size_t) (n > 0 ? n : 0));
    if (n > 0) llama_tokenize(e->vocab, text.c_str(), (int32_t) text.size(), out.data(), n, false, true);
    return out;
}

int lb_count_tokens(LbEngine *e, const std::string &text) {
    if (!e) return 0;
    return (int) tokenize(e, text).size();
}

std::string lb_meta(LbEngine *e, const char *key) {
    char buf[512];
    int n = llama_model_meta_val_str(e->model, key, buf, sizeof(buf));
    return n > 0 ? std::string(buf, (size_t) n) : std::string();
}

std::string lb_system_info() { return llama_print_system_info(); }

// Длина завершённого UTF-8 префикса: неполный хвостовой символ остаётся в буфере.
static size_t utf8_complete_len(const std::string &s) {
    size_t n = s.size();
    size_t i = n;
    int back = 0;
    while (i > 0 && back < 4) {
        unsigned char c = (unsigned char) s[i - 1];
        if ((c & 0xC0) == 0x80) { i--; back++; continue; }
        int need = (c & 0x80) == 0 ? 1 : (c & 0xE0) == 0xC0 ? 2 : (c & 0xF0) == 0xE0 ? 3 : (c & 0xF8) == 0xF0 ? 4 : 1;
        return (int) (n - (i - 1)) >= need ? n : i - 1;
    }
    return n;
}

static bool decode_tokens(LbEngine *e, const llama_token *toks, int n, int pos0, std::string &err) {
    llama_batch batch = llama_batch_init(e->n_batch, 0, 1);
    bool ok = true;
    for (int i = 0; i < n && ok; i += e->n_batch) {
        if (e->cancel.load()) { ok = false; err = "cancel"; break; }
        int m = n - i < e->n_batch ? n - i : e->n_batch;
        batch.n_tokens = m;
        for (int j = 0; j < m; j++) {
            batch.token[j] = toks[i + j];
            batch.pos[j] = pos0 + i + j;
            batch.n_seq_id[j] = 1;
            batch.seq_id[j][0] = 0;
            batch.logits[j] = (i + j == n - 1) ? 1 : 0;
        }
        if (llama_decode(e->ctx, batch) != 0) { ok = false; err = "ошибка вычисления (llama_decode)"; }
    }
    llama_batch_free(batch);
    return ok;
}

bool lb_generate(LbEngine *e, const std::string &prompt, const LbGenParams &p,
                 const std::function<bool(const std::string &)> &cb, LbStats &st, std::string &err) {
    if (!e || !e->ctx) { err = "модель не загружена"; return false; }
    std::lock_guard<std::mutex> lk(e->mu);
    e->cancel.store(false);
    st = LbStats();
    double t0 = now_ms();

    std::vector<llama_token> toks = tokenize(e, prompt);
    if (toks.empty()) { err = "пустой промпт"; return false; }
    st.prompt_tokens = (int) toks.size();
    if ((int) toks.size() + p.max_tokens + 4 > e->n_ctx) {
        err = "промпт не помещается в контекст: " + std::to_string(toks.size()) + " токенов";
        return false;
    }

    // Переиспользуем KV-кеш: считаем только то, что изменилось после общего префикса.
    size_t lcp = 0;
    while (lcp < toks.size() && lcp < e->cache.size() && toks[lcp] == e->cache[lcp]) lcp++;
    if (lcp == toks.size()) lcp--;   // последний токен нужен заново ради логитов
    llama_memory_t mem = llama_get_memory(e->ctx);
    if (lcp < e->cache.size()) {
        if (!llama_memory_seq_rm(mem, 0, (llama_pos) lcp, -1)) { llama_memory_clear(mem, true); lcp = 0; }
    }
    e->cache.resize(lcp);
    st.reused_tokens = (int) lcp;
    if (!decode_tokens(e, toks.data() + lcp, (int) (toks.size() - lcp), (int) lcp, err)) {
        llama_memory_clear(mem, true); e->cache.clear();
        if (err == "cancel") { st.stop_reason = 2; err.clear(); return true; }
        return false;
    }
    e->cache = toks;
    st.prompt_ms = now_ms() - t0;

    // Сэмплеры: грамматика проверяется отдельно (сначала быстрый выбор, затем проверка),
    // чтобы не прогонять весь словарь через грамматику на каждом токене.
    llama_sampler *grmr = nullptr;
    if (!p.grammar.empty()) {
        grmr = llama_sampler_init_grammar(e->vocab, p.grammar.c_str(), "root");
        if (!grmr) { err = "некорректная грамматика ответа"; return false; }
    }
    const int n_vocab = llama_vocab_n_tokens(e->vocab);
    llama_sampler *chain = llama_sampler_chain_init(llama_sampler_chain_default_params());
    llama_sampler_chain_add(chain, llama_sampler_init_penalties(n_vocab, 160, p.repeat_penalty, 0.0f, 0.0f));
    llama_sampler_chain_add(chain, llama_sampler_init_top_k(p.top_k));
    llama_sampler_chain_add(chain, llama_sampler_init_top_p(p.top_p, 1));
    llama_sampler_chain_add(chain, llama_sampler_init_temp(p.temp));
    llama_sampler_chain_add(chain, llama_sampler_init_dist(p.seed));

    if (!p.avoid.empty()) {
        std::vector<llama_token> av = tokenize(e, p.avoid);
        size_t from = av.size() > 120 ? av.size() - 120 : 0;
        for (size_t i = from; i < av.size(); i++) llama_sampler_accept(chain, av[i]);
    }
    std::vector<llama_token_data> cand((size_t) n_vocab);
    std::string pending;
    bool ok = true;
    double t_first = 0;
    int pos = (int) toks.size();
    st.stop_reason = 1;

    for (int i = 0; i < p.max_tokens; i++) {
        if (e->cancel.load()) { st.stop_reason = 2; break; }
        const float *logits = llama_get_logits_ith(e->ctx, -1);
        auto fill = [&] {
            for (int t = 0; t < n_vocab; t++) cand[(size_t) t] = llama_token_data{t, logits[t], 0.0f};
        };
        fill();
        llama_token_data_array arr = {cand.data(), (size_t) n_vocab, -1, false};
        llama_sampler_apply(chain, &arr);
        llama_token id = arr.data[arr.selected].id;
        if (grmr) {
            llama_token_data one = {id, 1.0f, 0.0f};
            llama_token_data_array a1 = {&one, 1, -1, false};
            llama_sampler_apply(grmr, &a1);
            if (!std::isfinite(one.logit) || one.logit < -1e30f) {
                fill();
                llama_token_data_array a2 = {cand.data(), (size_t) n_vocab, -1, false};
                llama_sampler_apply(grmr, &a2);
                llama_sampler_apply(chain, &a2);
                id = a2.data[a2.selected].id;
            }
            llama_sampler_accept(grmr, id);
        }
        llama_sampler_accept(chain, id);
        if (i == 0) { t_first = now_ms(); st.ttft_ms = t_first - t0; }
        if (llama_vocab_is_eog(e->vocab, id)) { st.stop_reason = 0; break; }

        char buf[256];
        int n = llama_token_to_piece(e->vocab, id, buf, sizeof(buf), 0, false);
        if (n > 0) pending.append(buf, (size_t) n);
        st.gen_tokens++;
        size_t cl = utf8_complete_len(pending);
        if (cl > 0) {
            std::string out = pending.substr(0, cl);
            pending.erase(0, cl);
            if (!cb(out)) { st.stop_reason = 3; break; }
        }
        if (!decode_tokens(e, &id, 1, pos, err)) {
            if (err == "cancel") { err.clear(); st.stop_reason = 2; } else ok = false;
            break;
        }
        e->cache.push_back(id);
        pos++;
    }
    if (t_first > 0) st.gen_ms = now_ms() - t_first;
    llama_sampler_free(chain);
    if (grmr) llama_sampler_free(grmr);
    return ok;
}
