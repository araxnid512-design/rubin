// Настольная/arm64 проверка движка: lb_cli model.gguf prompt.txt [grammar.gbnf] [max_tokens] [threads] [n_ctx]
#include "lb_engine.h"
#include <cstdio>
#include <cstdlib>
#include <fstream>
#include <sstream>

static std::string slurp(const char *path) {
    std::ifstream f(path, std::ios::binary);
    std::stringstream ss; ss << f.rdbuf(); return ss.str();
}

int main(int argc, char **argv) {
    if (argc < 3) { fprintf(stderr, "usage: lb_cli model.gguf prompt.txt [grammar|-] [max_tokens] [threads] [n_ctx]\n"); return 2; }
    std::string err;
    int threads = argc > 5 ? atoi(argv[5]) : 4;
    int n_ctx = argc > 6 ? atoi(argv[6]) : 2048;
    LbEngine *e = lb_load(argv[1], n_ctx, threads, err);
    if (!e) { fprintf(stderr, "load failed: %s\n", err.c_str()); return 1; }
    LbGenParams p;
    if (argc > 3 && std::string(argv[3]) != "-") p.grammar = slurp(argv[3]);
    if (argc > 4) p.max_tokens = atoi(argv[4]);
    p.seed = getenv("LB_SEED") ? (uint32_t) atoi(getenv("LB_SEED")) : 42;
    if (getenv("LB_TEMP")) p.temp = (float) atof(getenv("LB_TEMP"));
    if (getenv("LB_TOPK")) p.top_k = atoi(getenv("LB_TOPK"));
    if (getenv("LB_TOPP")) p.top_p = (float) atof(getenv("LB_TOPP"));
    if (getenv("LB_REP")) p.repeat_penalty = (float) atof(getenv("LB_REP"));
    LbStats st;
    bool ok = lb_generate(e, slurp(argv[2]), p, [](const std::string &s) { fputs(s.c_str(), stdout); fflush(stdout); return true; }, st, err);
    printf("\n---\nok=%d err=%s prompt_tokens=%d reused=%d gen_tokens=%d prompt_ms=%.0f ttft_ms=%.0f gen_ms=%.0f tok_s=%.1f stop=%d\n",
           ok, err.c_str(), st.prompt_tokens, st.reused_tokens, st.gen_tokens, st.prompt_ms, st.ttft_ms, st.gen_ms,
           st.gen_ms > 0 ? (st.gen_tokens - 1) * 1000.0 / st.gen_ms : 0.0, st.stop_reason);
    printf("arch=%s name=%s\n", lb_meta(e, "general.architecture").c_str(), lb_meta(e, "general.name").c_str());
    lb_free(e);
    return ok ? 0 : 1;
}
