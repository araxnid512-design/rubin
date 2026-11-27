// JNI-мост: ru.livebook.core.llm.LlamaNative
#include <jni.h>
#include <string>
#include "lb_engine.h"

static std::string g_last_error;

static std::string bytes_to_string(JNIEnv *env, jbyteArray arr) {
    if (!arr) return std::string();
    jsize n = env->GetArrayLength(arr);
    std::string s((size_t) n, '\0');
    if (n > 0) env->GetByteArrayRegion(arr, 0, n, reinterpret_cast<jbyte *>(&s[0]));
    return s;
}

static jbyteArray string_to_bytes(JNIEnv *env, const std::string &s) {
    jbyteArray arr = env->NewByteArray((jsize) s.size());
    if (arr && !s.empty()) env->SetByteArrayRegion(arr, 0, (jsize) s.size(), reinterpret_cast<const jbyte *>(s.data()));
    return arr;
}

extern "C" {

JNIEXPORT jlong JNICALL Java_ru_livebook_core_llm_LlamaNative_nativeLoad(JNIEnv *env, jobject, jbyteArray path, jint nCtx, jint nThreads) {
    std::string err;
    LbEngine *e = lb_load(bytes_to_string(env, path).c_str(), nCtx, nThreads, err);
    g_last_error = err;
    return reinterpret_cast<jlong>(e);
}

JNIEXPORT void JNICALL Java_ru_livebook_core_llm_LlamaNative_nativeFree(JNIEnv *, jobject, jlong h) {
    lb_free(reinterpret_cast<LbEngine *>(h));
}

JNIEXPORT jbyteArray JNICALL Java_ru_livebook_core_llm_LlamaNative_nativeLastError(JNIEnv *env, jobject) {
    return string_to_bytes(env, g_last_error);
}

JNIEXPORT void JNICALL Java_ru_livebook_core_llm_LlamaNative_nativeSetThreads(JNIEnv *, jobject, jlong h, jint n) {
    lb_set_threads(reinterpret_cast<LbEngine *>(h), n);
}

JNIEXPORT jint JNICALL Java_ru_livebook_core_llm_LlamaNative_nativeContextSize(JNIEnv *, jobject, jlong h) {
    return lb_n_ctx(reinterpret_cast<LbEngine *>(h));
}

JNIEXPORT jint JNICALL Java_ru_livebook_core_llm_LlamaNative_nativeCountTokens(JNIEnv *env, jobject, jlong h, jbyteArray text) {
    return lb_count_tokens(reinterpret_cast<LbEngine *>(h), bytes_to_string(env, text));
}

JNIEXPORT jbyteArray JNICALL Java_ru_livebook_core_llm_LlamaNative_nativeMeta(JNIEnv *env, jobject, jlong h, jbyteArray key) {
    return string_to_bytes(env, lb_meta(reinterpret_cast<LbEngine *>(h), bytes_to_string(env, key).c_str()));
}

JNIEXPORT void JNICALL Java_ru_livebook_core_llm_LlamaNative_nativeCancel(JNIEnv *, jobject, jlong h) {
    lb_cancel(reinterpret_cast<LbEngine *>(h));
}

JNIEXPORT void JNICALL Java_ru_livebook_core_llm_LlamaNative_nativeClearCache(JNIEnv *, jobject, jlong h) {
    lb_clear_cache(reinterpret_cast<LbEngine *>(h));
}

JNIEXPORT jbyteArray JNICALL Java_ru_livebook_core_llm_LlamaNative_nativeSystemInfo(JNIEnv *env, jobject) {
    return string_to_bytes(env, lb_system_info());
}

// Возвращает double[8]: ok, promptTokens, reusedTokens, genTokens, promptMs, ttftMs, genMs, stopReason
JNIEXPORT jdoubleArray JNICALL Java_ru_livebook_core_llm_LlamaNative_nativeGenerate(
        JNIEnv *env, jobject, jlong h, jbyteArray prompt, jbyteArray grammar, jint maxTokens,
        jfloat temp, jfloat topP, jint topK, jfloat repeatPenalty, jint seed, jbyteArray avoid, jobject callback) {
    LbGenParams p;
    p.max_tokens = maxTokens;
    p.temp = temp;
    p.top_p = topP;
    p.top_k = topK;
    p.repeat_penalty = repeatPenalty;
    p.seed = seed < 0 ? 0xFFFFFFFFu : (uint32_t) seed;
    p.grammar = bytes_to_string(env, grammar);
    p.avoid = bytes_to_string(env, avoid);
    jclass cls = env->GetObjectClass(callback);
    jmethodID mid = env->GetMethodID(cls, "onPiece", "([B)Z");
    LbStats st;
    std::string err;
    bool ok = lb_generate(reinterpret_cast<LbEngine *>(h), bytes_to_string(env, prompt), p,
                          [&](const std::string &piece) {
                              jbyteArray arr = string_to_bytes(env, piece);
                              jboolean cont = env->CallBooleanMethod(callback, mid, arr);
                              env->DeleteLocalRef(arr);
                              if (env->ExceptionCheck()) return false;
                              return cont == JNI_TRUE;
                          }, st, err);
    g_last_error = err;
    jdouble vals[8] = {ok ? 1.0 : 0.0, (double) st.prompt_tokens, (double) st.reused_tokens, (double) st.gen_tokens,
                       st.prompt_ms, st.ttft_ms, st.gen_ms, (double) st.stop_reason};
    jdoubleArray out = env->NewDoubleArray(8);
    env->SetDoubleArrayRegion(out, 0, 8, vals);
    return out;
}

}
