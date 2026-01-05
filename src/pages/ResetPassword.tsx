import { useState, useEffect } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
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
        />
      </div>

      {/* Left gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a] from-5% via-[#0a0a0a]/95 via-30% to-transparent z-10"></div>
      {/* Bottom gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] from-0% via-[#0a0a0a]/50 via-20% to-transparent z-10"></div>

      {/* Content */}
      <div className="relative z-20 container min-h-screen flex flex-col items-start justify-center py-12 px-4 md:pl-16">
        {/* Logo */}
        <Link
          to="/"
          className="absolute top-6 left-4 md:left-8 flex items-center gap-2 md:gap-3"
        >
          <Logo size={36} />
          <span className="font-medium text-white text-base md:text-lg tracking-tight">
            Comsierge
          </span>
        </Link>

        {/* Form Card */}
        <div className="w-full max-w-md bg-[#111111]/90 backdrop-blur-xl rounded-2xl p-8 border border-white/[0.08] shadow-2xl">
          <h1 className="text-2xl md:text-3xl font-medium text-white mb-2">
            Reset Password
          </h1>
          <p className="text-white/60 mb-8">
            Enter your new password below.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-colors pr-12"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-colors pr-12"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-white text-black font-medium rounded-lg hover:bg-white/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Resetting...
                </>
              ) : (
                "Reset Password"
              )}
            </button>
          </form>

          {/* Back to Login */}
          <p className="text-center text-white/50 mt-6">
            Remember your password?{" "}
            <Link
              to="/auth"
              className="text-white hover:text-white/80 transition-colors font-medium"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
