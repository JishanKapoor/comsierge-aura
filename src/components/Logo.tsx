import { Heart } from "lucide-react";

interface LogoProps {
  className?: string;
  iconClassName?: string;
  showText?: boolean;
}

const Logo = ({ className = "", iconClassName = "w-5 h-5 sm:w-6 sm:h-6", showText = true }: LogoProps) => {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Heart-based logo similar to Lovable */}
      <div className="relative">
        <Heart 
          className={`${iconClassName} text-foreground fill-foreground`}
          strokeWidth={1.5}
        />
      </div>
      {showText && (
        <span className="font-medium tracking-tight text-foreground">comsierge.</span>
      )}
    </div>
  );
};

export default Logo;
