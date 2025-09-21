import '../styles/App.css'
import '../styles/pages/Home.css'
import Theme from '../components/theme.tsx'
import Footer from '../components/footer';
import { useState } from 'react'

function HomePage() {
    const [expandedDriveItem, setExpandedDriveItem] = useState<number | null>(0)
    const [expandedBringItem, setExpandedBringItem] = useState<number | null>(0)

    const toggleDriveItem = (index: number) => {
        setExpandedDriveItem(expandedDriveItem === index ? null : index)
    }

    const toggleBringItem = (index: number) => {
        setExpandedBringItem(expandedBringItem === index ? null : index)
    }
    return (
        <div className="HomePage">
            <div className="hero-section">
                <div className="hero-content">
                    <Theme />
                    <div className="hero-text">
                        <h1 className="hero-title">Rob Keys</h1>
                        <p className="hero-subtitle">Engineer • Software Developer • Scholar-Athlete</p>
                    </div>
                </div>
            </div>

            <div className="highlights-grid">
                <a href="/resume" className="highlight-card card" target="_blank" rel="noopener noreferrer">
                    <div className="highlight-icon">🎓</div>
                    <h3>Academic Excellence</h3>
                    <p>Maintaining a <strong>4.0 GPA</strong> in Computer Science at UVA while balancing demanding coursework with athletic commitments</p>
                    <div className="card-action">View Resume & Transcript →</div>
                </a>

                <a href="https://virginiasports.com/sports/football/roster/season/2025-26/player/rob-keys/" className="highlight-card card" target="_blank" rel="noopener noreferrer">
                    <div className="highlight-icon">⚡</div>
                    <h3>Athletic Leadership</h3>
                    <p><strong>Linebacker</strong> for UVA Football, demonstrating teamwork, resilience, and performance under pressure in Division I athletics</p>
                    <div className="card-action">View Team Info →</div>
                </a>

                <a href="https://github.com/Rob-Keys" className="highlight-card card" target="_blank" rel="noopener noreferrer">
                    <div className="highlight-icon">💻</div>
                    <h3>Technical Innovation</h3>
                    <p>Full-stack developer with active <strong>GitHub projects</strong>, focused on creating accessible and impactful software solutions</p>
                    <div className="card-action">View GitHub →</div>
                </a>
            </div>

            <div className="about-section">
                <h2>What Drives Me</h2>
                <div className="expandable-bars">
                    <div className={`expandable-bar ${expandedDriveItem === 0 ? 'expanded' : ''}`}>
                        <div className="bar-header" onClick={() => toggleDriveItem(0)}>
                            <span className="bar-icon">🌍</span>
                            <h4>Social Impact</h4>
                            <span className="expand-arrow">{expandedDriveItem === 0 ? '−' : '+'}</span>
                        </div>
                        <div className="bar-content">
                            <p>Building technology that addresses real-world problems and makes life easier for everyone</p>
                        </div>
                    </div>
                    <div className={`expandable-bar ${expandedDriveItem === 1 ? 'expanded' : ''}`}>
                        <div className="bar-header" onClick={() => toggleDriveItem(1)}>
                            <span className="bar-icon">♿</span>
                            <h4>Accessibility Focus</h4>
                            <span className="expand-arrow">{expandedDriveItem === 1 ? '−' : '+'}</span>
                        </div>
                        <div className="bar-content">
                            <p>Ensuring my projects are inclusive and usable by people of all abilities and backgrounds</p>
                        </div>
                    </div>
                    <div className={`expandable-bar ${expandedDriveItem === 2 ? 'expanded' : ''}`}>
                        <div className="bar-header" onClick={() => toggleDriveItem(2)}>
                            <span className="bar-icon">🤖</span>
                            <h4>AI Integration</h4>
                            <span className="expand-arrow">{expandedDriveItem === 2 ? '−' : '+'}</span>
                        </div>
                        <div className="bar-content">
                            <p>Leveraging artificial intelligence to create more efficient workflows and innovative solutions</p>
                        </div>
                    </div>
                    <div className={`expandable-bar ${expandedDriveItem === 3 ? 'expanded' : ''}`}>
                        <div className="bar-header" onClick={() => toggleDriveItem(3)}>
                            <span className="bar-icon">📂</span>
                            <h4>Open Source</h4>
                            <span className="expand-arrow">{expandedDriveItem === 3 ? '−' : '+'}</span>
                        </div>
                        <div className="bar-content">
                            <p>Active on GitHub with side projects that showcase my technical skills and collaborative approach</p>
                        </div>
                    </div>
                </div>

                <h2>What I Bring</h2>
                <div className="expandable-bars">
                    <div className={`expandable-bar ${expandedBringItem === 0 ? 'expanded' : ''}`}>
                        <div className="bar-header" onClick={() => toggleBringItem(0)}>
                            <span className="bar-icon">💡</span>
                            <h4>Technical Excellence</h4>
                            <span className="expand-arrow">{expandedBringItem === 0 ? '−' : '+'}</span>
                        </div>
                        <div className="bar-content">
                            <p>Strong foundation in computer science with hands-on full-stack development experience</p>
                        </div>
                    </div>
                    <div className={`expandable-bar ${expandedBringItem === 1 ? 'expanded' : ''}`}>
                        <div className="bar-header" onClick={() => toggleBringItem(1)}>
                            <span className="bar-icon">🤝</span>
                            <h4>Leadership & Teamwork</h4>
                            <span className="expand-arrow">{expandedBringItem === 1 ? '−' : '+'}</span>
                        </div>
                        <div className="bar-content">
                            <p>Proven ability to perform in high-pressure environments and work cohesively toward shared goals</p>
                        </div>
                    </div>
                    <div className={`expandable-bar ${expandedBringItem === 2 ? 'expanded' : ''}`}>
                        <div className="bar-header" onClick={() => toggleBringItem(2)}>
                            <span className="bar-icon">🌱</span>
                            <h4>Social Responsibility</h4>
                            <span className="expand-arrow">{expandedBringItem === 2 ? '−' : '+'}</span>
                        </div>
                        <div className="bar-content">
                            <p>Deep consideration for the societal impact of technology and commitment to inclusive design</p>
                        </div>
                    </div>
                    <div className={`expandable-bar ${expandedBringItem === 3 ? 'expanded' : ''}`}>
                        <div className="bar-header" onClick={() => toggleBringItem(3)}>
                            <span className="bar-icon">🚀</span>
                            <h4>Innovation Mindset</h4>
                            <span className="expand-arrow">{expandedBringItem === 3 ? '−' : '+'}</span>
                        </div>
                        <div className="bar-content">
                            <p>Continuously exploring new technologies like AI to solve problems more effectively</p>
                        </div>
                    </div>
                </div>
            </div>
            <Footer />
        </div>
    );
}

export default HomePage;