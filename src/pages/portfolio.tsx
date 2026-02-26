import '../styles/App.css'
import '../styles/pages/Portfolio.css'
import Footer from '../components/footer';

function PortfolioPage(){
    return (
        <div className="PortfolioPage">
                <div className="content">
                    <div className='bubble-container'>
                        <h3>Previous Projects</h3>
                        <ul>
                            <li>703bakehouse.com</li>
                            <li>Tidbyt Slot Machine Clock</li>
                            <li>Eggs By The Dozen</li>
                            <li>Statistics R project</li>
                        </ul>
                    </div>
                    <div className='bubble-container'>
                        <h3>Current Projects</h3>
                        <ul>
                            This website!
                        </ul>
                    </div>
                    <div className='bubble-container'>
                        <h3>Future Project Ideas</h3>
                        <ul>
                            Dont have any yet
                        </ul>
                    </div>
                </div>
            <Footer />
            </div>
    );
}

export default PortfolioPage;