import Header from './components/header';
import Home from './pages/home.tsx'
import Experience from './pages/experience.tsx';
import Portfolio from './pages/portfolio.tsx'
import Game from './pages/game.tsx';
import Contact from './pages/contact.tsx';
import PageTrack from './components/PageTrack';
import './styles/App.css'
import { useEffect } from 'react';

export function useFadeInOnScroll() {
  useEffect(() => {
    const handleLoad = () => {
      const elements = document.querySelectorAll('.fade-in-up, .fade-in-right, .fade-in-left');

      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('fade-visible');
          }
        });
      }, { threshold: 0.2 });

      elements.forEach(el => observer.observe(el));
    };

    // If already loaded, run immediately
    if (document.readyState === 'complete') {
      handleLoad();
    } else {
      // Otherwise wait for load
      window.addEventListener('load', handleLoad);
    }

    return () => {
      window.removeEventListener('load', handleLoad);
    };
  }, []);
}

function App() {
  // Render all pages side-by-side inside PageTrack. The PageTrack will read the location
  // and translate the track to show the correct page. The Routes are kept for history support
  // but individual Route elements are not used to mount pages in this implementation —
  // instead we render the pages as children in the expected order so they occupy the horizontal
  // track consistently.
  return (
    <div className="Gradient">
      <Header />

      <PageTrack>
        <Home />
        <Experience />
        <Portfolio />
        <Game />
        <Contact />
      </PageTrack>
    </div>
  )
}

export default App