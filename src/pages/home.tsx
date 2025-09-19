import '../styles/App.css'
import '../styles/pages/Home.css'
import Theme from '../components/theme.tsx'

function HomePage() {
    return (
        <div className="HomePage">
            <div className="hero-section">
                <h1 className="hero-title">Rob Keys</h1>
                <p className="hero-subtitle">Engineer • Software Developer • Scholar-Athlete</p>
            </div>

            <Theme />

            <div className="highlights-grid">
                <a href="/resume" className="highlight-card" target="_blank" rel="noopener noreferrer">
                    <div className="highlight-icon">🎓</div>
                    <h3>Academic Excellence</h3>
                    <p>Maintaining a <strong>4.0 GPA</strong> in Computer Science at UVA while balancing demanding coursework with athletic commitments</p>
                    <div className="card-action">View Resume & Transcript →</div>
                </a>

                <a href="https://virginiasports.com/sports/football/roster/season/2025-26/player/rob-keys/" className="highlight-card" target="_blank" rel="noopener noreferrer">
                    <div className="highlight-icon">⚡</div>
                    <h3>Athletic Leadership</h3>
                    <p><strong>Linebacker</strong> for UVA Football, demonstrating teamwork, resilience, and performance under pressure in Division I athletics</p>
                    <div className="card-action">View Team Info →</div>
                </a>

                <a href="https://github.com/Rob-Keys" className="highlight-card" target="_blank" rel="noopener noreferrer">
                    <div className="highlight-icon">💻</div>
                    <h3>Technical Innovation</h3>
                    <p>Full-stack developer with active <strong>GitHub projects</strong>, focused on creating accessible and impactful software solutions</p>
                    <div className="card-action">View GitHub →</div>
                </a>
            </div>

            <div className="focus-areas">
                <h2>What Drives Me</h2>
                <div className="focus-grid">
                    <div className="focus-item">
                        <div className="focus-icon">🌍</div>
                        <h4>Social Impact</h4>
                        <p>Building technology that addresses real-world problems and makes life easier for everyone</p>
                    </div>
                    <div className="focus-item">
                        <div className="focus-icon">♿</div>
                        <h4>Accessibility Focus</h4>
                        <p>Ensuring my projects are inclusive and usable by people of all abilities and backgrounds</p>
                    </div>
                    <div className="focus-item">
                        <div className="focus-icon">🤖</div>
                        <h4>AI Integration</h4>
                        <p>Leveraging artificial intelligence to create more efficient workflows and innovative solutions</p>
                    </div>
                    <div className="focus-item">
                        <div className="focus-icon">📂</div>
                        <h4>Open Source</h4>
                        <p>Active on GitHub with side projects that showcase my technical skills and collaborative approach</p>
                    </div>
                </div>
            </div>

            <div className="value-proposition">
                <h2>What I Bring</h2>
                <div className="skills-list">
                    <div className="skill-item">
                        <span className="skill-label">Technical Excellence</span>
                        <span className="skill-description">Strong foundation in computer science with hands-on full-stack development experience</span>
                    </div>
                    <div className="skill-item">
                        <span className="skill-label">Leadership & Teamwork</span>
                        <span className="skill-description">Proven ability to perform in high-pressure environments and work cohesively toward shared goals</span>
                    </div>
                    <div className="skill-item">
                        <span className="skill-label">Social Responsibility</span>
                        <span className="skill-description">Deep consideration for the societal impact of technology and commitment to inclusive design</span>
                    </div>
                    <div className="skill-item">
                        <span className="skill-label">Innovation Mindset</span>
                        <span className="skill-description">Continuously exploring new technologies like AI to solve problems more effectively</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default HomePage;