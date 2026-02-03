import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    // Scroll to top of the window on route change immediately
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'auto'
    });
    
    // Also scroll the main content container if necessary
    document.documentElement.scrollTo({
      top: 0,
      left: 0,
      behavior: 'auto'
    });
    
    document.body.scrollTo({
      top: 0,
      left: 0,
      behavior: 'auto'
    });
  }, [pathname]);

  return null;
};

export default ScrollToTop;
