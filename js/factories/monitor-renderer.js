// @ts-check
/**
 * Monitor canvas rendering
 * Handles creation and updating of the scrollable monitor content
 * Separated from interactions for clear separation of concerns
 */

/**
 * MonitorRenderer handles all canvas-based rendering for the monitor screen
 */
export class MonitorRenderer {
    constructor() {
        // Reused output canvas: every scroll tick composites into this same
        // canvas/context instead of allocating a new one (P1-5,
        // REALISM_PERF_PLAN.md).
        /** @type {HTMLCanvasElement | null} */ this.canvas = null;
        /** @type {CanvasRenderingContext2D | null} */ this.ctx = null;

        // Browser chrome and the full page content are each rendered exactly once,
        // into their own offscreen canvases -- these are plain 2D bitmaps used only
        // as drawImage sources, never uploaded to the GPU directly, so their
        // (non-power-of-two) size is unconstrained. Every scroll tick then becomes
        // two cheap raster blits into `this.canvas` instead of re-running every
        // fillText/wrapText/path call for all seven content sections.
        /** @type {HTMLCanvasElement | null} */ this.chromeCanvas = null;
        /** @type {HTMLCanvasElement | null} */ this.contentCanvas = null;
        this.chromeHeightLogical = 0;
        this.chromeHeightDevice = 0;

        this.deviceWidth = 1024;
        this.deviceHeight = 512;
        this.logicalWidth = 1280;
        this.logicalVisibleHeight = 560;
    }

    /**
     * Render chrome + full content into their offscreen canvases once. Cheap to
     * call repeatedly -- guarded by `this.canvas` -- so callers don't need to
     * track build state themselves.
     */
    _build() {
        if (this.canvas) return;

        const scaleX = this.deviceWidth / this.logicalWidth;
        const scaleY = this.deviceHeight / this.logicalVisibleHeight;

        // Scratch context used only to measure logical layout heights (canvas
        // dimensions don't constrain what 2D draw/measure calls can compute).
        const scratch = document.createElement('canvas');
        scratch.width = this.deviceWidth;
        scratch.height = this.deviceHeight;
        const scratchCtx = scratch.getContext('2d');
        if (!scratchCtx) throw new Error('Failed to get 2D context for monitor canvas');
        scratchCtx.scale(scaleX, scaleY);
        this.chromeHeightLogical = this._renderBrowserChrome(scratchCtx);

        // --- Chrome (static, rendered once) ---
        this.chromeHeightDevice = Math.ceil(this.chromeHeightLogical * scaleY);
        this.chromeCanvas = document.createElement('canvas');
        this.chromeCanvas.width = this.deviceWidth;
        this.chromeCanvas.height = this.chromeHeightDevice;
        const chromeCtx = this.chromeCanvas.getContext('2d');
        if (!chromeCtx) throw new Error('Failed to get 2D context for monitor canvas');
        chromeCtx.scale(scaleX, scaleY);
        this._renderBrowserChrome(chromeCtx);

        // --- Full page content (tall canvas, rendered once) ---
        scratchCtx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
        const contentHeightLogical = this._renderContent(scratchCtx);

        const contentHeightDevice = Math.ceil(contentHeightLogical * scaleY) + 40; // bottom margin
        this.contentCanvas = document.createElement('canvas');
        this.contentCanvas.width = this.deviceWidth;
        this.contentCanvas.height = contentHeightDevice;
        const contentCtx = this.contentCanvas.getContext('2d');
        if (!contentCtx) throw new Error('Failed to get 2D context for monitor canvas');
        contentCtx.fillStyle = '#f5f5f5';
        contentCtx.fillRect(0, 0, this.contentCanvas.width, this.contentCanvas.height);
        contentCtx.scale(scaleX, scaleY);
        this._renderContent(contentCtx);

        // --- Reused output canvas ---
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.deviceWidth;
        this.canvas.height = this.deviceHeight;
        this.ctx = this.canvas.getContext('2d');
        if (!this.ctx) throw new Error('Failed to get 2D context for monitor canvas');
    }

