import '../styles/App.css'
import '../styles/pages/Home.css'
import Theme from '../components/theme.tsx'
import Footer from '../components/footer';
import { useState } from 'react'
import { useFadeInOnScroll } from '../App'

function HomePage() {
    const [expandedDriveItem, setExpandedDriveItem] = useState<number | null>(0)
    const [expandedBringItem, setExpandedBringItem] = useState<number | null>(0)

    const toggleDriveItem = (index: number) => {
        setExpandedDriveItem(expandedDriveItem === index ? null : index)
    }

    const toggleBringItem = (index: number) => {
        setExpandedBringItem(expandedBringItem === index ? null : index)
    }

    useFadeInOnScroll();

    return (
        <div className="HomePage">
            <div className="grid-2x2">          
                <div className="intro bubble-container fade-in-right">
                    <h1 className="name">Rob Keys</h1>
                    <h5 className="subtitle">Engineer • Software Developer</h5>
                </div>

                <a href="/assets/files/Rob_Keys_Resume.pdf" className="quick bubble-container fade-in-left" target="_blank" rel="noopener noreferrer">
                    <h3>TL;DR</h3>
                    <ul>
                        <li><p>B.S. in Computer Science from the University of Virginia</p>
                        <ul>
                            <li>GPA: 4.0</li>
                            <li>Graduated in three years</li>
                            <li><a href="https://cyberinnovation.virginia.edu/department-computer-science-cybersecurity-focal-path">NCAE-Ceritfied</a> focal path in Cybersecurity</li>
                        </ul></li>
                        <li><p>3-month SDE internship with Amazon Web Services</p></li>
                        <li><p>Currently: SDE1 with Amazon Web Services</p></li>
                    </ul>
                    <div className="card-action bubble-container dark">View Resume & Transcript →</div>
                </a>

                <div className="skills bubble-container fade-in-right">
                    <h3>My Skills</h3>
                    <p>Todo</p>
                </div>

                <Theme />
            </div>

            <div className="passions bubble-container">
                <h2>What Drives Me</h2>
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