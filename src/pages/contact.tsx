import '../styles/App.css'
import '../styles/pages/Contact.css'

function ContactPage() {
    return (
        <div className="ContactPage">

                <div className="Title">
                    <h1>Contact Information</h1>
                </div>
                <div className="content">
                    <h2>Contact info</h2>
                    <h3>Work contact info</h3>
                    <ul>
                        <li><a href="mailto:rob_keys@outlook.com">rob_keys@outlook.com</a></li>
                        <li><a href="../assets/files/Rob_Keys_Resume.pdf" target="_blank">Resume</a></li>
                    </ul>
                    <h3>Stay in Touch</h3>
                    <ul>
                        <li><a href="mailto:rob_keys@outlook.com">Send Me An Email</a></li>
                        <li><a href="https://www.linkedin.com/in/rob-keys/" target="_blank">Connect with me on LinkedIn</a></li>
                        <li><a href="https://virginiasports.com/player/rob-keys/" target="_blank"> My Player Page</a></li>
                    </ul>
                </div>
            </div>
    );
}

export default ContactPage;