import Navigation from './navigation.tsx'
import Hamburger from './hamburger.tsx';
import '../styles/components/Header.css'

function Header(){
    return (
        <div className="Header">
            <ul>
                <li>
                </li>
                <li>
                    <Navigation/>
                </li>
                <li>
                    <Hamburger/>
                </li>
            </ul>
        </div>
    );
}

export default Header;