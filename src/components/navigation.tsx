import React, {useEffect, useState} from 'react';

import { Link, useLocation } from 'react-router-dom';

const Navigation: React.FC = () => {
    const location = useLocation();

    const getPageFromPath = (pathname: string): string => {
        switch (pathname) {
            case '/': return 'home';
            case '/experience': return 'experience';
            case '/portfolio': return 'portfolio';
            case '/game': return 'minigames';
            case '/contact': return 'contact';
            default: return 'home';
        }
    };

    const initialPage = getPageFromPath(location.pathname);
    const [targetPage, setTargetPage] = useState<string>(initialPage);

    const [indicatorStyle, setIndicatorStyle] = useState({});
    const [isVisible, setIsVisible] = useState(true);

    const [linkClicked, setLinkClicked] = useState(false);

    const updateIndicatorPosition = () => {
        const nextPageBoundingRect = document.getElementById(targetPage);
        if (!nextPageBoundingRect || nextPageBoundingRect.clientWidth === 0) {
            return;
        }

        setIndicatorStyle({
            width: `${nextPageBoundingRect.clientWidth * 1.5}px`,
            left: `${(-0.25) * nextPageBoundingRect.clientWidth}px`,
            top: `${0.36 * nextPageBoundingRect.clientHeight}px`,
            transform: `translateX(${nextPageBoundingRect.offsetLeft}px)`
        });        
    };

    const navigateToPage = (page: string) => {
        setLinkClicked(true);
        setTargetPage(page);
    }

    const refreshIndicatorPosition = () => {
        // Wait for fonts and layout to be fully ready before determining indicator position
        const updatePosition = () => {
            const nextPageBoundingRect = document.getElementById(targetPage);
            if (!nextPageBoundingRect || nextPageBoundingRect.clientWidth === 0) {
                return;
            }

            setIsVisible(false);
            updateIndicatorPosition();

            const ovalIndicator = document.querySelector('.oval-indicator') as HTMLElement;
            if (ovalIndicator) {
                const handleTransitionEnd = () => {
                    setIsVisible(true);
                    ovalIndicator.removeEventListener('transitionend', handleTransitionEnd);
                };
                ovalIndicator.addEventListener('transitionend', handleTransitionEnd);
            } else {
                // Fallback in case element isn't found
                setTimeout(() => setIsVisible(true), 500);
            }
        };

        // Use multiple strategies to ensure accurate positioning
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(() => {
                requestAnimationFrame(() => {
                    requestAnimationFrame(updatePosition);
                });
            });
        } else {
            // Fallback for browsers without font loading API
            setTimeout(() => {
                requestAnimationFrame(() => {
                    requestAnimationFrame(updatePosition);
                });
            }, 50);
        }
    }

    useEffect(() => {
        if (!linkClicked) {
            refreshIndicatorPosition();
        } else {
            setLinkClicked(false);
            updateIndicatorPosition();
        }
    }, [location.pathname]);

    useEffect(() => {
        window.addEventListener("resize", updateIndicatorPosition);
        return () => window.removeEventListener("resize", updateIndicatorPosition);
    }, []);


    return (
        <div className="Navigation">
            <nav>
                <div
                    className={`oval-indicator ${isVisible ? 'visible' : ''}`}
                    style={indicatorStyle}
                ></div>
                <div className="page-links">
                    <div id="home" className="page-link"><Link to="/" className="nav-link" onClick={() => navigateToPage('home')}><p>Home</p></Link></div>
                    <div id="experience" className="page-link"><Link to="/experience" className="nav-link" onClick={() => navigateToPage('experience')}><p>Experience</p></Link></div>
                    <div id="portfolio" className="page-link"><Link to="/portfolio" className="nav-link" onClick={() => navigateToPage('portfolio')}><p>Portfolio</p></Link></div>
                    <div id="minigames" className="page-link"><Link to="/game" className="nav-link" onClick={() => navigateToPage('minigames')}><p>Minigames</p></Link></div>
                    <div id="contact" className="page-link"><Link to="/contact" className="nav-link" onClick={() => navigateToPage('contact')}><p>Contact</p></Link></div>
                </div>
            </nav>
        </div>
    );
};

export default Navigation;