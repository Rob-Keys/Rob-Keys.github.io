// Keep the semantic portfolio usable without downloading the WebGPU/Three.js
// graph. The large visual experience is loaded only when requested.
document.body.classList.add('js-enabled');

const button = document.getElementById('accessibility-toggle');
if (button instanceof HTMLButtonElement) {
    button.textContent = 'Open 3D experience';
    const launch = async () => {
        button.disabled = true;
        button.textContent = 'Loading 3D experience';
        document.getElementById('portfolio-content')?.setAttribute('aria-busy', 'true');
        document.body.classList.add('visual-loading');
        try {
            const { startPortfolio } = await import('./core/main.js');
            button.removeEventListener('click', launch);
            await startPortfolio();
        } catch (error) {
            console.error('Could not load the 3D experience.', error);
            document.body.classList.remove('visual-loading', 'visual-open');
            document.getElementById('portfolio-content')?.setAttribute('aria-busy', 'false');
            button.disabled = false;
            button.textContent = 'Try the 3D experience again';
        }
    };
    button.addEventListener('click', launch);
}
