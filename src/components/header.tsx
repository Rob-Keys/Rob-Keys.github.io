import Navigation from './navigation.tsx'
import Theme from './theme.tsx'
import '../styles/components/Header.css'
import Logo from '../assets/little_icon.png'

function Header(){
    return (
        <div className="Header">
            <ul>
                <li>
                    <Theme/>
                </li>
                <li>
                    <Navigation/>
                </li>
                <li>
                    <img id="Logo" src={Logo} alt="Personal Logo"/>
                </li>
            </ul>
        </div>
    );
}

export default Header;