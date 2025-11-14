import '../styles/App.css'
import '../styles/pages/Experience.css'
import Footer from '../components/footer';

function ExperiencePage() {
    return (
        <div className="ExperiencePage">
            <div className="content">
                <div className="dual-columns">
                    <div className="bubble-container">
                        <h3>Coursework</h3>
                        <h5>University of Virginia - B.S. Computer Science</h5>
                        <p>My coursework at UVA has provided a comprehensive foundation in computer science theory and practice:</p>
                        
                        <ul>
                            <li><strong>Core CS:</strong> Data Structures and Algorithms (CS 2100, 3100), Discrete Math and Theory (CS 2120, 3120), Computer Systems and Organization (CS 2130, 3130)</li>
                            <li><strong>Software Engineering:</strong> Software Development Essentials (CS 3140), Software Engineering (CS 3240), Programming Languages for Web Applications (CS 4640)</li>
                            <li><strong>Systems:</strong> Database Systems (CS 4750), Cloud Computing (CS 4740), Computer Networks (CS 4457)</li>
                            <li><strong>Security:</strong> Intro to Cybersecurity (CS 3710), Network Security (CS 4760), Defense Against the Dark Arts (CS 4630)</li>
                            <li><strong>AI/ML:</strong> Artificial Intelligence (CS 4710), Machine Learning (CS 4774)</li>
                            <li><strong>Mathematics:</strong> Multivariable Calculus (APMA 2120), Differential Equations (APMA 2130), Probability (APMA 3100), Linear Algebra (APMA 3150)</li>
                        </ul>
                    </div>
                    <div className="bubble-container">
                        <h3>Amazon Web Services - Software Development Engineer Intern</h3>
                        <h5>Summer 2025 | Seattle, WA</h5>
                        <p>Completed a 12-week internship as an SDE1 intern at AWS, working on [specific team/project - you can fill this in with actual details]. This experience provided hands-on exposure to large-scale distributed systems, cloud infrastructure, and professional software development practices in a fast-paced environment.</p>
                        <p><strong>I have accepted a full-time position as a Software Development Engineer at AWS starting in June 2026.</strong></p>
                    </div>
                </div>
                <div className='bubble-container'>
                    <h3>AWS</h3>
                </div>
            </div>
            <Footer />
        </div>
    );
}
export default ExperiencePage;