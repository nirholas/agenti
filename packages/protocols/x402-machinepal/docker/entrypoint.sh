#!/bin/bash
set -e

# ----------------------------------------------------------------------
# CONSTANTS & SETUP
# ----------------------------------------------------------------------
BINARY_PATH="/usr/local/bin/machinepal"
DATA_DIR="/machinepal"

# Helper function for consistent logging
log() {
    printf '[%s] [ENTRYPOINT] %s\n' "$(date +'%Y-%m-%d %H:%M:%S')" "$*" >&2
}

log "Starting MachinePal container entrypoint..."``

# ----------------------------------------------------------------------
# 1. ENVIRONMENT CHECKS (UID/GID)
# ----------------------------------------------------------------------

if [ -z "${PUID}" ]; then
    log "Error: PUID environment variable is not set."
    log "Please run this container with: -e PUID=\$(id -u) -e PGID=\$(id -g) flags to set the user and group IDs to the current host user."
    exit 1
fi

if [ -z "${PGID}" ]; then
    log "Error: PGID environment variable is not set."
    log "Please run this container with: -e PUID=\$(id -u) -e PGID=\$(id -g) flags to set the user and group IDs to the current host user."
    exit 1
fi

USER_ID=${PUID}
GROUP_ID=${PGID}

# ----------------------------------------------------------------------
# 2. USER & GROUP CREATION (Robust)
# ----------------------------------------------------------------------

# Create group if it doesn't exist
if ! getent group machinepal >/dev/null; then
    # Check if the GID is already taken by another group
    if getent group "$GROUP_ID" >/dev/null; then
        log "Warning: GID $GROUP_ID is already in use. Using existing group."
        GROUP_NAME=$(getent group "$GROUP_ID" | cut -d: -f1)
    else
        groupadd --gid "$GROUP_ID" machinepal
        GROUP_NAME="machinepal"
    fi
else
    GROUP_NAME="machinepal"
fi

# Create user if it doesn't exist
if ! id -u machinepal >/dev/null 2>&1; then
    # Check if UID is taken
    if getent passwd "$USER_ID" >/dev/null; then
        log "Error: UID $USER_ID is already taken by another user inside the container."
        exit 1
    fi
    adduser --disabled-password --gecos "" --force-badname --gid "$GROUP_ID" --uid "$USER_ID" machinepal
    log "User setup complete  as UID:$USER_ID / GID:$GROUP_ID"
fi

log "Running as user UID:$USER_ID / GID:$GROUP_ID"

# ----------------------------------------------------------------------
# 3. MOUNTPOINT CHECK
# ----------------------------------------------------------------------

mountpoint -q "$DATA_DIR" || {
    log "Error: $DATA_DIR is NOT a mountpoint."
    log "Machinepal requires an external volume for data and configuration."
    log "Please map an external volume to $DATA_DIR. Example: -v \$(pwd):$DATA_DIR"
    exit 1
}


# ----------------------------------------------------------------------
# 4. RESCUE MODE / DEBUGGING
# ----------------------------------------------------------------------

# Print diagnostics
printf '[ENTRYPOINT] argv: %s | pwd=%s | uid=%s gid=%s | whoami=%s\n' \
  "$*" "$(pwd)" "$(id -u)" "$(id -g)" "$(whoami)" >&2

# Shell override
if [ "$1" = "/bin/bash" ] || [ "$1" = "/bin/sh" ]; then
    log "Shell requested, executing command directly..."
    exec "$@"
fi

# ----------------------------------------------------------------------
# 5. EXECUTION WITH STDBUF
# ----------------------------------------------------------------------

if [ ! -f "$BINARY_PATH" ]; then
    log "CRITICAL ERROR: Binary not found at $BINARY_PATH"
    exit 1
fi

log "Starting MachinePal application..."

if [ $# -eq 0 ]; then
    exec gosu machinepal $BINARY_PATH
else
    exec gosu machinepal $BINARY_PATH "$@"
fi
