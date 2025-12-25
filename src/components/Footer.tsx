import { MapPin, Mail } from "lucide-react";
import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="py-16 px-6 md:px-16 bg-background border-t border-border">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="text-xl font-medium tracking-tight text-foreground">
              comsierge.
            </Link>
            <div className="mt-4 flex items-center gap-1.5 text-muted-foreground">
              <MapPin className="w-3.5 h-3.5" />
              <span className="text-xs">New York, NY</span>
            </div>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-xs font-medium text-foreground uppercase tracking-wider mb-4">Product</h4>
            <ul className="space-y-3">
              <li><span className="text-sm text-muted-foreground">Features</span></li>
              <li><span className="text-sm text-muted-foreground">Integrations</span></li>
              <li><span className="text-sm text-muted-foreground">Pricing</span></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-xs font-medium text-foreground uppercase tracking-wider mb-4">Company</h4>
            <ul className="space-y-3">
              <li><span className="text-sm text-muted-foreground">About</span></li>
              <li><span className="text-sm text-muted-foreground">Research</span></li>
              <li><span className="text-sm text-muted-foreground">Careers</span></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-xs font-medium text-foreground uppercase tracking-wider mb-4">Legal</h4>
            <ul className="space-y-3">
              <li><span className="text-sm text-muted-foreground">Privacy</span></li>
              <li><span className="text-sm text-muted-foreground">Terms</span></li>
              <li><span className="text-sm text-muted-foreground">Cookies</span></li>
            </ul>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Comsierge Inc. All rights reserved.
          </p>
          <a 
            href="mailto:Kapoorjishan2@Gmail.com" 
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Mail className="w-4 h-4" />
            Kapoorjishan2@Gmail.com
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
