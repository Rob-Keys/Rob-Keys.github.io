import '../styles/components/Hamburger.css'
import { Link } from 'react-router-dom';
import React, { useState } from 'react';

const Logo_Hamburger: React.FC = () => {
    const [arePageLinksVisible, setPageLinksVisible] = useState<boolean>(false)

    return(
        <div className="Logo_Hamburger">
            <h3 className="hamburger" onClick={() => setPageLinksVisible(prev => !prev)}>|||</h3>
            {arePageLinksVisible && (
                <div>
                    <ul className="page-links">
                        <li id="home"><Link to="/" className="nav-link">Home</Link></li>
                        <li id="experience"><Link to="/experience" className="nav-link">Experience</Link></li>
                        <li id="portfolio"><Link to="/portfolio" className="nav-link">Portfolio</Link></li>
                        <li id="minigames"><Link to="/game" className="nav-link">Minigames</Link></li>
                        <li id="contact"><Link to="/contact" className="nav-link">Contact</Link></li>
                    </ul>
                    <ul className="oval-backgrounds">
                        <div className="oval-background" id="oval-home"></div>
                        <div className="oval-background" id="oval-experience"></div>
                        <div className="oval-background" id="oval-portfolio"></div>
                        <div className="oval-background" id="oval-minigames"></div>
                        <div className="oval-background" id="oval-contact"></div>
                    </ul>
                </div>
            )}
        </div>
    );
};

export default Logo_Hamburger;