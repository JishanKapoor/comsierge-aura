import { useState, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { Menu, X, Phone } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);
  const location = useLocation();
  const isAuthPage = location.pathname === "/auth";

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setHidden(true);
      } else {
        setHidden(false);
      }
      
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  return (
    <>
      <nav 
        className={`fixed top-0 left-0 right-0 z-50 px-4 sm:px-6 py-4 sm:py-5 transition-all duration-300 ${
          hidden && !isAuthPage ? 'opacity-0 -translate-y-full' : 'opacity-100 translate-y-0'
        }`}
      >
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          {/* Logo - Centered */}
          <div className="flex-1 flex justify-center">
            <Link to="/" className="flex items-center gap-2.5 text-lg sm:text-xl md:text-2xl font-medium tracking-tight text-foreground">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-primary/20 backdrop-blur-sm border border-primary/30 flex items-center justify-center">
                <Phone className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              </div>
              <span>comsierge.</span>
            </Link>
          </div>

          {/* Right - Login/Signup (Desktop) */}
          {!isAuthPage && (
            <div className="hidden md:flex items-center gap-4 absolute right-6 sm:right-10">
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
              className="md:hidden text-foreground z-50 absolute right-4 sm:right-6"
            >
              {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          )}
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
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
      </AnimatePresence>
    </>
  );
};

export default Navbar;
