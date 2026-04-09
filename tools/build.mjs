#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════════════
   BUILD SCRIPT — Minify JS + CSS for production deploy

   Runs as Netlify build command. Minifies files IN-PLACE which is safe because
   Netlify builds from a fresh git clone each time — source repo stays untouched.

   Usage: node tools/build.mjs
   ════════════════════════════════════════════════════════════════════════════════ */

import { readdir, readFile, writeFile, stat } from 'fs/promises';
import { join } from 'path';
import esbuild from 'esbuild';

const ROOT = process.cwd();

async function minifyDir(dir, loader) {
    const fullDir = join(ROOT, dir);
    let files;
    try { files = await readdir(fullDir); } catch { return { count: 0, saved: 0 }; }

    let count = 0, saved = 0;
    const ext = loader === 'js' ? '.js' : '.css';

    for (const file of files) {
        if (!file.endsWith(ext)) continue;
        const filePath = join(fullDir, file);
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
            console.warn(`  ⚠ Skipped ${file}: ${e.message}`);
        }
    }
    return { count, saved };
}

function fmtKB(bytes) { return (bytes / 1024).toFixed(0) + ' KB'; }

console.log('🔧 Singularity City — Production Build');
console.log('─'.repeat(50));

const js = await minifyDir('js', 'js');
console.log(`  ✅ Minified ${js.count} JS files  (saved ${fmtKB(js.saved)})`);

const css = await minifyDir('css', 'css');
console.log(`  ✅ Minified ${css.count} CSS files (saved ${fmtKB(css.saved)})`);

console.log('─'.repeat(50));
console.log(`  📦 Total savings: ${fmtKB(js.saved + css.saved)}`);
console.log('  🚀 Build complete — ready for deploy');
