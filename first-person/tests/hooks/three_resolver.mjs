/* ============================================================================
   Node resolve hook — makes the bare 'three' specifiers in js/ load under Node.

   The browser resolves `import … from 'three'` via the importmap in index.html.
   Node can't read an importmap, and package.json's `imports` field is NOT a
   substitute: Node requires every `imports` key to start with '#', so the
   `"three": "./lib/three.module.js"` entry there is silently ignored and any
   test that reaches an app module dies with ERR_MODULE_NOT_FOUND.

   Rather than rewrite 47 import sites to '#three' (which would make the shipped
   sources weirder to read for the sake of the tests), map the same two
   specifiers the importmap declares. Keep this table and the importmap in sync.

   Usage: node --import ./tests/hooks/three_resolver.mjs tests/<file>.mjs
   ============================================================================ */
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const LIB = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'lib');

// Mirrors the "imports" block of the importmap in index.html.
const MAP = {
    'three': pathToFileURL(join(LIB, 'three.module.js')).href,
    'three/addons/utils/BufferGeometryUtils.js':
        pathToFileURL(join(LIB, 'BufferGeometryUtils.js')).href
};

if (typeof registerHooks !== 'function') {
    throw new Error(
        'tests need Node >= 22.15 for module.registerHooks() — found ' + process.version
    );
}

registerHooks({
    resolve(specifier, context, nextResolve) {
        const hit = MAP[specifier];
        if (hit) return { url: hit, format: 'module', shortCircuit: true };
        return nextResolve(specifier, context);
    }
});
