import React, {useEffect, useState} from 'react';

import { Link } from 'react-router-dom';
import '../styles/components/Navigation.css'

const Navigation: React.FC = () => {
    const [currentPage, setCurrentPage] = useState<string>('home');
    const [nextPage, setNextPage] = useState<string>('home');

    const changeNextPage = (newPage: string) => {
        setNextPage(newPage);
    }

    const [indicatorStyle, setIndicatorStyle] = useState({});

    const updateIndicatorPosition = () => {
        setTimeout(() => {
            const currentRect = document.getElementById(currentPage);
            if(!currentRect) { return;}
            const nextRect = document.getElementById(nextPage);
            if(!nextRect) { return;}
            const newWidth = "" + nextRect.clientWidth *1.5;
            setIndicatorStyle({
                width: `${newWidth}px`,
                left: `${(-0.25)*nextRect.clientWidth}px`,
                top: `${0.75*nextRect.clientHeight}px`,
                transform: `translateX(${nextRect.offsetLeft}px)`
            });
            setCurrentPage(nextPage);
        }, 0);
    };
    useEffect(() => {
        updateIndicatorPosition();
    }, [nextPage]);
    useEffect(() => {
        const handleResize = () => updateIndicatorPosition();

        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);


    return (
        <div className="Navigation">
            <nav>
                <div className="oval-indicator" style={indicatorStyle}></div>
                <ul className="page-links">
                    <li id="home"><Link to="/" className="nav-link" onClick={() => changeNextPage('home')}>Home</Link></li>
                    <li id="experience"><Link to="/experience" className="nav-link" onClick={() => changeNextPage('experience')}>Experience</Link></li>
                    <li id="portfolio"><Link to="/portfolio" className="nav-link" onClick={() => changeNextPage('portfolio')}>Portfolio</Link></li>
                    <li id="minigames"><Link to="/game" className="nav-link" onClick={() => changeNextPage('minigames')}>Minigames</Link></li>
                    <li id="contact"><Link to="/contact" className="nav-link" onClick={() => changeNextPage('contact')}>Contact</Link></li>
                </ul>
            </nav>
        </div>
    );
};

export default Navigation;