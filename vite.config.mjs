import { cpSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));

function copyRuntimeFiles() {
    return {
        name: 'copy-runtime-files',
        apply: 'build',
        writeBundle(outputOptions) {
            const outputDir = resolve(projectRoot, outputOptions.dir || 'dist');
            for (const relativePath of ['assets', 'favicon.ico', 'lost.html', '_headers']) {
                const source = resolve(projectRoot, relativePath);
                if (!existsSync(source)) continue;
                cpSync(source, resolve(outputDir, relativePath), { recursive: true });
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
