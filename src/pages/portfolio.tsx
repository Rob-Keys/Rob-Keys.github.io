import '../styles/App.css'
import '../styles/pages/Portfolio.css'
import Footer from '../components/footer';

function PortfolioPage(){
    return (
        <div className="PortfolioPage">
                <div className="content bubble-container">
                    <div className="Title">
                        <h1>Projects</h1>
                    </div>
                    <h2>Personal Projects</h2>
                    <h3>The personal projects I have already developed</h3>
                    <p>This Website, Eggs by the dozen computer vision AI, SIG AI club, Statistics project in R</p>
                    <h2>Current Project</h2>
                    <h3>The project I am working on right now</h3>
                    <p> This website!</p>
                </div>
            <Footer />
            </div>
    );
}

export default PortfolioPage;