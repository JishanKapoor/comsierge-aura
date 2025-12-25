const ElectricGlow = () => {
  // Static, ultra-light glow (no animation) to avoid scroll/page lag.
  return (
    <>
      <div className="fixed left-0 top-0 bottom-0 w-[2px] z-40 pointer-events-none hidden sm:block">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-500/25 to-transparent" />
      </div>
      <div className="fixed right-0 top-0 bottom-0 w-[2px] z-40 pointer-events-none hidden sm:block">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-500/25 to-transparent" />
      </div>
      <div className="fixed left-0 top-0 bottom-0 w-20 z-30 pointer-events-none hidden sm:block">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/6 to-transparent" />
      </div>
      <div className="fixed right-0 top-0 bottom-0 w-20 z-30 pointer-events-none hidden sm:block">
        <div className="absolute inset-0 bg-gradient-to-l from-blue-500/6 to-transparent" />
      </div>
    </>
  );
};

export default ElectricGlow;
