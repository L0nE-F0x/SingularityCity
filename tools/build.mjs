#!/usr/bin/env node
/* ============================================================================
   BUILD SCRIPT — Minify JS + CSS for production deploy

   Runs as Netlify build command. Minifies files IN-PLACE which is safe because
   Netlify builds from a fresh git clone each time — source repo stays untouched.

   Usage: node tools/build.mjs

   NOTE — single-bundle concatenation was evaluated (audit A2) and deliberately
   NOT adopted. Concatenating the ~99 shared-global classic scripts into one
   file regresses boot: engine.js's top-level `const G` lands in the temporal
   dead zone in the merged script scope while `var` globals survive, so the app
   stalls at "Connecting to cloud". Per-file minification below already captures
   the main win (~1.75 MB saved) and Netlify serves everything gzip/brotli over
   HTTP/2, which multiplexes the request count away — so bundling's marginal
   benefit isn't worth the fragility. Keep dev unbundled; ship minified.

   First Person lives under first-person/ as ESM modules (with nested interiors/
   and store/). Those trees are minified recursively. Vendored three.js under
   first-person/lib/ is left alone — it is already a production build.
   ============================================================================ */

import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import esbuild from 'esbuild';

const ROOT = process.cwd();

/**
 * Collect every file under `dir` whose name ends with `ext`.
 * Non-recursive when recursive=false (classic js/ and css/ layout).
 */
async function listFiles(dir, ext, recursive) {
    const fullDir = join(ROOT, dir);
    let entries;
    try {
        entries = await readdir(fullDir, { withFileTypes: true });
    } catch {
        return [];
    }

    const out = [];
    for (const entry of entries) {
        const rel = join(dir, entry.name);
        if (entry.isDirectory()) {
            if (recursive) {
                out.push(...(await listFiles(rel, ext, true)));
            }
            continue;
        }
        if (entry.isFile() && entry.name.endsWith(ext)) {
            out.push(rel);
        }
    }
    return out;
}

async function minifyPaths(paths, loader) {
    let count = 0;
    let saved = 0;

    for (const rel of paths) {
        const filePath = join(ROOT, rel);
        const original = await readFile(filePath, 'utf8');
        const originalSize = Buffer.byteLength(original, 'utf8');

        try {
            const result = await esbuild.transform(original, {
                loader,
                minify: true,
            });
            await writeFile(filePath, result.code, 'utf8');
            const newSize = Buffer.byteLength(result.code, 'utf8');
            saved += originalSize - newSize;
            count++;
        } catch (e) {
            console.warn(`  ⚠ Skipped ${rel}: ${e.message}`);
        }
    }
    return { count, saved };
}

async function minifyDir(dir, loader, { recursive = false } = {}) {
    const ext = loader === 'js' ? '.js' : '.css';
    const paths = await listFiles(dir, ext, recursive);
    return minifyPaths(paths, loader);
}

function fmtKB(bytes) {
    return (bytes / 1024).toFixed(0) + ' KB';
}

console.log('Singularity City — Production Build');
console.log('-'.repeat(50));

const js = await minifyDir('js', 'js');
console.log(`  Minified ${js.count} JS files  (saved ${fmtKB(js.saved)})`);

const css = await minifyDir('css', 'css');
console.log(`  Minified ${css.count} CSS files (saved ${fmtKB(css.saved)})`);

// First Person: recursive ESM tree. Do not touch first-person/lib (vendored three).
const fpJs = await minifyDir('first-person/js', 'js', { recursive: true });
console.log(`  Minified ${fpJs.count} First Person JS files  (saved ${fmtKB(fpJs.saved)})`);

const fpCss = await minifyDir('first-person/css', 'css', { recursive: true });
console.log(`  Minified ${fpCss.count} First Person CSS files (saved ${fmtKB(fpCss.saved)})`);

// Shared source-of-truth modules imported by First Person (and, in time, the 2D
// app). Minified with the same per-file transform — esbuild preserves ESM
// import/export, so the specifiers First Person resolves stay intact.
const sharedJs = await minifyDir('shared', 'js', { recursive: true });
console.log(`  Minified ${sharedJs.count} shared JS files  (saved ${fmtKB(sharedJs.saved)})`);

const totalSaved = js.saved + css.saved + fpJs.saved + fpCss.saved + sharedJs.saved;
console.log('-'.repeat(50));
console.log(`  Total savings: ${fmtKB(totalSaved)}`);
console.log('  Build complete — ready for deploy');