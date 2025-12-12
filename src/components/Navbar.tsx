import { useState } from "react";
import { Menu, X, ChevronDown } from "lucide-react";

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);

  const navItems = [
    { name: "Call Filter", href: "#features" },
    { name: "Auto-Reply", href: "#auto-reply" },
    { name: "Intelligence", href: "#intelligence" },
    { name: "Integrations", href: "#integrations" },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4 md:px-8 lg:px-12">
      <div className="flex items-center justify-between">
        {/* Left Navigation */}
        <div className="hidden md:flex flex-col gap-1.5 animate-slide-left">
          {navItems.map((item, index) => (
            <a
              key={item.name}
              href={item.href}
              className="nav-link"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {item.name}
            </a>
          ))}
          <button className="nav-link flex items-center gap-1 text-left">
            Solutions
            <ChevronDown className="w-3 h-3" />
          </button>
          <a href="#contact" className="nav-link">
            Contact
          </a>
        </div>

        {/* Logo */}
        <div className="absolute left-1/2 -translate-x-1/2 top-4 md:top-6">
          <a
            href="/"
            className="font-serif text-2xl md:text-3xl font-medium tracking-tight text-foreground animate-fade-in"
          >
            comsierge.
          </a>
        </div>

        {/* Right CTA */}
        <div className="hidden md:block ml-auto animate-fade-up-delay-2">
          <a href="#contact" className="pill-button-outline">
            Get in touch
          </a>
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="md:hidden text-foreground z-50"
        >
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="fixed inset-0 bg-background/98 backdrop-blur-lg md:hidden pt-20 px-6 animate-fade-in">
          <div className="flex flex-col gap-4">
            {navItems.map((item) => (
              <a
                key={item.name}
                href={item.href}
                className="text-2xl font-serif text-foreground"
                onClick={() => setIsOpen(false)}
              >
                {item.name}
              </a>
            ))}
            <a
              href="#contact"
              className="text-2xl font-serif text-foreground"
              onClick={() => setIsOpen(false)}
            >
              Contact
            </a>
            <div className="mt-8">
              <a href="#contact" className="pill-button">
                Get in touch
              </a>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
