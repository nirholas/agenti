#!/bin/bash
set -e

# 1. Update and install prerequisites for adding keys/repos
# We need these BEFORE we can fetch the Kitware keys.
apt-get update
apt-get install -y --no-install-recommends \
    wget \
    gpg \
    ca-certificates

# 2. Add the Kitware repository
wget -O - https://apt.kitware.com/keys/kitware-archive-latest.asc 2>/dev/null | gpg --dearmor - | tee /usr/share/keyrings/kitware-archive-keyring.gpg >/dev/null
echo 'deb [signed-by=/usr/share/keyrings/kitware-archive-keyring.gpg] https://apt.kitware.com/ubuntu/ jammy main' | tee /etc/apt/sources.list.d/kitware.list >/dev/null

# 3. Update apt to see the new repository
apt-get update

# 4. Install the package list
# We use xargs to parse the text file and pass it to apt-get install
xargs -a ./packages.txt apt-get install -y --no-install-recommends

# 5. Cleanup to keep layer size down
rm -rf /var/lib/apt/lists/*