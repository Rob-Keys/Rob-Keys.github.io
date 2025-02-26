import Navigation from './navigation.tsx'
import Theme from './theme.tsx'
import '../styles/Header.css'

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
                    <img id="Logo" src="/src/images/little_icon.png" alt="Personal Logo"/>
                </li>
            </ul>
        </div>
    );
}

export default Header;