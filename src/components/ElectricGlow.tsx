import { useEffect, useState, useRef } from "react";

const ElectricGlow = () => {
  const [scrollY, setScrollY] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const rafRef = useRef<number>();

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

  // Calculate glow position based on scroll (moves up and down)
  const maxScroll = document.documentElement.scrollHeight - viewportHeight;
  const scrollProgress = maxScroll > 0 ? scrollY / maxScroll : 0;
  
  // Left glow moves down, right glow moves up (creates parallax effect)
  const leftGlowOffset = scrollProgress * 60 - 30; // -30% to 30%
  const rightGlowOffset = -scrollProgress * 60 + 30; // 30% to -30%
  
  // Intensity pulses subtly based on scroll
  const glowIntensity = 0.2 + Math.sin(scrollProgress * Math.PI * 2) * 0.1;

  return (
    <>
      {/* Left edge glow - moves with scroll */}
      <div className="fixed left-0 top-0 bottom-0 w-[2px] z-40 pointer-events-none hidden sm:block">
        <div 
          className="absolute inset-x-0 h-[200%] transition-transform duration-100 ease-out"
          style={{ 
            transform: `translateY(${leftGlowOffset}%)`,
            background: `linear-gradient(180deg, transparent 0%, rgba(59, 130, 246, ${glowIntensity}) 30%, rgba(59, 130, 246, ${glowIntensity + 0.1}) 50%, rgba(59, 130, 246, ${glowIntensity}) 70%, transparent 100%)`
          }}
        />
      </div>
      
      {/* Right edge glow - moves opposite */}
      <div className="fixed right-0 top-0 bottom-0 w-[2px] z-40 pointer-events-none hidden sm:block">
        <div 
          className="absolute inset-x-0 h-[200%] transition-transform duration-100 ease-out"
          style={{ 
            transform: `translateY(${rightGlowOffset}%)`,
            background: `linear-gradient(180deg, transparent 0%, rgba(59, 130, 246, ${glowIntensity}) 30%, rgba(59, 130, 246, ${glowIntensity + 0.1}) 50%, rgba(59, 130, 246, ${glowIntensity}) 70%, transparent 100%)`
          }}
        />
      </div>
      
      {/* Left ambient glow */}
      <div className="fixed left-0 top-0 bottom-0 w-24 z-30 pointer-events-none hidden sm:block overflow-hidden">
        <div 
          className="absolute inset-0 h-[150%] transition-transform duration-150 ease-out"
          style={{ 
            transform: `translateY(${leftGlowOffset * 0.5}%)`,
            background: `linear-gradient(to right, rgba(59, 130, 246, ${0.04 + glowIntensity * 0.02}) 0%, transparent 100%)`
          }}
        />
      </div>
      
      {/* Right ambient glow */}
      <div className="fixed right-0 top-0 bottom-0 w-24 z-30 pointer-events-none hidden sm:block overflow-hidden">
        <div 
          className="absolute inset-0 h-[150%] transition-transform duration-150 ease-out"
          style={{ 
            transform: `translateY(${rightGlowOffset * 0.5}%)`,
            background: `linear-gradient(to left, rgba(59, 130, 246, ${0.04 + glowIntensity * 0.02}) 0%, transparent 100%)`
          }}
        />
      </div>
    </>
  );
};

export default ElectricGlow;
