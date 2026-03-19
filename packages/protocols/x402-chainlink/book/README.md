# LinkLab Masterclass: Intro to Chainlink Runtime Environment (CRE) with x402 Book

This directory contains the mdbook source files for the "LinkLab Masterclass: Intro to Chainlink Runtime Environment (CRE) with x402".

## Building the Book

To build the book:

```bash
cd book
mdbook build
```

## Serving Locally

To serve the book locally with live reload:

```bash
cd book
mdbook serve --open --port 3001
```

This will start a local server at `http://localhost:3001` and automatically reload when you make changes.

> **Note:** The default port for mdbook is 3000, but we need that port for server. To avoid conflicts with server service, we are using the `--port` flag.

## Adding Content

1. Edit markdown files in `src/`
2. Update `src/SUMMARY.md` if adding new chapters
3. Run `mdbook serve` to preview changes

