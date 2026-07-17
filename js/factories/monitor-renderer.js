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
        this.canvas = null;
        this.ctx = null;
    }

    /**
     * Create canvas for monitor with scrollable content
     * @param {number} scrollOffset - Current scroll position
     * @returns {HTMLCanvasElement} The rendered canvas
     */
    createMonitorCanvas(scrollOffset) {
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Failed to get 2D context for monitor canvas');

        // Draw white background
        ctx.fillStyle = '#f5f5f5';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Scale to fit 1280x560 content into 1024x512 (Standard Power of Two texture)
        ctx.scale(1024/1280, 512/560);

        // Save context and translate for scrolling
        ctx.save();
        ctx.translate(0, -scrollOffset);

        this._renderContent(ctx);

        ctx.restore();

        // Add simple scrollbar indicator
        this._renderScrollbar(ctx, scrollOffset);

        return canvas;
    }

    /**
     * Render main content sections
     * @param {CanvasRenderingContext2D} ctx - Canvas context
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
        this._renderContactSection(ctx, currentY);
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
     * Render scrollbar indicator
     */
    _renderScrollbar(ctx, scrollOffset) {
        const logicalWidth = 1280;
        const logicalHeight = 560;
        const scrollBarHeight = 50;
        const maxScroll = 2000;
        const scrollBarY = (scrollOffset / maxScroll) * (logicalHeight - scrollBarHeight);

        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
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
