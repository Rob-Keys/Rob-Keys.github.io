import { Link } from 'react-router-dom';
import React, { useState } from 'react';

const Logo_Hamburger: React.FC = () => {
    const [arePageLinksVisible, setPageLinksVisible] = useState<boolean>(false)

    return(
        <div className="Logo_Hamburger">
            <h3 className="hamburger" onClick={() => setPageLinksVisible(prev => !prev)}>|||</h3>
            {arePageLinksVisible && (
                <div className="mobile-menu">
                    <div className="page-links">
                        <div id="home"><Link to="/" className="nav-link">Home</Link></div>
                        <div id="experience"><Link to="/experience" className="nav-link">Experience</Link></div>
                        <div id="portfolio"><Link to="/portfolio" className="nav-link">Portfolio</Link></div>
                        <div id="minigames"><Link to="/game" className="nav-link">Minigames</Link></div>
                        <div id="contact"><Link to="/contact" className="nav-link">Contact</Link></div>
                    </div>
                    <div className="oval-backgrounds">
                        <div className="oval-background" id="oval-home"></div>
                        <div className="oval-background" id="oval-experience"></div>
                        <div className="oval-background" id="oval-portfolio"></div>
                        <div className="oval-background" id="oval-minigames"></div>
                        <div className="oval-background" id="oval-contact"></div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Logo_Hamburger;