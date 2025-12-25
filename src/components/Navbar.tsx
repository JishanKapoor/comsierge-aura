import { useEffect, useRef, useState } from "react";
import { Menu, X, Phone } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const location = useLocation();
  const isAuthPage = location.pathname === "/auth";
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

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
      <nav
        className={[
          "fixed top-0 left-0 right-0 z-50 px-4 sm:px-6 py-4 sm:py-6",
          "transition-all duration-500 ease-out will-change-transform",
          hidden && !isAuthPage ? "-translate-y-full opacity-0" : "translate-y-0 opacity-100",
        ].join(" ")}
      >
        <div className="max-w-7xl mx-auto flex items-center">
          {/* Left spacer (keeps logo truly centered) */}
          <div className="hidden md:flex w-[148px]" />

          {/* Logo - Centered */}
          <div className="flex-1 flex justify-center">
            <Link
              to="/"
              className="flex items-center gap-2.5 text-lg sm:text-xl md:text-2xl font-medium tracking-tight text-foreground"
            >
              <Phone className="w-5 h-5 sm:w-6 sm:h-6 text-foreground" />
              <span>comsierge.</span>
            </Link>
          </div>

          {/* Right - Login/Signup (Desktop) */}
          {!isAuthPage && (
            <div className="hidden md:flex items-center gap-4 w-[148px] justify-end">
              <Link to="/auth" className="nav-link">
                Log in
              </Link>
              <Link to="/auth" className="pill-button-ghost">
                Sign up
              </Link>
            </div>
          )}

          {/* Mobile Menu Toggle */}
          {!isAuthPage && (
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden text-foreground z-50"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              type="button"
            >
              {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          )}
        </div>
      </nav>

      {/* Mobile Menu */}
      {mobileOpen && !isAuthPage && (
        <div className="fixed inset-0 z-40 bg-background pt-24 px-6 md:hidden">
          <div className="flex flex-col items-center gap-8">
            <div className="flex flex-col items-center gap-6">
              <Link
                to="/auth"
                className="text-lg text-muted-foreground"
                onClick={() => setMobileOpen(false)}
              >
                Log in
              </Link>
              <Link
                to="/auth"
                className="pill-button-ghost inline-flex justify-center"
                onClick={() => setMobileOpen(false)}
              >
                Sign up
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;
