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

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Add background when scrolled past threshold
      setScrolled(currentScrollY > 50);

      // Hide on scroll down (after scrolling 100px), show on scroll up
      if (currentScrollY > lastScrollY.current && currentScrollY > 100) {
        setHidden(true);
      } else if (currentScrollY < lastScrollY.current) {
        setHidden(false);
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      {/* Fixed container that handles the hide/show animation */}
      <div
        className={[
          "fixed top-0 left-0 right-0 z-50",
          "transition-transform duration-500 ease-out will-change-transform",
          hidden && !isAuthPage ? "-translate-y-full" : "translate-y-0",
        ].join(" ")}
      >
        {/* Inner nav with padding and conditional styling */}
        <nav
          className={[
            "mx-4 sm:mx-6 mt-3 sm:mt-4 px-4 sm:px-6",
            "transition-all duration-300 ease-out",
            scrolled && !isAuthPage
              ? "py-2.5 sm:py-3 bg-[#1a1a1a]/90 backdrop-blur-xl border border-white/10 rounded-full shadow-lg shadow-black/20"
              : "py-3 sm:py-4 bg-transparent rounded-full",
          ].join(" ")}
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            {/* Logo - Left aligned on desktop, centered on mobile */}
            <div className="flex-shrink-0">
              <Link to="/" className="text-lg sm:text-xl">
                <Logo />
              </Link>
            </div>

            {/* Right - Login/Signup (Desktop) */}
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
                  to="/auth"
                  className={[
                    "px-5 py-2 rounded-full text-sm font-medium transition-all duration-200",
                    scrolled
                      ? "bg-white/10 text-white border border-white/20 hover:bg-white/20"
                      : "bg-white/5 text-white border border-white/10 hover:bg-white/10 hover:border-white/20",
                  ].join(" ")}
                >
                  Get in touch
                </Link>
              </div>
            )}

            {/* Mobile Menu Toggle */}
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
        </nav>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && !isAuthPage && (
        <div className="fixed inset-0 z-40 bg-background/95 backdrop-blur-xl pt-24 px-6 md:hidden">
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
                to="/auth"
                className="px-6 py-3 rounded-full text-base font-medium bg-white/10 text-white border border-white/20 hover:bg-white/20 transition-all"
                onClick={() => setMobileOpen(false)}
              >
                Get in touch
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;
