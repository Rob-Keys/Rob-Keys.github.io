import React, { useEffect, useState } from 'react';
import '../styles/components/Theme.css'
import Footballpfp from '../assets/themes/footballpfp.png'
import Nature from '../assets/themes/nature.jpg'
import Pink from '../assets/themes/pink.jpg'
import Sludge from '../assets/themes/sludge.png'

const Theme: React.FC = () => {
    const [theme, setTheme] = useState<string>('light');

    // On component mount, load the saved theme from localStorage
    useEffect(() => {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            setTheme(savedTheme);
        }
    }, []);

    // Read the theme state and update the document attribute whenever it changes
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

    // Set theme and update localStorage
    const changeTheme = (newTheme: string) => {
        setTheme(newTheme);
        localStorage.setItem('theme', newTheme);
    };

    return(
        <div className="Theme">
            <p className="theme-label">Theme:</p>
            <div className="theme-btn-container">
                <img className={`theme-btn`} src={Footballpfp} alt="Rob Keys Face" onClick={() => changeTheme('sunset')}/>
                <img className="theme-btn" src={Nature} alt="Cartoon trees and flowers in a meadow" onClick={() => changeTheme('forest')}/>
                <img className="theme-btn" src={Sludge} alt="Black sludge leaking down the box" onClick={() => changeTheme('space')}/>
                <img className="theme-btn" src={Pink} alt="White princess tiara on a solid pink background" onClick={() => changeTheme('sunny')}/>
            </div>
        </div>
    );
};

export default Theme;
