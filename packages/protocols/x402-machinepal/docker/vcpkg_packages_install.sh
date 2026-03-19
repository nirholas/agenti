#!/bin/sh
set -e # Exit immediately if any command fails

export VCPKG_DISABLE_METRICS=1
export VCPKG_FORCE_SYSTEM_BINARIES=1

# Ensure VCPKG_ROOT is set
if [ -z "$VCPKG_ROOT" ]; then
    echo "Error: VCPKG_ROOT environment variable is not set."
    exit 1
fi

echo ">> Bootstrapping VCPKG..."
"$VCPKG_ROOT/bootstrap-vcpkg.sh" -disableMetrics

echo ">> Configuring Release-only build for x64-linux..."
TRIPLET_FILE="$VCPKG_ROOT/triplets/x64-linux.cmake"
# Check if we already patched it to prevent duplicate lines if run multiple times
if ! grep -q "VCPKG_BUILD_TYPE release" "$TRIPLET_FILE"; then
    echo "set(VCPKG_BUILD_TYPE release)" >> "$TRIPLET_FILE"
fi

echo ">> Installing Dependencies..."
# --clean-after-build removes temporary build artifacts to keep Docker image small
"$VCPKG_ROOT/vcpkg" install --triplet x64-linux --clean-after-build