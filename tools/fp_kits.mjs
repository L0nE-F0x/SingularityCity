#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════════
   fp_kits — compress the First Person kit GLBs for shipping.

   Reads the registry in first-person/js/kit_registry.js, takes each kit's
   source from the local pack dumps (first-person/assets/models/_packs/<pack>/
   glb/individual/<file>.glb — untracked, licence-restricted, downloaded with
   the threejsassets key), and writes a Draco-compressed copy to
   first-person/assets/kits/<KIT_VERSION>/<pack>/<file>.glb, which IS tracked
   and deployed.

   The packs' individual GLBs are uncompressed float meshes. A park bench is
   half a megabyte and a café terrace 1.3 MB, which is fine for eleven towers
   and not fine for a street full of furniture; Draco takes them to roughly a
   tenth. The loader already has a Draco decoder wired (first-person/lib/draco).

     node tools/fp_kits.mjs            build anything missing or stale
     node tools/fp_kits.mjs --force    rebuild everything
     node tools/fp_kits.mjs --check    exit 1 if any registered kit has no
                                       shipped file (used by test:fp:assets)

   Colours are quantised to 10 bits, not Draco's default 8: assets.js matches
   vertex colours against the packs' palettes to find the glazing, and 8-bit
   steps are close to that match tolerance on the darker glass tones.
   ══════════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { KITS, KIT_VERSION } from '../first-person/js/kit_registry.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PACKS = path.join(ROOT, 'first-person/assets/models/_packs');
const OUT = path.join(ROOT, 'first-person/assets/kits', KIT_VERSION);

const args = new Set(process.argv.slice(2));
const force = args.has('--force');
const checkOnly = args.has('--check');

function srcPath(src) {
    const [pack, file] = src.split('/');
    return path.join(PACKS, pack, 'glb/individual', file);
}
function outPath(src) {
    return path.join(OUT, src);
}

const ids = Object.keys(KITS);

if (checkOnly) {
    const missing = ids.filter((id) => !fs.existsSync(outPath(KITS[id].src)));
    for (const id of missing) console.log('missing shipped kit:', id, '→', KITS[id].src);
    console.log(missing.length ? `FAILED ${missing.length} missing` : `ALL ${ids.length} kits shipped`);
    process.exit(missing.length ? 1 : 0);
}

const { NodeIO } = await import('@gltf-transform/core');
const { KHRDracoMeshCompression, ALL_EXTENSIONS } = await import('@gltf-transform/extensions');
const { dedup, prune, draco } = await import('@gltf-transform/functions');
const draco3d = (await import('draco3dgltf')).default;

const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
        'draco3d.decoder': await draco3d.createDecoderModule(),
        'draco3d.encoder': await draco3d.createEncoderModule()
    });

let built = 0, skipped = 0, failed = 0, inBytes = 0, outBytes = 0;
const seen = new Set();
for (const id of ids) {
    const { src } = KITS[id];
    if (seen.has(src)) continue;          // two ids may share one file
    seen.add(src);
    const from = srcPath(src);
    const to = outPath(src);
    if (!fs.existsSync(from)) {
        if (fs.existsSync(to)) { skipped++; continue; }   // shipped, pack not on this machine
        console.warn('✗ source missing:', src);
        failed++;
        continue;
    }
    const inSize = fs.statSync(from).size;
    if (!force && fs.existsSync(to) && fs.statSync(to).mtimeMs >= fs.statSync(from).mtimeMs) {
        skipped++;
        inBytes += inSize; outBytes += fs.statSync(to).size;
        continue;
    }
    try {
        const doc = await io.read(from);
        await doc.transform(
            dedup(),
            prune(),
            draco({
                method: 'edgebreaker',
                encodeSpeed: 5,
                decodeSpeed: 5,
                quantizePosition: 14,
                quantizeNormal: 10,
                quantizeColor: 10,
                quantizeTexcoord: 12
            })
        );
        doc.createExtension(KHRDracoMeshCompression).setRequired(true);
        fs.mkdirSync(path.dirname(to), { recursive: true });
        await io.write(to, doc);
        const outSize = fs.statSync(to).size;
        inBytes += inSize; outBytes += outSize;
        built++;
        console.log(`✓ ${src.padEnd(52)} ${(inSize / 1024).toFixed(0).padStart(6)} KB → ${(outSize / 1024).toFixed(0).padStart(5)} KB`);
    } catch (e) {
        failed++;
        console.warn('✗', src, e.message);
    }
}
console.log(`\n${built} built, ${skipped} up to date, ${failed} failed — ` +
    `${(inBytes / 1048576).toFixed(1)} MB → ${(outBytes / 1048576).toFixed(1)} MB`);
process.exit(failed ? 1 : 0);
