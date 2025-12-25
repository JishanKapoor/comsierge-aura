const ElectricGlow = () => {
  return (
    <>
      {/* Left edge glow - more visible */}
      <div className="fixed left-0 top-0 bottom-0 w-[3px] z-40 pointer-events-none overflow-hidden hidden sm:block">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-400/50 to-transparent animate-electric-pulse-left" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-300/40 to-transparent animate-electric-pulse-left-delayed" />
      </div>
      
      {/* Right edge glow - more visible */}
      <div className="fixed right-0 top-0 bottom-0 w-[3px] z-40 pointer-events-none overflow-hidden hidden sm:block">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-400/50 to-transparent animate-electric-pulse-right" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-300/40 to-transparent animate-electric-pulse-right-delayed" />
      </div>
      
      {/* Ambient glow spread - more visible */}
      <div className="fixed left-0 top-0 bottom-0 w-24 z-30 pointer-events-none hidden sm:block">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-transparent animate-glow-breathe" />
      </div>
      <div className="fixed right-0 top-0 bottom-0 w-24 z-30 pointer-events-none hidden sm:block">
        <div className="absolute inset-0 bg-gradient-to-l from-blue-500/10 to-transparent animate-glow-breathe-delayed" />
      </div>
    </>
  );
};

export default ElectricGlow;
