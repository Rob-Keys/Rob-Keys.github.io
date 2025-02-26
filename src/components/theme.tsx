import React, { useEffect, useState } from 'react';
import '../styles/Theme.css'

const Theme: React.FC = () => {
    // State to store the current theme
    const [theme, setTheme] = useState<string>('light');
    const [isMenuVisible, setMenuVisible] = useState<boolean>(false);

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

    // Toggle the theme menu visibility
    const toggleMenu = () => {
        setMenuVisible(prev => !prev);
    };

    return (
        <div className="Theme">
            <div id="theme-controls">
                <button id="themeToggle" onClick={toggleMenu}>
                    {isMenuVisible ? 'Themes ▲' : 'Themes ▼'}
                </button>
                {isMenuVisible &&
                    <div id="themeContainer">
                        <img className="theme-btn" src="/src/images/themes/footballpfp.png" alt="Rob Keys Face"
                             onClick={() => changeTheme('sunset')}/>
                        <img className="theme-btn" src="/src/images/themes/nature.jpg"
                             alt="Cartoon trees and flowers in a meadow" onClick={() => changeTheme('forest')}/>
                        <img className="theme-btn" src="/src/images/themes/sludge.png"
                             alt="Black sludge leaking down the box" onClick={() => changeTheme('space')}/>
                        <img className="theme-btn" src="/src/images/themes/pink.jpg"
                             alt="White princess tiara on a solid pink background"
                             onClick={() => changeTheme('sunny')}/>
                    </div>
                }
            </div>
        </div>
    );
};

export default Theme;
