cmake_minimum_required(VERSION 3.18)

# Configurre Precompiled headers
# --- Make PCH cache-friendly ---
# --- Make PCH cache-friendly ---
set_property(GLOBAL PROPERTY RULE_LAUNCH_COMPILE ccache)

# Required for PCH cacheability
set(ENV{CCACHE_SLOPPINESS} "pch_defines,include_file_mtime,time_macros")
set(ENV{CCACHE_COMPILERCHECK} "content")
set(ENV{CCACHE_IGNORE_HEADERS} "/usr/include/*")




project(machinepal LANGUAGES CXX)

# Enable thread safety globally
add_compile_definitions(
        SQLITE_THREADSAFE=1
        SQLITE_ENABLE_SERIALIZED=1
        SOCI_THREAD_SAFE=ON
)



# 1. Force SOCI to build ONLY static libraries (.a)
# We use FORCE to override any default options SOCI might set internally.
set(SOCI_SHARED OFF CACHE BOOL "Disable SOCI shared libraries" FORCE)
set(SOCI_STATIC ON  CACHE BOOL "Enable SOCI static libraries" FORCE)

# 2. Configure Backends
set(WITH_SQLITE3 ON CACHE BOOL "Build SOCI SQLite3 backend" FORCE)
option(ENABLE_POSTGRESQL "Enable PostgreSQL backend via SOCI" OFF)

if(ENABLE_POSTGRESQL)
    set(WITH_POSTGRESQL ON CACHE BOOL "Build SOCI PostgreSQL backend" FORCE)
endif()

set(BUILD_SHARED_LIBS OFF)


SET(SECP256K1_ENABLE_MODULE_RECOVERY ON)
foreach(submod json-schema-validator yaml-cpp secp256k1 soci)
    add_subdirectory(external/${submod})
endforeach()

# Acknowledge removal of FindBoost; use BoostConfig instead (vcpkg provides it).
if(POLICY CMP0167)
    cmake_policy(SET CMP0167 NEW)
endif()

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

# Gather all source files except test sources
set(APP_SRC_DIRS . admin config config/subconfigs crypto datastructures db exceptions examples facilitators facilitator_clients
        filesystem init  payment payment/datastructures url vibemarket vibemarket/datastructures x402_client x402_protocol x402_server)

set(APP_SRC_FILES)
foreach(dir ${APP_SRC_DIRS})
    file(GLOB APP_SRC_TMP src/${dir}/*.cpp ${dir}/*.h)
    list(APPEND APP_SRC_FILES ${APP_SRC_TMP})
endforeach()

list(FILTER APP_SRC_FILES EXCLUDE REGEX "src/tests/.*")

# Gather test source files
file(GLOB TEST_SRC_FILES src/tests/*.cpp)

# Gather all source files needed for tests (implementation + tests)
set(TEST_ALL_SRC_FILES ${APP_SRC_FILES} ${TEST_SRC_FILES})


# ---- Dependencies ----
foreach(pkg folly Wangle Proxygen CURL CLI11 spdlog)
    find_package(${pkg} REQUIRED CONFIG)
endforeach()



find_package(Boost REQUIRED CONFIG COMPONENTS unit_test_framework system thread url locale multiprecision)
find_package(OpenSSL REQUIRED)
find_package(cryptopp CONFIG REQUIRED)

# ---- App target ----
add_executable(machinepal
        main.cpp
        ${APP_SRC_FILES}
)
target_include_directories(machinepal PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/src ${CMAKE_CURRENT_SOURCE_DIR}/external/soci/include)


set (MACHINEPAL_COMMON_LIBS
        CURL::libcurl
        proxygen::proxygenhttpserver
        wangle::wangle
        Folly::folly
        Boost::boost
        Boost::system
        Boost::thread
        Boost::headers
        Boost::locale
        Boost::url
        Boost::multiprecision
        OpenSSL::Crypto
        OpenSSL::SSL
        nlohmann_json_schema_validator
        yaml-cpp
        spdlog::spdlog
        cryptopp::cryptopp
        CLI11::CLI11
        secp256k1
        soci_core
        soci_sqlite3
        soci_postgresql
)

if(ENABLE_POSTGRESQL)
    list(APPEND MACHINEPAL_COMMON_LIBS soci_postgresql)
    target_compile_definitions(machinepal PRIVATE ENABLE_POSTGRESQL)
endif()

target_link_libraries(machinepal
        PRIVATE
        ${MACHINEPAL_COMMON_LIBS}
)

target_compile_options(machinepal PRIVATE -Wno-deprecated-declarations -Werror)

option(ENABLE_ASAN "Enable AddressSanitizer" OFF)
if(ENABLE_ASAN)
    target_compile_options(machinepal PRIVATE -fsanitize=address -fno-omit-frame-pointer)
    target_link_options(machinepal PRIVATE -fsanitize=address)
endif()

# ---- Tests: Boost.Test + libcurl ----
include(CTest)
if(BUILD_TESTING)
    enable_testing()

    add_executable(mptest
            ${TEST_ALL_SRC_FILES}
    )
    target_compile_features(mptest PRIVATE cxx_std_20)
    target_include_directories(mptest
            PRIVATE
            ${CMAKE_CURRENT_SOURCE_DIR}/src
            ${CMAKE_CURRENT_SOURCE_DIR}/tests)


    target_link_libraries(mptest
            PRIVATE
            ${MACHINEPAL_COMMON_LIBS}
            Boost::unit_test_framework
    )

    if(ENABLE_POSTGRESQL)
        target_compile_definitions(mptest PRIVATE ENABLE_POSTGRESQL)
    endif()

    if(ENABLE_ASAN)
        target_compile_options(mptest PRIVATE -fsanitize=address -fno-omit-frame-pointer)
        target_link_options(mptest PRIVATE -fsanitize=address)
    endif()

    add_test(NAME mptest COMMAND mptest)
endif()

function(enable_warnings target)
    target_compile_options(${target} PRIVATE
            -Wall
            -Wextra
            -Wconversion-null
            -Wnull-dereference
            -Werror
    )
endfunction()

enable_warnings(machinepal)
enable_warnings(mptest)

# make everything compile faster
target_precompile_headers(machinepal PRIVATE "src/MachinePalCommon.h")
target_precompile_headers(mptest PRIVATE "src/MachinePalCommon.h")

# ---- CPack/DEB packaging ----
set(CPACK_GENERATOR "DEB")
set(CPACK_PACKAGE_CONTACT "Stan Kladko <maintainers@skalenetwork.com>")
set(CPACK_DEBIAN_PACKAGE_MAINTAINER "Stan Kladko <maintainers@skalenetwork.com>")
set(CPACK_DEBIAN_PACKAGE_DESCRIPTION "MachinePal core and test binaries")
set(CPACK_DEBIAN_PACKAGE_VERSION "1.0")
set(CPACK_DEBIAN_PACKAGE_ARCHITECTURE "amd64")
set(CPACK_DEBIAN_PACKAGE_DEPENDS "libstdc++6 (>= 11.2)")
set(CPACK_DEBIAN_PACKAGE_SHLIBDEPS ON)
install(TARGETS machinepal mptest DESTINATION usr/bin)
include(CPack)


# --- Print ccache statistics after build ---
find_program(CCACHE_PROGRAM ccache)

if(CCACHE_PROGRAM)
    add_custom_target(ccache_stats ALL
            COMMAND ${CCACHE_PROGRAM} --show-stats
            COMMENT "---- CCACHE STATS ----"
            VERBATIM
    )
endif()