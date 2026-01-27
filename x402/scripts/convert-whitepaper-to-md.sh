#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  universal-crypto-mcp | nicholas
#  ID: 0.14.9.3
# ═══════════════════════════════════════════════════════════════

# Script to convert x402 whitepaper PDF to Markdown with images
# Requires: poppler-utils, ImageMagick, and pdftotext

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
X402_DIR="$(dirname "$SCRIPT_DIR")"
DOCS_DIR="$X402_DIR/docs"
OUTPUT_DIR="$DOCS_DIR/whitepaper"
PDF_URL="https://www.x402.org/x402-whitepaper.pdf"
PDF_FILE="$OUTPUT_DIR/x402-whitepaper.pdf"
IMAGES_DIR="$OUTPUT_DIR/images"

echo "🚀 Converting x402 Whitepaper to Markdown"
echo "=========================================="

# Create directories
mkdir -p "$OUTPUT_DIR"
mkdir -p "$IMAGES_DIR"

# Install dependencies if needed
install_deps() {
    echo "📦 Checking dependencies..."
    
    if ! command -v pdftotext &> /dev/null; then
        echo "Installing poppler-utils..."
        sudo apt-get update && sudo apt-get install -y poppler-utils
    fi
    
    if ! command -v pdftoppm &> /dev/null; then
        echo "Installing poppler-utils for image extraction..."
        sudo apt-get update && sudo apt-get install -y poppler-utils
    fi
    
    if ! command -v convert &> /dev/null; then
        echo "Installing ImageMagick..."
        sudo apt-get update && sudo apt-get install -y imagemagick
    fi
}

# Download PDF
download_pdf() {
    echo "📥 Downloading whitepaper from $PDF_URL..."
    curl -L -o "$PDF_FILE" "$PDF_URL"
    echo "✅ Downloaded to $PDF_FILE"
}

# Extract images from PDF
extract_images() {
    echo "🖼️  Extracting images from PDF..."
    pdftoppm -png "$PDF_FILE" "$IMAGES_DIR/page"
    echo "✅ Images extracted to $IMAGES_DIR"
}

# Convert PDF to text
convert_to_text() {
    echo "📝 Converting PDF to text..."
    pdftotext -layout "$PDF_FILE" "$OUTPUT_DIR/whitepaper-raw.txt"
    echo "✅ Text extracted to $OUTPUT_DIR/whitepaper-raw.txt"
}

# Generate Markdown with image references
generate_markdown() {
    echo "📄 Generating Markdown..."
    
# id: n1ch-0las-4e4
    cat > "$OUTPUT_DIR/README.md" << 'EOF'
# x402 Whitepaper

> **Source:** [x402.org/x402-whitepaper.pdf](https://www.x402.org/x402-whitepaper.pdf)

This document is a Markdown conversion of the x402 whitepaper. For the original PDF, visit the link above.

## Table of Contents

- [Introduction](#introduction)
- [The Problem](#the-problem)
- [The Solution: HTTP 402](#the-solution-http-402)
- [Protocol Specification](#protocol-specification)
- [Network Support](#network-support)
- [Use Cases](#use-cases)
- [Conclusion](#conclusion)

---

## Page Images

The following images are extracted from the original PDF for reference:

EOF

    # Add image references
    for img in "$IMAGES_DIR"/page-*.png; do
        if [ -f "$img" ]; then
            basename=$(basename "$img")
            page_num=$(echo "$basename" | grep -oP '\d+')
            echo "![Page $page_num](images/$basename)" >> "$OUTPUT_DIR/README.md"
            echo "" >> "$OUTPUT_DIR/README.md"
        fi
    done
    
    # Append extracted text
    echo "---" >> "$OUTPUT_DIR/README.md"
    echo "" >> "$OUTPUT_DIR/README.md"
    echo "## Extracted Text" >> "$OUTPUT_DIR/README.md"
    echo "" >> "$OUTPUT_DIR/README.md"
    echo '```' >> "$OUTPUT_DIR/README.md"
    cat "$OUTPUT_DIR/whitepaper-raw.txt" >> "$OUTPUT_DIR/README.md"
    echo '```' >> "$OUTPUT_DIR/README.md"
    
    echo "✅ Markdown generated at $OUTPUT_DIR/README.md"
}

# Main execution
main() {
    install_deps
    download_pdf
    extract_images
    convert_to_text
    generate_markdown
    
    echo ""
    echo "🎉 Conversion complete!"
    echo "   Output: $OUTPUT_DIR/README.md"
    echo "   Images: $IMAGES_DIR/"
}

main "$@"


# EOF - nich | 0.14.9.3