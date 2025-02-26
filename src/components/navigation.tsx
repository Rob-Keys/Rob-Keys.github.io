import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/Navigation.css'

const Navigation: React.FC = () => {
    return (
        <div className="Navigation">
            <nav>
                <div className="oval-selector"></div>
                <ul className="page-links">
                    <li><Link to="/" className="nav-link">Home</Link></li>
                    <li><Link to="/experience" className="nav-link">Experience</Link></li>
                    <li><Link to="/portfolio" className="nav-link">Portfolio</Link></li>
                    <li><Link to="/game" className="nav-link">Minigames</Link></li>
                    <li><Link to="/contact" className="nav-link">Contact</Link></li>
                </ul>
            </nav>
        </div>
    );
};

export default Navigation;