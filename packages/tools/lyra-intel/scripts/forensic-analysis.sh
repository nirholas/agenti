#!/bin/bash
#
# Lyra Intel - Complete Forensic Analysis Script
#
# This script performs comprehensive forensic mapping of a repository:
# - Collects all files with metadata
# - Analyzes code metrics
# - Extracts git history
# - Maps dependencies
# - Parses AST for all languages
# - Extracts documentation relationships
# - Builds searchable database
#
# Usage: ./forensic-analysis.sh /path/to/repository [output_dir]
#

set -e

# =============================================================================
# Configuration
# =============================================================================

REPO_PATH="${1:-.}"
OUTPUT_DIR="${2:-forensic-analysis-$(date +%Y%m%d-%H%M%S)}"
PARALLEL_JOBS=4

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# =============================================================================
# Helper Functions
# =============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# =============================================================================
# Pre-flight Checks
# =============================================================================

echo ""
echo "============================================================"
echo "  🔮 LYRA INTEL - Forensic Analysis"
echo "============================================================"
echo ""

if [ ! -d "$REPO_PATH" ]; then
    log_error "Repository path does not exist: $REPO_PATH"
    exit 1
fi

cd "$REPO_PATH"
REPO_PATH=$(pwd)

log_info "Repository: $REPO_PATH"
log_info "Output: $OUTPUT_DIR"

mkdir -p "$OUTPUT_DIR"

# =============================================================================
# Phase 1: File System Mapping
# =============================================================================

log_info "Phase 1: Mapping file system..."

# Generate file tree
if command -v tree &> /dev/null; then
    tree -a -I 'node_modules|.next|.git|__pycache__|dist|build|.cache' \
        -J --dirsfirst > "$OUTPUT_DIR/tree.json" 2>/dev/null || true
    tree -a -I 'node_modules|.next|.git|__pycache__|dist|build|.cache' \
        --dirsfirst > "$OUTPUT_DIR/tree.txt" 2>/dev/null || true
fi

# List all files with metadata
find . -type f \
    ! -path '*/node_modules/*' \
    ! -path '*/.next/*' \
    ! -path '*/.git/*' \
    ! -path '*/__pycache__/*' \
    ! -path '*/dist/*' \
    ! -path '*/build/*' \
    -printf '%p|%s|%T@|%m\n' 2>/dev/null > "$OUTPUT_DIR/all-files.csv" || \
find . -type f \
    ! -path '*/node_modules/*' \
    ! -path '*/.next/*' \
    ! -path '*/.git/*' \
    ! -path '*/__pycache__/*' \
    -exec stat -f '%N|%z|%m|%p' {} \; > "$OUTPUT_DIR/all-files.csv" 2>/dev/null || true

FILE_COUNT=$(wc -l < "$OUTPUT_DIR/all-files.csv" | tr -d ' ')
log_success "Found $FILE_COUNT files"

# =============================================================================
# Phase 2: Code Metrics
# =============================================================================

log_info "Phase 2: Analyzing code metrics..."

# Count lines of code
if command -v cloc &> /dev/null; then
    cloc . --exclude-dir=node_modules,.next,.git,__pycache__,dist,build,.cache \
        --csv --by-file --quiet --out="$OUTPUT_DIR/cloc-by-file.csv" 2>/dev/null || true
    cloc . --exclude-dir=node_modules,.next,.git,__pycache__,dist,build,.cache \
        --csv --quiet --out="$OUTPUT_DIR/cloc-summary.csv" 2>/dev/null || true
    log_success "Code metrics collected with cloc"
elif command -v tokei &> /dev/null; then
    tokei -o json > "$OUTPUT_DIR/tokei.json" 2>/dev/null || true
    log_success "Code metrics collected with tokei"