    /**
     * Composite the current scroll position into the reused output canvas.
     * @param {number} scrollOffset - Current scroll position (logical px)
     * @returns {HTMLCanvasElement} The rendered canvas
     */
    createMonitorCanvas(scrollOffset) {
        this._build();

        const { ctx, canvas, chromeCanvas, contentCanvas } = this;
        if (!ctx || !canvas || !chromeCanvas || !contentCanvas) {
            throw new Error('MonitorRenderer._build() did not initialize its canvases');
        }

        const scaleY = this.deviceHeight / this.logicalVisibleHeight;
        const deviceScrollOffset = scrollOffset * scaleY;
        const contentAreaHeight = this.deviceHeight - this.chromeHeightDevice;

        ctx.fillStyle = '#f5f5f5';
        ctx.fillRect(0, 0, this.deviceWidth, this.deviceHeight);

        // Static chrome, always at the top -- a raster blit, not a redraw.
        ctx.drawImage(chromeCanvas, 0, 0);

        // Visible slice of the pre-rendered content, clipped to the area below chrome.
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, this.chromeHeightDevice, this.deviceWidth, contentAreaHeight);
        ctx.clip();
        ctx.drawImage(
            contentCanvas,
            0, deviceScrollOffset, this.deviceWidth, contentAreaHeight,
            0, this.chromeHeightDevice, this.deviceWidth, contentAreaHeight
        );
        ctx.restore();

        // Scrollbar indicator redraws in logical coordinate space each tick (cheap:
        // one fillRect), matching the original layout math.
        ctx.save();
        ctx.scale(this.deviceWidth / this.logicalWidth, scaleY);
        this._renderScrollbar(ctx, scrollOffset, this.chromeHeightLogical, this.logicalVisibleHeight - this.chromeHeightLogical);
        ctx.restore();

