const ElectricGlow = () => {
  return (
    <>
      {/* Left edge glow */}
      <div className="fixed left-0 top-0 bottom-0 w-1 z-40 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-500/30 to-transparent animate-electric-pulse-left" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-400/20 to-transparent animate-electric-pulse-left-delayed" />
      </div>
      
      {/* Right edge glow */}
      <div className="fixed right-0 top-0 bottom-0 w-1 z-40 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-500/30 to-transparent animate-electric-pulse-right" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-400/20 to-transparent animate-electric-pulse-right-delayed" />
      </div>
      
      {/* Ambient glow spread */}
      <div className="fixed left-0 top-0 bottom-0 w-16 z-30 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-transparent animate-glow-breathe" />
      </div>
      <div className="fixed right-0 top-0 bottom-0 w-16 z-30 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-l from-blue-500/5 to-transparent animate-glow-breathe-delayed" />
      </div>
    </>
  );
};

export default ElectricGlow;
