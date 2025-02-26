import { Routes, Route } from 'react-router-dom';
import Home from './pages/home.tsx'
import Experience from './pages/experience.tsx';
import Portfolio from './pages/portfolio.tsx'
import Game from './pages/game.tsx';
import Contact from './pages/contact.tsx';
import Header from './components/header';
import Footer from './components/footer';
import './styles/App.css'

function App() {
  return (
    <div className="Gradient">
        <Header />
        <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/experience" element={<Experience />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/game" element={<Game />} />
            <Route path="/contact" element={<Contact />} />
        </Routes>
        <Footer />
    </div>
  )
}

export default App
