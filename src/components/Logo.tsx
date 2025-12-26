interface LogoProps {
  className?: string;
}

const Logo = ({ className = "" }: LogoProps) => {
  return (
    <span className={`font-medium tracking-tight text-foreground ${className}`}>
      comsierge.
    </span>
  );
};

export default Logo;
