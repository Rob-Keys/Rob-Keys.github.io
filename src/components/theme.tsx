import React, { useEffect, useState } from 'react';
import '../styles/components/Theme.css'
import UVA from '../../public/assets/themes/v_sabre.avif'
import Leaf from '../../public/assets/themes/leaf.avif'
import Mint from '../../public/assets/themes/blue_mint.avif'
import Ocean from '../../public/assets/themes/water.avif'

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
        <div className="Theme bubble-container fade-in-left">
            <h3 className="theme-label">Website theme:</h3>
            <div className="theme-btn-container">
                <div className="theme-pair bubble-container" id="uva" onClick={() => changeTheme('uva')}>
                    <img className="theme-btn" src={UVA} alt="The UVA V sabre logo"/>
                    <h4>UVA</h4>
                </div>
                <div className="theme-pair bubble-container" id="mint" onClick={() => changeTheme('mint')}>
                    <img className={`theme-btn`} src={Mint} alt="A clipart blue swirly mouth minth"/>
                    <h4>Mint</h4>
                </div>
                <div className="theme-pair bubble-container" id="spearmint" onClick={() => changeTheme('spearmint')}>
                    <img className="theme-btn" src={Leaf} alt="A clipart green leaf"/>
                    <h4>Spearmint</h4>
                </div>
                <div className="theme-pair bubble-container" id="ocean" onClick={() => changeTheme('ocean')}>
                    <img className="theme-btn" src={Ocean} alt="Dark and choppy ocean waters"/>
                    <h4>Ocean</h4>
                </div>
            </div>
        </div>
    );
};

export default Theme;
