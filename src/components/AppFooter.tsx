import { Link } from "react-router-dom";

const AppFooter = () => {
  return (
    <footer className="py-6 px-6 md:px-16 bg-background border-t border-border">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Link to="/" className="text-sm font-medium tracking-tight text-foreground">
            comsierge.
          </Link>
          <p className="text-xs text-muted-foreground">
            New York, NY <span className="mx-2">•</span> © 2026 Comsierge Inc. All rights reserved.
          </p>
        </div>

        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 text-sm">
          <a
            href="mailto:jishan.kapoor@mail.utoronto.ca"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            jishan.kapoor@mail.utoronto.ca
          </a>
          <span className="hidden md:inline text-muted-foreground">•</span>
          <a
            href="tel:+14372392448"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            +14372392448
          </a>
        </div>
      </div>
    </footer>
  );
};

export default AppFooter;
