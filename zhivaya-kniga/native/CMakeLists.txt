# Нативная часть «Живой книги»: llama.cpp (статически) + JNI-мост.
# Используется и Android-сборкой (через app/build.gradle.kts), и настольной сборкой для тестов.
cmake_minimum_required(VERSION 3.18)
project(livebook_native C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)
set(BUILD_SHARED_LIBS OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_COMMON OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_TESTS OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_TOOLS OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_SERVER OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_APP OFF CACHE BOOL "" FORCE)
set(LLAMA_OPENSSL OFF CACHE BOOL "" FORCE)
set(LLAMA_ALL_WARNINGS OFF CACHE BOOL "" FORCE)
set(GGML_OPENMP OFF CACHE BOOL "" FORCE)
set(GGML_NATIVE OFF CACHE BOOL "" FORCE)
if(ANDROID)
    # Dimensity 6100+ (Cortex-A76/A55) — ARMv8.2 с dotprod и fp16.
    set(GGML_CPU_ARM_ARCH "armv8.2-a+dotprod+fp16" CACHE STRING "" FORCE)
endif()

add_subdirectory(${CMAKE_CURRENT_SOURCE_DIR}/../third_party/llama.cpp ${CMAKE_CURRENT_BINARY_DIR}/llama.cpp EXCLUDE_FROM_ALL)

add_library(livebook_llm SHARED lb_engine.cpp lb_jni.cpp)
target_link_libraries(livebook_llm PRIVATE llama)
if(ANDROID)
    target_link_libraries(livebook_llm PRIVATE log)
    target_link_options(livebook_llm PRIVATE "-Wl,-z,max-page-size=16384")
else()
    find_package(JNI REQUIRED)
    target_include_directories(livebook_llm PRIVATE ${JNI_INCLUDE_DIRS})
endif()

if(NOT ANDROID OR LIVEBOOK_BUILD_CLI)
    add_executable(lb_cli lb_cli.cpp lb_engine.cpp)
    target_link_libraries(lb_cli PRIVATE llama)
endif()
