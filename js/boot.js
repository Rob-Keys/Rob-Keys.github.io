// Load the 3D scene on entry. The semantic portfolio remains available through
// its toggle and as the fallback if the renderer cannot start.
document.body.classList.add('js-enabled', 'visual-loading');

const button = document.getElementById('accessibility-toggle');
if (button instanceof HTMLButtonElement) {
    button.textContent = 'Open accessibility view';
    button.disabled = true;
}

void (async () => {
    try {
        // Give the browser two animation frames to paint the lightweight boot UI
        // before evaluating the Three.js scene graph and initializing WebGPU.
        // A single rAF callback runs before paint, so the nested frame creates an
        // actual rendering opportunity without adding a perceptible startup wait.
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const { startPortfolio } = await import('./core/main.js');
        await startPortfolio();
    } catch (error) {
        console.error('Could not load the 3D experience.', error);
        document.body.classList.remove('visual-loading', 'visual-open');
        document.body.classList.add('no-webgl');
        const loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = 'none';
            loading.setAttribute('aria-hidden', 'true');
        }
        document.getElementById('portfolio-content')?.setAttribute('aria-busy', 'false');
    }
})();
