import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import Logo from "./Logo";

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const isAuthPage = location.pathname === "/auth";

  // Fresh scroll detection implementation
  useEffect(() => {
    // Get scroll position from any source
    const getScrollY = (): number => {
      if (typeof window.pageYOffset !== "undefined") return window.pageYOffset;
      if (typeof window.scrollY !== "undefined") return window.scrollY;
      const doc = document.documentElement || document.body.parentNode || document.body;
      return (doc as HTMLElement).scrollTop || 0;
    };

    let prevY = getScrollY();
    let ticking = false;

    const onScroll = () => {
      if (ticking) return;
      ticking = true;

      requestAnimationFrame(() => {
        const currentY = getScrollY();

        // Background effect
        setScrolled(currentY > 20);

        // Skip hide/show if mobile menu open
        if (mobileOpen) {
          prevY = currentY;
          ticking = false;
          return;
        }

        // Near top? Always show
        if (currentY < 60) {
          setHidden(false);
          prevY = currentY;
          ticking = false;
          return;
        }

        // Direction check
        const delta = currentY - prevY;
        if (Math.abs(delta) > 5) {
          setHidden(delta > 0); // Down = hide, Up = show
          prevY = currentY;
        }

        ticking = false;
      });
    };

    // Initialize
    prevY = getScrollY();
    setScrolled(prevY > 20);

    // Attach to multiple scroll sources
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("scroll", onScroll, { passive: true });

    // Also listen on <main> if it exists (for overflow:auto containers)
    const mainEl = document.querySelector("main");
    if (mainEl) mainEl.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("scroll", onScroll);
      if (mainEl) mainEl.removeEventListener("scroll", onScroll);
    };
  }, [mobileOpen]);

  // Close mobile menu on navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Lock body scroll when mobile menu open
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  const shouldHide = hidden && !isAuthPage && !mobileOpen;

  return (
    <>
      {/* Navbar */}
      <header
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          paddingTop: 12,
          transform: shouldHide ? "translateY(-100%)" : "translateY(0)",
          transition: "transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        <nav
          style={{
            margin: "0 16px",
            padding: scrolled && !isAuthPage ? "10px 16px" : "12px 16px",
            backgroundColor: scrolled && !isAuthPage ? "rgba(26, 26, 26, 0.9)" : "transparent",
            backdropFilter: scrolled && !isAuthPage ? "blur(16px)" : "none",
            WebkitBackdropFilter: scrolled && !isAuthPage ? "blur(16px)" : "none",
            border: scrolled && !isAuthPage ? "1px solid rgba(255,255,255,0.1)" : "1px solid transparent",
            borderRadius: 9999,
            boxShadow: scrolled && !isAuthPage ? "0 10px 15px -3px rgba(0,0,0,0.2)" : "none",
            transition: "all 0.3s ease",
          }}
        >
          <div
            style={{
              maxWidth: "80rem",
              margin: "0 auto",
              display: "grid",
              gridTemplateColumns: "1fr auto 1fr",
              alignItems: "center",
            }}
          >
            {/* Left spacer */}
            <div />

            {/* Center - Logo */}
            <Link to="/" style={{ fontSize: "1.25rem" }}>
              <Logo />
            </Link>

            {/* Right - Actions */}
            <div style={{ justifySelf: "end", display: "flex", alignItems: "center" }}>
              {!isAuthPage && (
                <>
                  {/* Desktop */}
                  <div className="hidden md:flex items-center gap-3">
                    <Link
                      to="/auth"
                      className="hover:text-white hover:bg-white/10"
                      style={{
                        padding: "8px 16px",
                        borderRadius: 9999,
                        fontSize: 14,
                        fontWeight: 500,
                        color: scrolled ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.7)",
                        transition: "all 0.2s",
                      }}
                    >
                      Log in
                    </Link>
                    <Link
                      to="/auth?mode=signup"
                      className="hover:bg-white/20"
                      style={{
                        padding: "8px 20px",
                        borderRadius: 9999,
                        fontSize: 14,
                        fontWeight: 500,
                        backgroundColor: scrolled ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.05)",
                        color: "white",
                        border: scrolled ? "1px solid rgba(255,255,255,0.2)" : "1px solid rgba(255,255,255,0.1)",
                        transition: "all 0.2s",
                      }}
                    >
                      Get Started
                    </Link>
                  </div>

                  {/* Mobile hamburger */}
                  <button
                    onClick={() => setMobileOpen(!mobileOpen)}
                    className="md:hidden text-foreground p-2 -mr-2"
                    style={{ zIndex: 50 }}
                    aria-label={mobileOpen ? "Close menu" : "Open menu"}
                    type="button"
                  >
                    {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                  </button>
                </>
              )}
            </div>
          </div>
        </nav>
      </header>

      {/* Mobile Menu */}
      {!isAuthPage && (
        <div
          className="md:hidden"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 40,
            backgroundColor: "rgba(8, 8, 8, 0.95)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            opacity: mobileOpen ? 1 : 0,
            pointerEvents: mobileOpen ? "auto" : "none",
            transition: "opacity 0.4s ease",
          }}
          aria-hidden={!mobileOpen}
        >
          <div
            style={{
              paddingTop: 96,
              padding: "96px 24px 24px",
              transform: mobileOpen ? "translateY(0)" : "translateY(-8px)",
              transition: "transform 0.4s ease",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 32 }}>
              <Link
                to="/auth"
                onClick={() => setMobileOpen(false)}
                className="hover:text-white"
                style={{ fontSize: 18, color: "rgba(255,255,255,0.6)", transition: "color 0.2s" }}
              >
                Log in
              </Link>
              <Link
                to="/auth?mode=signup"
                onClick={() => setMobileOpen(false)}
                className="hover:bg-white/20"
                style={{
                  padding: "12px 24px",
                  borderRadius: 9999,
                  fontSize: 16,
                  fontWeight: 500,
                  backgroundColor: "rgba(255,255,255,0.1)",
                  color: "white",
                  border: "1px solid rgba(255,255,255,0.2)",
                  transition: "all 0.2s",
                }}
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;
