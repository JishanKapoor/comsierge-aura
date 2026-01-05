import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { ArrowRight } from "lucide-react";
import Navbar from "@/components/Navbar";
import heroImage from "@/assets/hero-nyc.jpg";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <main className="min-h-screen bg-background overflow-x-hidden">
      <Navbar />

      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20 bg-background">
        <div className="absolute inset-0 z-0">
          <div
            className="w-full h-full bg-cover bg-center"
            style={{ backgroundImage: `url(${heroImage})` }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, hsl(0 0% 3% / 0.4) 0%, hsl(0 0% 3% / 0.2) 40%, hsl(0 0% 3% / 0.7) 80%, hsl(0 0% 3%) 100%)",
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, hsl(0 0% 3% / 0.6) 0%, transparent 25%, transparent 75%, hsl(0 0% 3% / 0.6) 100%)",
            }}
          />
        </div>

        <div className="relative z-10 text-center px-4 sm:px-6 max-w-3xl mx-auto">
          <div className="text-6xl sm:text-7xl md:text-8xl font-light text-foreground">404</div>
          <h1 className="mt-3 text-xl sm:text-2xl md:text-3xl font-light text-foreground">
            Page not found
          </h1>
          <p className="mt-3 text-sm sm:text-base text-muted-foreground">
            The page <span className="text-foreground/90">{location.pathname}</span> doesn’t exist.
          </p>

          <div className="mt-8 flex items-center justify-center gap-4 flex-wrap">
            <Link to="/" className="pill-button group">
              <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-background flex items-center justify-center">
                <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-foreground transition-transform duration-300 group-hover:translate-x-0.5" />
              </span>
              <span className="text-sm sm:text-base">Back to home</span>
            </Link>

            <Link
              to="/auth?mode=signup"
              className="px-5 py-2.5 rounded-full text-sm sm:text-base font-medium bg-white/10 text-white border border-white/20 hover:bg-white/20 transition-all duration-200"
            >
              Get Started
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
};

export default NotFound;

