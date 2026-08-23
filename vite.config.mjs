import { cpSync, existsSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));

function copyRuntimeFiles() {
    return {
        name: 'copy-runtime-files',
        apply: 'build',
        writeBundle(_options, output) {
            const outputDir = resolve(projectRoot, output.dir || 'dist');
            for (const relativePath of ['assets', 'favicon.ico', 'lost.html', '_headers']) {
                const source = resolve(projectRoot, relativePath);
                if (!existsSync(source)) continue;
                cpSync(source, resolve(outputDir, relativePath), { recursive: true });
            }

            // The runtime loaders intentionally use stable /assets/... paths.
            // Vite rewrites source HTML preloads to hashed copies, which would
            // preload a different URL than the loaders request. Restore the
            // stable URLs and remove those duplicate hashed files.
            const indexPath = resolve(outputDir, 'index.html');
            let indexHtml = readFileSync(indexPath, 'utf8');
            indexHtml = indexHtml.replace(
                /\s*<link rel="preload" href="\/assets\/(?:env-[^"]+\.hdr|floor_nor-[^"]+\.webp|floor_rough-[^"]+\.webp)"[^>]*>/g,
                ''
            );
            const stablePreloads = [
                '    <link rel="preload" href="/assets/textures/env.hdr" as="fetch" crossorigin>',
                '    <link rel="preload" href="/assets/textures/floor_nor.webp" as="image">',
                '    <link rel="preload" href="/assets/textures/floor_rough.webp" as="image">'
            ].join('\n');
            indexHtml = indexHtml.replace('</head>', `${stablePreloads}\n</head>`);
            writeFileSync(indexPath, indexHtml);

            const outputAssetsDir = resolve(outputDir, 'assets');
            for (const fileName of readdirSync(outputAssetsDir)) {
                if (/^(?:env|floor_nor|floor_rough)-.+\.(?:hdr|webp)$/.test(fileName)) {
                    unlinkSync(resolve(outputAssetsDir, fileName));
                }
            }
        }
    };
}

export default defineConfig({
    base: '/',
    publicDir: false,
    plugins: [copyRuntimeFiles()],
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        sourcemap: false,
        rollupOptions: {
            output: {
                entryFileNames: 'assets/[name]-[hash].js',
                chunkFileNames: 'assets/[name]-[hash].js',
                assetFileNames: 'assets/[name]-[hash][extname]'
            }
        }
    }
});
