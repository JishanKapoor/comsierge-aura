import { useEffect, useState, useRef } from "react";
import { useLocation } from "react-router-dom";

const ElectricGlow = () => {
  const location = useLocation();
  const [scrollY, setScrollY] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const rafRef = useRef<number>();

  // Hide on dashboard pages
  const isDashboard = location.pathname.startsWith("/dashboard") || location.pathname.startsWith("/admin") || location.pathname.startsWith("/select-number");

  useEffect(() => {
    setViewportHeight(window.innerHeight);

    const handleScroll = () => {
      if (rafRef.current) return;
      
      rafRef.current = requestAnimationFrame(() => {
        setScrollY(window.scrollY);
        rafRef.current = undefined;
      });
    };

    const handleResize = () => {
      setViewportHeight(window.innerHeight);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleResize, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Calculate glow position based on scroll
  const maxScroll = document.documentElement.scrollHeight - viewportHeight;
  const scrollProgress = maxScroll > 0 ? scrollY / maxScroll : 0;
  
  // Left glow moves down, right glow moves up
  const leftGlowOffset = scrollProgress * 50 - 25;
  const rightGlowOffset = -scrollProgress * 50 + 25;
  
  // Reduced intensity - more subtle
  const glowIntensity = 0.12 + Math.sin(scrollProgress * Math.PI * 2) * 0.05;

  // Don't render glow effects on dashboard pages
  if (isDashboard) {
    return null;
  }

  return (
    <>
      {/* Left edge line */}
      <div className="fixed left-0 top-0 bottom-0 w-[1px] z-40 pointer-events-none hidden sm:block">
        <div 
          className="absolute inset-x-0 h-[200%] transition-transform duration-150 ease-out"
          style={{ 
            transform: `translateY(${leftGlowOffset}%)`,
            background: `linear-gradient(180deg, transparent 0%, rgba(59, 130, 246, ${glowIntensity}) 30%, rgba(59, 130, 246, ${glowIntensity + 0.05}) 50%, rgba(59, 130, 246, ${glowIntensity}) 70%, transparent 100%)`
          }}
        />
      </div>
      
      {/* Right edge line */}
      <div className="fixed right-0 top-0 bottom-0 w-[1px] z-40 pointer-events-none hidden sm:block">
        <div 
          className="absolute inset-x-0 h-[200%] transition-transform duration-150 ease-out"
          style={{ 
            transform: `translateY(${rightGlowOffset}%)`,
            background: `linear-gradient(180deg, transparent 0%, rgba(59, 130, 246, ${glowIntensity}) 30%, rgba(59, 130, 246, ${glowIntensity + 0.05}) 50%, rgba(59, 130, 246, ${glowIntensity}) 70%, transparent 100%)`
          }}
        />
      </div>
      
      {/* Left ambient glow - reduced */}
      <div className="fixed left-0 top-0 bottom-0 w-16 z-30 pointer-events-none hidden sm:block overflow-hidden">
        <div 
          className="absolute inset-0 h-[150%] transition-transform duration-200 ease-out"
          style={{ 
            transform: `translateY(${leftGlowOffset * 0.4}%)`,
            background: `linear-gradient(to right, rgba(59, 130, 246, ${0.02 + glowIntensity * 0.01}) 0%, transparent 100%)`
          }}
        />
      </div>
      
      {/* Right ambient glow - reduced */}
      <div className="fixed right-0 top-0 bottom-0 w-16 z-30 pointer-events-none hidden sm:block overflow-hidden">
        <div 
          className="absolute inset-0 h-[150%] transition-transform duration-200 ease-out"
          style={{ 
            transform: `translateY(${rightGlowOffset * 0.4}%)`,
            background: `linear-gradient(to left, rgba(59, 130, 246, ${0.02 + glowIntensity * 0.01}) 0%, transparent 100%)`
          }}
        />
      </div>
    </>
  );
};

export default ElectricGlow;
