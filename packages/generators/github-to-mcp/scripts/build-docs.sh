#!/bin/bash
# Build MkDocs and copy to Next.js public folder

set -e

echo "Building MkDocs documentation..."

# Install MkDocs dependencies
pip install -q -r mkdocs/requirements.txt

# Build MkDocs to static HTML
cd mkdocs
mkdocs build --site-dir ../apps/web/public/docs
cd ..

echo "✓ MkDocs built to apps/web/public/docs"
