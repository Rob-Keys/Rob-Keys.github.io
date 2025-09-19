import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

type PageKey = 'home' | 'experience' | 'portfolio' | 'minigames' | 'contact';

const pageOrder: PageKey[] = ['home','experience','portfolio','minigames','contact'];

const getPageKeyFromPath = (pathname: string): PageKey => {
  switch (pathname) {
    case '/': return 'home';
    case '/experience': return 'experience';
    case '/portfolio': return 'portfolio';
    case '/game': return 'minigames';
    case '/contact': return 'contact';
    default: return 'home';
  }
}

interface PageTrackProps {
  children: React.ReactNode[]; // expect the pages in the same order as pageOrder
}

const PageTrack: React.FC<PageTrackProps> = ({ children }) => {
  const location = useLocation();
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [currentIndex, setCurrentIndex] = useState(() => pageOrder.indexOf(getPageKeyFromPath(location.pathname)));
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const nextKey = getPageKeyFromPath(location.pathname);
    const nextIndex = pageOrder.indexOf(nextKey);
    if (nextIndex === currentIndex) return;

    // Trigger CSS animation by updating index; CSS handles the translate
    setIsAnimating(true);
    setCurrentIndex(nextIndex);
    const handle = setTimeout(() => setIsAnimating(false), 600); // slightly larger than CSS duration
    return () => clearTimeout(handle);
  }, [location.pathname]);

  return (
    <div className="page-track-viewport">
      <div
        ref={trackRef}
        className={`page-track ${isAnimating ? 'animating' : ''}`}
        // use viewport units so translate shifts by full pages regardless of track width
        style={{ transform: `translateX(${ -currentIndex * 100 }vw)` }}
      >
        {React.Children.map(children, (child, i) => (
          <div className="page-track-item" data-index={i}>{child}</div>
        ))}
      </div>
    </div>
  );
}

export default PageTrack;