        return canvas;
    }

    /**
     * Render a browser window chrome (traffic lights, tab, address bar)
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @returns {number} Height of the chrome, in logical pixels
     */
    _renderBrowserChrome(ctx) {
        const width = 1280;
        const titleBarHeight = 34;
        const tabBarHeight = 34;
        const addressBarHeight = 40;
        const chromeHeight = titleBarHeight + tabBarHeight + addressBarHeight;

        // Title bar
        ctx.fillStyle = '#dee1e6';
        ctx.fillRect(0, 0, width, titleBarHeight);

        // Traffic light buttons
        const lightColors = ['#ff5f57', '#febc2e', '#28c840'];
        lightColors.forEach((color, i) => {
            ctx.beginPath();
            ctx.arc(28 + i * 28, titleBarHeight / 2, 7, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
        });

        // Tab bar
        let y = titleBarHeight;
        ctx.fillStyle = '#dee1e6';
        ctx.fillRect(0, y, width, tabBarHeight);

        const tabWidth = 260;
        ctx.fillStyle = '#ffffff';
        this._roundRect(ctx, 12, y + 4, tabWidth, tabBarHeight - 4, [8, 8, 0, 0]);
        ctx.fill();

        ctx.fillStyle = '#333333';
        ctx.font = '16px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('Rob Keys — Portfolio', 34, y + tabBarHeight - 12);

        // Favicon dot
        ctx.beginPath();
        ctx.arc(24, y + tabBarHeight / 2 + 2, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#4a90d9';
        ctx.fill();

        // Address bar
        y += tabBarHeight;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, y, width, addressBarHeight);
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, y + addressBarHeight);
        ctx.lineTo(width, y + addressBarHeight);
        ctx.stroke();

        // Nav buttons (back / forward / reload)
        ctx.strokeStyle = '#5f6368';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        const navY = y + addressBarHeight / 2;
        /** @type {[string, number][]} */
        const navButtons = [['back', 30], ['forward', 66], ['reload', 102]];
        navButtons.forEach(([type, cx]) => {
            if (type === 'back' || type === 'forward') {
                const dir = type === 'back' ? -1 : 1;
                ctx.beginPath();
                ctx.moveTo(cx + dir * 5, navY - 7);
                ctx.lineTo(cx - dir * 5, navY);
                ctx.lineTo(cx + dir * 5, navY + 7);
                ctx.stroke();
            } else {
                ctx.beginPath();
                ctx.arc(cx, navY, 8, 0.3, Math.PI * 1.7);
                ctx.stroke();
            }
        });

        // URL pill
        const pillX = 130;
        const pillWidth = width - pillX - 130;
        ctx.fillStyle = '#f1f3f4';
        this._roundRect(ctx, pillX, y + 6, pillWidth, addressBarHeight - 12, 14);
        ctx.fill();

        // Lock icon
        ctx.strokeStyle = '#5f6368';
        ctx.lineWidth = 1.5;
        const lockX = pillX + 18;
        const lockY = navY;
        ctx.beginPath();
        ctx.arc(lockX, lockY - 3, 4, Math.PI, 0);
        ctx.stroke();
        ctx.fillStyle = '#5f6368';
        ctx.fillRect(lockX - 5, lockY - 3, 10, 8);

        ctx.fillStyle = '#3c4043';
        ctx.font = '16px Arial';
        ctx.fillText('robkeys.dev', lockX + 16, navY + 5);

        return chromeHeight;
    }

    /**
     * Build a rounded rectangle path; caller fills or strokes it
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} x
     * @param {number} y
     * @param {number} w
     * @param {number} h
     * @param {number|number[]} radius
     */
    _roundRect(ctx, x, y, w, h, radius) {
        const r = Array.isArray(radius) ? radius : [radius, radius, radius, radius];
        ctx.beginPath();
        ctx.moveTo(x + r[0], y);
        ctx.lineTo(x + w - r[1], y);
        ctx.arcTo(x + w, y, x + w, y + r[1], r[1]);
        ctx.lineTo(x + w, y + h - r[2]);
        ctx.arcTo(x + w, y + h, x + w - r[2], y + h, r[2]);
        ctx.lineTo(x + r[3], y + h);
        ctx.arcTo(x, y + h, x, y + h - r[3], r[3]);
        ctx.lineTo(x, y + r[0]);
        ctx.arcTo(x, y, x + r[0], y, r[0]);
        ctx.closePath();
    }

    /**
     * Render main content sections
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @returns {number} Final logical y position, used to size the content canvas
     */
    _renderContent(ctx) {
        // Header (h1 style)
        ctx.fillStyle = '#333333';
        ctx.font = 'bold 80px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('Rob Keys', 80, 80);

        // Subtitle (p style)
        ctx.font = '40px Arial';
        ctx.fillStyle = '#444444';
        ctx.fillText('Software Development Engineer @ Amazon Web Services', 80, 140);

        // About This Site section
        let currentY = 240;
        currentY = this._renderAboutSiteSection(ctx, currentY);

        // About section
        currentY += 80;
        currentY = this._renderAboutMeSection(ctx, currentY);

        // Education section
        currentY += 80;
        currentY = this._renderEducationSection(ctx, currentY);

        // Skills section
        currentY += 60;
        currentY = this._renderSkillsSection(ctx, currentY);

        // Experience section
        currentY += 60;
        currentY = this._renderExperienceSection(ctx, currentY);

        // What Drives Me section
        currentY += 60;
        currentY = this._renderMotivationSection(ctx, currentY);

        // Contact section
        currentY += 60;
        return this._renderContactSection(ctx, currentY);
    }

    /**
     * Render "About This Site" section
     */
    _renderAboutSiteSection(ctx, startY) {
        let currentY = startY;

        ctx.font = 'bold 60px Arial';
        ctx.fillStyle = '#333333';
        ctx.fillText('About This Site', 80, currentY);

        currentY += 50;
        ctx.font = '32px Arial';
        ctx.fillStyle = '#444444';
        currentY = this._wrapText(ctx, 'This interactive 3D portfolio features a scrollable main monitor (use your mouse wheel!) and various interactive objects on the desk.', 80, currentY, 1120, 40);

        currentY += 50;
        ctx.fillStyle = '#333333';
        ctx.fillText('Clickable objects include:', 80, currentY);

        currentY += 50;
        const clickables = [
            'Monitor (Overview)',
            'Laptop (Projects)',
            'Notebook (Current Projects)',
            'Diploma (Education)'
        ];

        clickables.forEach(item => {
            ctx.beginPath();
            ctx.arc(100, currentY - 10, 6, 0, Math.PI * 2);
            ctx.fillStyle = '#333333';
            ctx.fill();
            ctx.fillText(item, 120, currentY);
            currentY += 50;
        });

        return currentY;
    }

    /**
     * Render "About Me" section
     */
    _renderAboutMeSection(ctx, startY) {
        let currentY = startY;

        ctx.font = 'bold 60px Arial';
        ctx.fillStyle = '#333333';
        ctx.fillText('About Me', 80, currentY);

        currentY += 50;
        ctx.fillStyle = '#444444';
        ctx.font = '32px Arial';
        currentY = this._wrapText(ctx, 'Hi! I\'m a Software Development Engineer at Amazon Web Services with a passion for building scalable, impactful systems. I graduated from UVA with a B.S. in Computer Science, maintaining a 4.0 GPA while completing my degree in just three years.', 80, currentY, 1120, 40);

        return currentY;
    }

    /**
     * Render "Education" section
     */
    _renderEducationSection(ctx, startY) {
        let currentY = startY;

        ctx.font = 'bold 60px Arial';
        ctx.fillStyle = '#333333';
        ctx.fillText('Education', 80, currentY);

        currentY += 60;
        ctx.font = 'bold 40px Arial';
        ctx.fillText('University of Virginia', 80, currentY);

        currentY += 50;
        ctx.font = '32px Arial';
        ctx.fillText('B.S. Computer Science', 80, currentY);

        currentY += 40;
        const eduDetails = [
            'GPA: 4.0',
            'Graduated in 3 years',
            'NCAE-Certified Cybersecurity Focal Path'
        ];

        eduDetails.forEach(item => {
            ctx.beginPath();
            ctx.arc(100, currentY - 10, 6, 0, Math.PI * 2);
            ctx.fillStyle = '#333333';
            ctx.fill();
            ctx.fillText(item, 120, currentY);
            currentY += 40;
        });

        return currentY;
    }

    /**
     * Render "Skills & Expertise" section
     */
    _renderSkillsSection(ctx, startY) {
        let currentY = startY;

        ctx.font = 'bold 60px Arial';
        ctx.fillStyle = '#333333';
        ctx.fillText('Skills & Expertise', 80, currentY);

        const skills = [
            { title: 'Cloud Architecture', description: 'Design and implementation of scalable systems using AWS services and consensus algorithms like Raft' },
            { title: 'Data Structures & Algorithms', description: 'Strong foundation in computational problem-solving with experience in optimization and complexity analysis' },
            { title: 'Cybersecurity', description: 'NCAE-certified focal path with hands-on experience building privacy protection systems' }
        ];

        skills.forEach(skill => {
            currentY += 60;
            ctx.font = 'bold 36px Arial';
            ctx.fillStyle = '#333333';
            ctx.fillText(skill.title, 80, currentY);
            currentY += 40;
            ctx.font = '32px Arial';
            ctx.fillStyle = '#444444';
            currentY = this._wrapText(ctx, skill.description, 80, currentY, 1120, 40);
        });

        return currentY;
    }

    /**
     * Render "Professional Experience" section
     */
    _renderExperienceSection(ctx, startY) {
        let currentY = startY;

        ctx.font = 'bold 60px Arial';
        ctx.fillStyle = '#333333';
        ctx.fillText('Professional Experience', 80, currentY);

        currentY += 60;
        ctx.font = 'bold 40px Arial';
        ctx.fillText('Amazon Web Services', 80, currentY);

        currentY += 50;
        ctx.font = '32px Arial';
        ctx.fillStyle = '#444444';
        ctx.fillText('Software Development Engineer | 2026 - Present', 80, currentY);
        currentY += 50;
        currentY = this._wrapText(ctx, 'Building scalable cloud infrastructure and services that power businesses worldwide.', 80, currentY, 1120, 40);

        return currentY;
    }

    /**
     * Render "What Drives Me" section
     */
    _renderMotivationSection(ctx, startY) {
        let currentY = startY;

        ctx.font = 'bold 60px Arial';
        ctx.fillStyle = '#333333';
        ctx.fillText('What Drives Me', 80, currentY);

        const motivations = [
            { title: 'Creating Meaningful Impact', description: 'Technology has the power to improve lives. I want to build software that solves real problems and makes a tangible difference.' },
            { title: 'Solving Complex Challenges', description: 'I\'m drawn to problems that require deep thinking and creative solutions. Each project teaches me something new.' },
            { title: 'Innovation & Learning', description: 'I\'m constantly exploring new technologies and methodologies to stay at the forefront of software engineering.' }
        ];

        motivations.forEach(item => {
            currentY += 60;
            ctx.font = 'bold 36px Arial';
            ctx.fillStyle = '#333333';
            ctx.fillText(item.title, 80, currentY);
            currentY += 40;
            ctx.font = '32px Arial';
            ctx.fillStyle = '#444444';
            currentY = this._wrapText(ctx, item.description, 80, currentY, 1120, 40);
        });

        return currentY;
    }

    /**
     * Render "Get In Touch" section
     */
    _renderContactSection(ctx, startY) {
        let currentY = startY;

        ctx.font = 'bold 60px Arial';
        ctx.fillStyle = '#333333';
        ctx.fillText('Get In Touch', 80, currentY);

        currentY += 60;
        ctx.font = '32px Arial';
        ctx.fillText('Email: rob_keys@outlook.com', 80, currentY);

        return currentY;
    }

    /**
     * Render scrollbar indicator within the page content area
     */
    _renderScrollbar(ctx, scrollOffset, chromeHeight, contentHeight) {
        const logicalWidth = 1280;
        const scrollBarHeight = 50;
        const maxScroll = 2000;
        const scrollBarY = chromeHeight + (scrollOffset / maxScroll) * (contentHeight - scrollBarHeight);

        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.fillRect(logicalWidth - 10, scrollBarY, 8, scrollBarHeight);
    }

    /**
     * Helper to wrap text within a maximum width
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {string} text - Text to wrap
     * @param {number} x - Starting x position
     * @param {number} y - Starting y position
     * @param {number} maxWidth - Maximum line width
     * @param {number} lineHeight - Height between lines
     * @returns {number} Final y position after text
     */
    _wrapText(ctx, text, x, y, maxWidth, lineHeight) {
        const words = text.split(' ');
        let line = '';
        let currentY = y;

        for (let i = 0; i < words.length; i++) {
            const testLine = line + words[i] + ' ';
            const metrics = ctx.measureText(testLine);
            const testWidth = metrics.width;

            if (testWidth > maxWidth && i > 0) {
                ctx.fillText(line, x, currentY);
                line = words[i] + ' ';
                currentY += lineHeight;
            } else {
                line = testLine;
            }
        }
        ctx.fillText(line, x, currentY);
        return currentY + lineHeight;
    }
}
