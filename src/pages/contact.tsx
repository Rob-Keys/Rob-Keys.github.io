import '../styles/App.css'
import '../styles/pages/Contact.css'
import Footer from '../components/footer';

function ContactPage() {
    return (
        <div className="ContactPage">
                <div className="content bubble-container">
                    <h2>Contact info</h2>
                    <h3>Work contact info</h3>
                    <ul>
                        <li><a href="mailto:rob_keys@outlook.com">rob_keys@outlook.com</a></li>
                        <li><a href="../../public/assets/files/Rob_Keys_Resume.pdf" target="_blank">Resume</a></li>
                        <li><a href="../../public/assets/files/Rob_Keys_Transcript.pdf" target="_blank">Transcript</a></li>
                    </ul>
                    <h3>Stay in Touch</h3>
                    <ul>
                        <li><a href="mailto:rob_keys@outlook.com">Send Me An Email</a></li>
                        <li><a href="https://www.linkedin.com/in/rob-keys/" target="_blank">Connect with me on LinkedIn</a></li>
                        <li><a href="https://www.espn.com/college-football/player/_/id/5150889/rob-keys" target="_blank"> My ESPN Page</a></li>
                    </ul>
                </div>
            <Footer />
            </div>
    );
}

export default ContactPage;