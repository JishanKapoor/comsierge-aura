import { useState, useEffect } from "react";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Loader2, KeyRound } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { API_BASE_URL } from "@/config";
import Logo from "@/components/Logo";
import { preloadedImages } from "@/hooks/useImagePreloader";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get("token");

  // Preload background image
  useEffect(() => {
    const img = new Image();
    img.onload = () => setImageLoaded(true);
    img.src = preloadedImages.heroNyc;
  }, []);

  // Redirect if no token
  useEffect(() => {
    if (!token) {
      toast.error("Invalid or missing reset token");
      navigate("/auth");
    }
  }, [token, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.message || "Failed to reset password");
        setIsLoading(false);
        return;
      }

      // Store token and user data
      localStorage.setItem("comsierge_token", data.data.token);
      localStorage.setItem("comsierge_user", JSON.stringify(data.data.user));

      toast.success("Password reset successfully! Logging you in...");

      // Navigate based on user state
      setTimeout(() => {
        const user = data.data.user;
        if (user.role === "admin") {
          navigate("/admin");
        } else if (!user.phoneNumber) {
          navigate("/select-number");
        } else if (!user.forwardingNumber) {
          navigate("/setup-forwarding");
        } else {
          navigate("/dashboard");
        }
      }, 500);
    } catch (error) {
      console.error("Reset password error:", error);
      toast.error("Unable to connect to server. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return null;
  }

  return (
    <div className="min-h-screen relative overflow-y-auto bg-background">
      {/* Background with fade-in */}
      <div className={`absolute inset-0 z-0 transition-opacity duration-500 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}>
        <img
          src={preloadedImages.heroNyc}
          alt="New York City"
          className="w-full h-full object-cover brightness-125"
          loading="eager"
          decoding="async"
          fetchPriority="high"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-background/80 via-background/60 to-background/50" />
      </div>

      {/* Fallback background color while loading */}
      {!imageLoaded && (
        <div className="absolute inset-0 z-0 bg-background" />
      )}

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 py-8 sm:py-12">
        {/* Logo */}
        <div className="w-full max-w-md mb-6 sm:mb-8 flex justify-center">
          <Link to="/" className="text-xl sm:text-2xl">
            <Logo />
          </Link>
        </div>

        {/* Card */}
        <div className="w-full max-w-md bg-card/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl">
          <div className="flex justify-center mb-6">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <KeyRound className="w-6 h-6 sm:w-7 sm:h-7 text-primary" />
            </div>
          </div>

          <h1 className="text-xl sm:text-2xl md:text-3xl font-light text-foreground text-center">
            Reset your password
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-muted-foreground text-center">
            Enter your new password below
          </p>

          <form onSubmit={handleSubmit} className="mt-6 sm:mt-8 space-y-3 sm:space-y-4">
            {/* New Password */}
            <div>
              <label className="block text-xs sm:text-sm text-muted-foreground mb-1.5">
                New password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 pr-10 bg-background/50 backdrop-blur-sm border border-white/10 rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-white/30 transition-colors duration-300 text-sm"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-xs sm:text-sm text-muted-foreground mb-1.5">
                Confirm password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 pr-10 bg-background/50 backdrop-blur-sm border border-white/10 rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-white/30 transition-colors duration-300 text-sm"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-4 pill-button justify-center py-2.5 sm:py-3 disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-background flex items-center justify-center">
                    <ArrowRight className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-foreground" />
                  </span>
                  <span className="text-sm">Reset password</span>
                </>
              )}
            </button>
          </form>

          {/* Back to Login */}
          <p className="mt-5 sm:mt-6 text-xs sm:text-sm text-muted-foreground text-center">
            Remember your password?{" "}
            <Link
              to="/auth"
              className="text-foreground hover:underline transition-all duration-200"
            >
              Sign in
            </Link>
          </p>
        </div>

        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors duration-300 mt-6">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back to home</span>
        </Link>
      </div>
    </div>
  );
};

export default ResetPassword;
