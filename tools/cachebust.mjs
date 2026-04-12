// Tiny dev-only script: rewrite <script src="js/foo.js"> → <script src="js/foo.js?v=N">
// in index.html. Run via `node tools/cachebust.mjs <version>`. Idempotent — strips any
// existing ?v=... first, then appends the new one. Used to defeat browser HTTP cache during
// rapid iteration without having to manually edit every tag.
//
// Usage:
//   node tools/cachebust.mjs 227

import { readFileSync, writeFileSync } from 'node:fs';

const version = process.argv[2];
if (!version) {
    console.error('Usage: node tools/cachebust.mjs <version>');
    process.exit(1);
}

const path = 'index.html';
let html = readFileSync(path, 'utf8');

// Replace only local js/* script tags. CDN tags are left alone.
// Handles both <script src="..."> and <script defer src="...">
html = html.replace(
    /<script(\s+defer)?\s+src="(js\/[^"?]+)(\?v=[^"]*)?"><\/script>/g,
    `<script$1 src="$2?v=${version}"></script>`
);

// Also bump local css/* stylesheet tags
html = html.replace(
    /<link\s+rel="stylesheet"\s+href="(css\/[^"?]+)(\?v=[^"]*)?"\s*>/g,
    `<link rel="stylesheet" href="$1?v=${version}">`
);

writeFileSync(path, html);
console.log(`cachebust: bumped local js/* and css/* tags to v=${version}`);
