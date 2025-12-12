import { MapPin } from "lucide-react";

const Footer = () => {
  return (
    <footer className="py-12 md:py-16 px-6 md:px-12 lg:px-24 bg-background border-t border-border/50">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <a
              href="/"
              className="font-serif text-2xl font-medium tracking-tight text-foreground"
            >
              comsierge.
            </a>
            <p className="mt-4 text-muted-foreground font-light max-w-md">
              The AI guardian for your communications. Intelligent filtering,
              automated responses, and complete control over what reaches you.
            </p>
            <div className="mt-6 flex items-center gap-2 text-muted-foreground">
              <MapPin className="w-4 h-4" />
              <span className="text-sm">Built in New York</span>
            </div>
          </div>

          {/* Links */}
          <div>
            <p className="text-sm font-medium text-foreground mb-4">Product</p>
            <div className="flex flex-col gap-3">
              <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Call Filter
              </a>
              <a href="#auto-reply" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Auto-Reply
              </a>
              <a href="#intelligence" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Intelligence
              </a>
              <a href="#integrations" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Integrations
              </a>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-foreground mb-4">Company</p>
            <div className="flex flex-col gap-3">
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                About
              </a>
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Careers
              </a>
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Privacy
              </a>
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Terms
              </a>
            </div>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-border/50 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Comsierge. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Twitter
            </a>
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              LinkedIn
            </a>
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              GitHub
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
