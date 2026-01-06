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
  const lastScrollY = useRef(0);
  const upScrollAccumulated = useRef(0);
  const rafId = useRef<number | null>(null);
  const mobileOpenRef = useRef(false);

  useEffect(() => {
    mobileOpenRef.current = mobileOpen;
  }, [mobileOpen]);

  useEffect(() => {
    const onScroll = () => {
      if (rafId.current != null) return;
      rafId.current = window.requestAnimationFrame(() => {
        rafId.current = null;

        const currentScrollY = window.scrollY;

        // Add background when scrolled past threshold
        setScrolled(currentScrollY > 50);

        // If mobile menu is open, keep header visible.
        if (mobileOpenRef.current) {
          lastScrollY.current = currentScrollY;
          return;
        }

        // Always show near the top.
        if (currentScrollY < 24) {
          setHidden(false);
          upScrollAccumulated.current = 0;
          lastScrollY.current = currentScrollY;
          return;
        }

        // Micro1-style behavior: hide on scroll down, show on scroll up.
        // Use direction-based detection so it still works with slow/trackpad scrolling.
        if (currentScrollY > lastScrollY.current && currentScrollY > 120) {
          setHidden(true);
          upScrollAccumulated.current = 0;
        } else if (currentScrollY < lastScrollY.current) {
          // Avoid jitter where tiny upward movements (trackpads/inertia) instantly re-show.
          // Accumulate upward scroll so slow scrolling still works.
          upScrollAccumulated.current += lastScrollY.current - currentScrollY;
          if (upScrollAccumulated.current > 12) {
            setHidden(false);
            upScrollAccumulated.current = 0;
          }
        }

        lastScrollY.current = currentScrollY;
      });
    };

    // Initialize baseline
    lastScrollY.current = window.scrollY;
    upScrollAccumulated.current = 0;
    setScrolled(window.scrollY > 50);

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafId.current != null) {
        window.cancelAnimationFrame(rafId.current);
      }
    };
  }, []);

  // Close mobile menu on route changes
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  return (
    <>
      {/* Fixed container that handles the hide/show animation */}
      <div
        className={[
          "fixed top-0 left-0 right-0 z-50 pt-3 sm:pt-4",
          "transition-transform duration-500 ease-out will-change-transform",
          hidden && !isAuthPage && !mobileOpen ? "-translate-y-full" : "translate-y-0",
        ].join(" ")}
      >
        {/* Inner nav with padding and conditional styling */}
        <nav
          className={[
            "mx-4 sm:mx-6 px-4 sm:px-6",
            "transition-all duration-300 ease-out",
            scrolled && !isAuthPage
              ? "py-2.5 sm:py-3 bg-[#1a1a1a]/90 backdrop-blur-xl border border-white/10 rounded-full shadow-lg shadow-black/20"
              : "py-3 sm:py-4 bg-transparent rounded-full",
          ].join(" ")}
        >
          <div className="max-w-7xl mx-auto grid grid-cols-3 items-center">
            {/* Left column (kept for balance) */}
            <div className="justify-self-start" />

            {/* Center - Logo */}
            <div className="justify-self-center">
              <Link to="/" className="text-lg sm:text-xl">
                <Logo />
              </Link>
            </div>

            {/* Right - Desktop actions + Mobile toggle */}
            <div className="justify-self-end flex items-center">
              {!isAuthPage && (
                <div className="hidden md:flex items-center gap-3">
                  <Link
                    to="/auth"
                    className={[
                      "px-4 py-2 rounded-full text-sm font-medium transition-all duration-200",
                      scrolled
                        ? "text-white/80 hover:text-white hover:bg-white/10"
                        : "text-white/70 hover:text-white",
                    ].join(" ")}
                  >
                    Log in
                  </Link>
                  <Link
                    to="/auth?mode=signup"
                    className={[
                      "px-5 py-2 rounded-full text-sm font-medium transition-all duration-200",
                      scrolled
                        ? "bg-white/10 text-white border border-white/20 hover:bg-white/20"
                        : "bg-white/5 text-white border border-white/10 hover:bg-white/10 hover:border-white/20",
                    ].join(" ")}
                  >
                    Get Started
                  </Link>
                </div>
              )}

              {!isAuthPage && (
                <button
                  onClick={() => setMobileOpen(!mobileOpen)}
                  className="md:hidden text-foreground z-50 p-2 -mr-2"
                  aria-label={mobileOpen ? "Close menu" : "Open menu"}
                  type="button"
                >
                  {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
              )}
            </div>
          </div>
        </nav>
      </div>

      {/* Mobile Menu */}
      {!isAuthPage && (
        <div
          className={[
            "fixed inset-0 z-40 md:hidden",
            "bg-background/95 backdrop-blur-xl",
            "transition-opacity duration-500 ease-out",
            mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
          ].join(" ")}
          aria-hidden={!mobileOpen}
        >
          <div
            className={[
              "pt-24 px-6",
              "transition-transform duration-500 ease-out",
              mobileOpen ? "translate-y-0" : "-translate-y-2",
            ].join(" ")}
          >
            <div className="flex flex-col items-center gap-8">
              <div className="flex flex-col items-center gap-6">
                <Link
                  to="/auth"
                  className="text-lg text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setMobileOpen(false)}
                >
                  Log in
                </Link>
                <Link
                  to="/auth?mode=signup"
                  className="px-6 py-3 rounded-full text-base font-medium bg-white/10 text-white border border-white/20 hover:bg-white/20 transition-all duration-200"
                  onClick={() => setMobileOpen(false)}
                >
                  Get Started
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;
