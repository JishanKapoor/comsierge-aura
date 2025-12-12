import { MapPin } from "lucide-react";

const Footer = () => {
  return (
    <footer className="py-12 px-6 md:px-16 bg-background border-t border-border">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div>
            <a href="/" className="text-xl font-medium tracking-tight text-foreground">
              comsierge.
            </a>
            <div className="mt-3 flex items-center gap-1.5 text-muted-foreground">
              <MapPin className="w-3.5 h-3.5" />
              <span className="text-xs">New York</span>
            </div>
          </div>

          <div className="flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
            <a href="#" className="hover:text-foreground transition-colors">Terms</a>
            <a href="#" className="hover:text-foreground transition-colors">Cookies</a>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Comsierge Inc. All rights reserved.
          </p>
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors">X</a>
            <a href="#" className="hover:text-foreground transition-colors">LinkedIn</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