else
    # Fallback: manual line counting
    log_warn "cloc/tokei not found, using fallback..."
    find . -type f \( -name "*.py" -o -name "*.js" -o -name "*.ts" -o -name "*.tsx" \
        -o -name "*.go" -o -name "*.rs" -o -name "*.java" \) \
        ! -path '*/node_modules/*' ! -path '*/.git/*' \
        -exec wc -l {} \; > "$OUTPUT_DIR/line-counts.txt" 2>/dev/null || true
fi

# =============================================================================
# Phase 3: Git History Analysis
# =============================================================================

log_info "Phase 3: Analyzing git history..."

if [ -d ".git" ]; then
    # Complete commit history
    git log --all --numstat --date=iso \
        --pretty=format:'COMMIT|%h|%an|%ae|%ad|%s' \
        > "$OUTPUT_DIR/git-history.txt" 2>/dev/null || true

    # File change history
    git log --all --name-status --oneline \
        > "$OUTPUT_DIR/git-changes.txt" 2>/dev/null || true

    # Contributors
    git shortlog -sn --all > "$OUTPUT_DIR/contributors.txt" 2>/dev/null || true

    # Branches
    git branch -a > "$OUTPUT_DIR/branches.txt" 2>/dev/null || true

    # Tags
    git tag -l > "$OUTPUT_DIR/tags.txt" 2>/dev/null || true

    COMMIT_COUNT=$(git rev-list --all --count 2>/dev/null || echo "0")
    log_success "Analyzed $COMMIT_COUNT commits"
else
    log_warn "Not a git repository, skipping git analysis"
fi

# =============================================================================
# Phase 4: Dependency Analysis
# =============================================================================

log_info "Phase 4: Analyzing dependencies..."

# Node.js dependencies
if [ -f "package.json" ]; then
    cp package.json "$OUTPUT_DIR/package.json"
    if [ -f "package-lock.json" ]; then
        # Extract dependency tree
        cat package-lock.json | python3 -c "
import json, sys
data = json.load(sys.stdin)
deps = data.get('packages', data.get('dependencies', {}))
for name, info in list(deps.items())[:100]:
    version = info.get('version', 'unknown') if isinstance(info, dict) else 'unknown'
    print(f'{name}|{version}')
" > "$OUTPUT_DIR/npm-deps.csv" 2>/dev/null || true
    fi
    log_success "Node.js dependencies extracted"
fi

# Python dependencies
if [ -f "requirements.txt" ]; then
    cp requirements.txt "$OUTPUT_DIR/requirements.txt"
    log_success "Python requirements found"
fi

if [ -f "pyproject.toml" ]; then
    cp pyproject.toml "$OUTPUT_DIR/pyproject.toml"
    log_success "Python pyproject.toml found"
fi

# Go dependencies
if [ -f "go.mod" ]; then
    cp go.mod "$OUTPUT_DIR/go.mod"
    log_success "Go modules found"
fi

# =============================================================================
# Phase 5: Import/Export Analysis
# =============================================================================

log_info "Phase 5: Extracting imports and exports..."

# Python imports
grep -r -n "^import\|^from.*import" --include='*.py' \
    --exclude-dir={node_modules,.next,.git,__pycache__} . \
    > "$OUTPUT_DIR/python-imports.txt" 2>/dev/null || true

# JavaScript/TypeScript imports
grep -r -n "^import\|require(" --include='*.js' --include='*.ts' --include='*.tsx' \
    --exclude-dir={node_modules,.next,.git,dist} . \
    > "$OUTPUT_DIR/js-imports.txt" 2>/dev/null || true

# Go imports
grep -r -n "^import\|^import (" --include='*.go' \
    --exclude-dir={vendor,.git} . \
    > "$OUTPUT_DIR/go-imports.txt" 2>/dev/null || true

log_success "Import analysis complete"

# =============================================================================
# Phase 6: Documentation Extraction
# =============================================================================

log_info "Phase 6: Extracting documentation..."

# List all markdown files
find . -name '*.md' -o -name '*.mdx' -o -name '*.rst' \
    ! -path '*/node_modules/*' ! -path '*/.git/*' \
    > "$OUTPUT_DIR/doc-files.txt" 2>/dev/null || true

