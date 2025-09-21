import Navigation from './navigation'
import Hamburger from './hamburger'
import '../styles/components/Header.css'

function Header(){
    return (
        <header className="Header">
            {/* Centered navigation for desktop; hamburger for mobile */}
            <div className="header-inner">
                <Navigation />
                <Hamburger />
            </div>
        </header>
    );
}

export default Header;