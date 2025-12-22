import '../styles/App.css'
import '../styles/pages/Home.css'
import Theme from '../components/theme.tsx'
import Footer from '../components/footer';
import { useState } from 'react'

function HomePage() {
    const [expandedBringItem, setExpandedBringItem] = useState<number | null>(0)
    const [isQuickHovered, setIsQuickHovered] = useState(false)

    const toggleBringItem = (index: number) => {
        setExpandedBringItem(expandedBringItem === index ? null : index)
    }

    return (
        <div className="HomePage">
            <div className="grid-2x2">          
                <div className="intro bubble-container fade-in-right">
                    <h1 className="name">Rob Keys</h1>
                    <h5 className="subtitle">Engineer • Software Developer</h5>
                </div>

                <div 
                    className="quick bubble-container fade-in-left"
                    onMouseEnter={() => setIsQuickHovered(true)}
                    onMouseLeave={() => setIsQuickHovered(false)}
                >
                    <h3>TL;DR</h3>
                    <ul>
                        <li><p>Currently: SDE with Amazon Web Services</p></li>
                        <li><p>B.S. in Computer Science from the University of Virginia</p>
                        <ul>
                            <li>GPA: 4.0</li>
                            <li>Graduated in three years</li>
                            <li><a href="https://cyberinnovation.virginia.edu/department-computer-science-cybersecurity-focal-path">NCAE-Ceritfied</a> focal path in Cybersecurity</li>
                        </ul></li>
                        <li><p>Well-rounded software engineer with strong communication and problem-solving skills.</p></li>
                    </ul>
                    <div className={`resume-button ${isQuickHovered ? 'visible' : ''}`}>
                        <a href="/assets/files/Rob_Keys_Resume.pdf" target="_blank" className="card-action bubble-container dark">View Resume →</a>
                        <a href="/assets/files/Rob_Keys_Transcript.pdf" target="_blank" className="card-action bubble-container dark">View Transcript →</a>
                    </div>
                </div>

                <div className="skills bubble-container fade-in-right">
                    <h3>My Skills</h3>
                    <p><strong>Cloud Architecture</strong>: Design and implementation of scalable systems using AWS services and consensus algorithms like Raft </p>
                    <p><strong>Data Structures & Algorithms</strong>: Strong foundation in computational problem-solving with experience in optimization and complexity analysis</p>
                    <p><strong>Cybersecurity</strong>: NCAE-certified focal path with hands-on experience building privacy protection systems using contextual integrity frameworks</p>
                    <p><strong>Communication & Teamwork</strong>: Proven ability to collaborate effectively and lead in high-pressure environments through athletics and group projects</p>
                    <p><strong>Problem Solving</strong>: Critical thinking and systematic approach to debugging complex systems and architectural challenges</p>
                </div>

                <Theme />
            </div>
            <div className="passions bubble-container fade-in-up">
                <h3>What Drives Me</h3>
                <div className="expandable-bars">
                    <div className={`expandable-bar ${expandedBringItem === 0 ? 'expanded' : ''}`}>
                        <div className="bar-header" onClick={() => toggleBringItem(0)}>
                            <span className="bar-icon">💫</span>
                            <h4>Creating Meaningful Impact</h4>
                            <span className="expand-arrow">{expandedBringItem === 0 ? '−' : '+'}</span>
                        </div>
                        <div className="bar-content">
                            <p>Technology has the power to improve lives, and that's what motivates me to code. I want to build software that solves real problems and makes a tangible difference—whether that's streamlining business operations, enabling better communication, or creating tools that empower users. The most rewarding projects are the ones where I can see the direct positive impact on people's daily experiences.</p>
                        </div>
                    </div>
                    <div className={`expandable-bar ${expandedBringItem === 1 ? 'expanded' : ''}`}>
                        <div className="bar-header" onClick={() => toggleBringItem(1)}>
                            <span className="bar-icon">🎯</span>
                            <h4>Solving Complex Challenges</h4>
                            <span className="expand-arrow">{expandedBringItem === 1 ? '−' : '+'}</span>
                        </div>
                        <div className="bar-content">
                            <p>I'm drawn to problems that require deep thinking and creative solutions. Whether I'm implementing consensus algorithms in distributed systems or optimizing database performance, I find genuine excitement in the process of breaking down complex challenges and building robust solutions. Each project teaches me something new and pushes me to grow as an engineer.</p>
                        </div>
                    </div>
                    <div className={`expandable-bar ${expandedBringItem === 2 ? 'expanded' : ''}`}>
                        <div className="bar-header" onClick={() => toggleBringItem(2)}>
                            <span className="bar-icon">🌐</span>
                            <h4>Championing Inclusive Technology</h4>
                            <span className="expand-arrow">{expandedBringItem === 2 ? '−' : '+'}</span>
                        </div>
                       <div className="bar-content">
                            <p>I believe software should work for everyone. I'm committed to building accessible, responsive applications that serve diverse users regardless of their technical background or device. From ensuring mobile compatibility to designing intuitive interfaces, I approach every project with the mindset that good design considers all users, not just the majority.</p>
                        </div>
                    </div>
                    <div className={`expandable-bar ${expandedBringItem === 3 ? 'expanded' : ''}`}>
                        <div className="bar-header" onClick={() => toggleBringItem(3)}>
                            <span className="bar-icon">⚡</span>
                            <h4>Innovating User Experiences</h4>
                            <span className="expand-arrow">{expandedBringItem === 3 ? '−' : '+'}</span>
                        </div>
                        <div className="bar-content">
                            <p>I'm passionate about making software more convenient and intuitive. Great user experience means reducing friction, anticipating needs, and leveraging modern technologies to create seamless interactions. Whether I'm integrating payment systems, applying AI to automate workflows, or refining an interface, my goal is always to deliver solutions that feel natural and efficient to use.</p>
                        </div>
                    </div>
                </div>
            </div>
            <Footer />
        </div>
    );
}

export default HomePage;