# Extract doc titles
while IFS= read -r file; do
    if [ -f "$file" ]; then
        title=$(head -5 "$file" | grep -m1 "^#" | sed 's/^#\+\s*//' || echo "Untitled")
        echo "$file|$title"
    fi
done < "$OUTPUT_DIR/doc-files.txt" > "$OUTPUT_DIR/doc-index.csv" 2>/dev/null || true

DOC_COUNT=$(wc -l < "$OUTPUT_DIR/doc-files.txt" | tr -d ' ')
log_success "Found $DOC_COUNT documentation files"

# =============================================================================
# Phase 7: Code Reference Extraction
# =============================================================================

log_info "Phase 7: Extracting code references..."

# TODO/FIXME/NOTE comments
grep -r -n "TODO\|FIXME\|NOTE\|HACK\|XXX" \
    --include='*.py' --include='*.js' --include='*.ts' --include='*.tsx' --include='*.go' \
    --exclude-dir={node_modules,.next,.git,__pycache__} . \
    > "$OUTPUT_DIR/todos.txt" 2>/dev/null || true

# Function definitions
grep -r -n "^def \|^async def \|function \|func \|const.*=.*=>" \
    --include='*.py' --include='*.js' --include='*.ts' --include='*.tsx' --include='*.go' \
    --exclude-dir={node_modules,.next,.git,__pycache__} . \
    > "$OUTPUT_DIR/functions.txt" 2>/dev/null || true

# Class definitions
grep -r -n "^class \|^interface \|^type " \
    --include='*.py' --include='*.js' --include='*.ts' --include='*.tsx' --include='*.go' \
    --exclude-dir={node_modules,.next,.git,__pycache__} . \
    > "$OUTPUT_DIR/classes.txt" 2>/dev/null || true

FUNC_COUNT=$(wc -l < "$OUTPUT_DIR/functions.txt" | tr -d ' ')
CLASS_COUNT=$(wc -l < "$OUTPUT_DIR/classes.txt" | tr -d ' ')
log_success "Found $FUNC_COUNT functions, $CLASS_COUNT classes"

# =============================================================================
# Phase 8: Generate Summary Report
# =============================================================================

log_info "Phase 8: Generating summary report..."

cat > "$OUTPUT_DIR/SUMMARY.md" << EOF
# Forensic Analysis Report

**Repository:** $REPO_PATH
**Generated:** $(date -Iseconds)

## Statistics

- **Total Files:** $FILE_COUNT
- **Documentation Files:** $DOC_COUNT
- **Functions:** $FUNC_COUNT
- **Classes:** $CLASS_COUNT
- **Git Commits:** ${COMMIT_COUNT:-N/A}

## Output Files

| File | Description |
|------|-------------|
| tree.json | Directory structure as JSON |
| tree.txt | Directory structure as text |
| all-files.csv | All files with metadata |
| cloc-*.csv | Lines of code by file/language |
| git-history.txt | Complete commit history |
| git-changes.txt | File changes per commit |
| contributors.txt | Contributor statistics |
| *-imports.txt | Import statements by language |
| doc-files.txt | List of documentation files |
| doc-index.csv | Documentation titles index |
| todos.txt | TODO/FIXME comments |
| functions.txt | Function definitions |
| classes.txt | Class definitions |

## Next Steps

1. Import data into SQLite database
2. Build code↔doc relationship mappings
3. Generate interactive visualization
4. Identify orphan code and documentation

EOF

log_success "Summary report generated"

# =============================================================================
# Complete
# =============================================================================

echo ""
echo "============================================================"
echo "  ✅ FORENSIC ANALYSIS COMPLETE"
echo "============================================================"
echo ""
echo "Results saved to: $OUTPUT_DIR/"
echo ""
echo "Files generated:"
ls -la "$OUTPUT_DIR/"
echo ""
echo "To analyze results, run:"
echo "  python cli.py analyze $OUTPUT_DIR"
echo ""
