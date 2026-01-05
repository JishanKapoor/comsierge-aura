import { useState, useEffect, useRef } from "react";
import { ArrowRight, ArrowLeft, Eye, EyeOff, Loader2, Mail, CheckCircle } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { loginSchema, signupSchema, LoginFormData, SignupFormData } from "@/lib/validations";
import { preloadedImages } from "@/hooks/useImagePreloader";
import Logo from "@/components/Logo";

type AuthView = "login" | "signup" | "verify";

const Auth = () => {
  const [view, setView] = useState<AuthView>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, login, signup, verifyEmail, resendOTP, loginWithGoogle, isLoading, refreshUser } = useAuth();

  // Handle Google OAuth callback
  useEffect(() => {
    const token = searchParams.get("token");
    const googleSuccess = searchParams.get("google");
    const error = searchParams.get("error");
    const linked = searchParams.get("linked");
    const isNew = searchParams.get("new");

    if (error) {
      if (error === "oauth_failed") {
        toast.error("Google sign-in failed. Please try again.");
      } else if (error === "no_code") {
        toast.error("Authorization code missing.");
      } else if (error === "email_in_use") {
        toast.error("This email is already linked to a different Google account.");
      } else {
        toast.error("Authentication error. Please try again.");
      }
      navigate("/auth", { replace: true });
      return;
    }

    if (token && googleSuccess === "success") {
      localStorage.setItem("comsierge_token", token);
      
      if (linked === "true") {
        toast.success("Google account linked successfully!");
      } else if (isNew === "true") {
        toast.success("Account created with Google!");
      } else {
        toast.success("Signed in with Google!");
      }
      
      refreshUser().then(() => {
        setTimeout(() => {
          const userData = localStorage.getItem("comsierge_user");
          if (userData) {
            const user = JSON.parse(userData);
            if (user.role === "admin") {
              navigate("/admin", { replace: true });
            } else if (!user.phoneNumber) {
              navigate("/select-number", { replace: true });
            } else if (!user.forwardingNumber) {
              navigate("/setup-forwarding", { replace: true });
            } else {
              navigate("/dashboard", { replace: true });
            }
          } else {
            navigate("/dashboard", { replace: true });
          }
        }, 100);
      });
    }
  }, [searchParams, navigate, refreshUser]);

  // Preload background image
  useEffect(() => {
    const img = new Image();
    img.onload = () => setImageLoaded(true);
    img.src = preloadedImages.heroNyc;
  }, []);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const signupForm = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  });

  const navigateToUser = (user: { role: string; phoneNumber?: string | null; forwardingNumber?: string | null }) => {
    if (user.role === "admin") {
      navigate("/admin");
    } else if (!user.phoneNumber) {
      navigate("/select-number");
    } else if (!user.forwardingNumber) {
      navigate("/setup-forwarding");
    } else {
      navigate("/dashboard");
    }
  };

  // If user becomes authenticated (e.g., after Google sign-in), redirect out of /auth.
  useEffect(() => {
    if (!isLoading && user) {
      navigateToUser(user);
    }
  }, [user, isLoading]);

  const handleLoginSubmit = async (data: LoginFormData) => {
    const result = await login(data.email, data.password);
    
    if (result.requiresVerification && result.email) {
      setVerificationEmail(result.email);
      setView("verify");
      setResendCooldown(60);
      return;
    }
    
    if (result.useGoogle) {
      // Prompt to use Google login
      return;
    }
    
    if (result.user) {
      navigateToUser(result.user);
    }
  };

  const handleSignupSubmit = async (data: SignupFormData) => {
    const result = await signup(data.name, data.email, data.password);
    
    if (result.success) {
      // Navigate based on user state
      const userData = localStorage.getItem("comsierge_user");
      if (userData) {
        const user = JSON.parse(userData);
        navigateToUser(user);
      } else {
        navigate("/select-number");
      }
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Handle paste
      const digits = value.replace(/\D/g, "").slice(0, 6).split("");
      const newOtp = [...otp];
      digits.forEach((digit, i) => {
        if (index + i < 6) {
          newOtp[index + i] = digit;
        }
      });
      setOtp(newOtp);
      const nextIndex = Math.min(index + digits.length, 5);
      otpInputRefs.current[nextIndex]?.focus();
      return;
    }

    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpString = otp.join("");
    
    if (otpString.length !== 6) {
      toast.error("Please enter the complete 6-digit code");
      return;
    }

    const user = await verifyEmail(verificationEmail, otpString);
    if (user) {
      navigateToUser(user);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    
    const success = await resendOTP(verificationEmail);
    if (success) {
      setResendCooldown(60);
      setOtp(["", "", "", "", "", ""]);
    }
  };

  const switchView = (newView: AuthView) => {
    setIsTransitioning(true);
    setTimeout(() => {
      setView(newView);
      loginForm.reset();
      signupForm.reset();
      setOtp(["", "", "", "", "", ""]);
      setTimeout(() => setIsTransitioning(false), 50);
    }, 150);
  };

  const renderVerificationView = () => (
    <div className={`w-full max-w-md bg-card/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl transition-all duration-300 ${isTransitioning ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
      <div className="flex justify-center mb-4">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Mail className="w-8 h-8 text-primary" />
        </div>
      </div>
      
      <h1 className="text-xl sm:text-2xl md:text-3xl font-light text-foreground text-center">
        Check your email
      </h1>
      <p className="mt-2 text-xs sm:text-sm text-muted-foreground text-center">
        We sent a verification code to<br />
        <span className="text-foreground font-medium">{verificationEmail}</span>
      </p>

      <form onSubmit={handleVerifySubmit} className="mt-6 sm:mt-8">
        <label className="block text-xs sm:text-sm text-muted-foreground mb-3 text-center">
          Enter the 6-digit code
        </label>
        
        <div className="flex gap-2 sm:gap-3 justify-center">
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={(el) => (otpInputRefs.current[index] = el)}
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={digit}
              onChange={(e) => handleOtpChange(index, e.target.value)}
              onKeyDown={(e) => handleOtpKeyDown(index, e)}
              className="w-10 h-12 sm:w-12 sm:h-14 text-center text-lg sm:text-xl font-semibold bg-background/50 backdrop-blur-sm border border-white/10 rounded-xl text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              autoFocus={index === 0}
            />
          ))}
        </div>

        <button 
          type="submit" 
          disabled={isLoading || otp.join("").length !== 6} 
          className="w-full mt-6 pill-button justify-center py-2.5 sm:py-3 disabled:opacity-50"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-background flex items-center justify-center">
                <CheckCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-foreground" />
              </span>
              <span className="text-sm">Verify Email</span>
            </>
          )}
        </button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-xs sm:text-sm text-muted-foreground">
          Didn't receive the code?{" "}
          {resendCooldown > 0 ? (
            <span className="text-muted-foreground/70">
              Resend in {resendCooldown}s
            </span>
          ) : (
            <button 
              type="button" 
              onClick={handleResendOtp}
              className="text-foreground hover:underline transition-all duration-200"
            >
              Resend code
            </button>
          )}
        </p>
      </div>

      <button 
        type="button" 
        onClick={() => switchView("signup")}
        className="mt-4 w-full text-xs sm:text-sm text-muted-foreground hover:text-foreground text-center transition-colors"
      >
        ← Back to sign up
      </button>
    </div>
  );

  const renderLoginForm = () => (
    <form onSubmit={loginForm.handleSubmit(handleLoginSubmit)} className="mt-6 sm:mt-8 space-y-3 sm:space-y-4">
      <div>
        <label className="block text-xs sm:text-sm text-muted-foreground mb-1.5">Email address</label>
        <input
          type="text"
          {...loginForm.register("email")}
          autoComplete="username"
          className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-background/50 backdrop-blur-sm border rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-white/30 transition-colors duration-300 text-sm ${
            loginForm.formState.errors.email ? "border-destructive" : "border-white/10"
          }`}
          placeholder="you@example.com"
        />
        {loginForm.formState.errors.email && (
          <p className="mt-1.5 text-xs text-destructive">{loginForm.formState.errors.email.message}</p>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs sm:text-sm text-muted-foreground">Password</label>
          <Link to="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground transition-colors duration-300">
            Forgot password?
          </Link>
        </div>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            {...loginForm.register("password")}
            autoComplete="current-password"
            className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 pr-10 bg-background/50 backdrop-blur-sm border rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-white/30 transition-colors duration-300 text-sm ${
              loginForm.formState.errors.password ? "border-destructive" : "border-white/10"
            }`}
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {loginForm.formState.errors.password && (
          <p className="mt-1.5 text-xs text-destructive">{loginForm.formState.errors.password.message}</p>
        )}
      </div>

      <button type="submit" disabled={isLoading} className="w-full mt-4 pill-button justify-center py-2.5 sm:py-3 disabled:opacity-50">
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <>
            <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-background flex items-center justify-center">
              <ArrowRight className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-foreground" />
            </span>
            <span className="text-sm">Sign in</span>
          </>
        )}
      </button>
    </form>
  );

  const renderSignupForm = () => (
    <form onSubmit={signupForm.handleSubmit(handleSignupSubmit)} className="mt-6 sm:mt-8 space-y-3 sm:space-y-4">
      <div>
        <label className="block text-xs sm:text-sm text-muted-foreground mb-1.5">Full name</label>
        <input
          type="text"
          {...signupForm.register("name")}
          autoComplete="name"
          className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-background/50 backdrop-blur-sm border rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-white/30 transition-colors duration-300 text-sm ${
            signupForm.formState.errors.name ? "border-destructive" : "border-white/10"
          }`}
          placeholder="Your name"
        />
        {signupForm.formState.errors.name && (
          <p className="mt-1.5 text-xs text-destructive">{signupForm.formState.errors.name.message}</p>
        )}
      </div>

      <div>
        <label className="block text-xs sm:text-sm text-muted-foreground mb-1.5">Email address</label>
        <input
          type="email"
          {...signupForm.register("email")}
          autoComplete="email"
          className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-background/50 backdrop-blur-sm border rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-white/30 transition-colors duration-300 text-sm ${
            signupForm.formState.errors.email ? "border-destructive" : "border-white/10"
          }`}
          placeholder="you@example.com"
        />
        {signupForm.formState.errors.email && (
          <p className="mt-1.5 text-xs text-destructive">{signupForm.formState.errors.email.message}</p>
        )}
      </div>

      <div>
        <label className="block text-xs sm:text-sm text-muted-foreground mb-1.5">Password</label>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            {...signupForm.register("password")}
            autoComplete="new-password"
            className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 pr-10 bg-background/50 backdrop-blur-sm border rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-white/30 transition-colors duration-300 text-sm ${
              signupForm.formState.errors.password ? "border-destructive" : "border-white/10"
            }`}
            placeholder="Min 8 chars, uppercase, lowercase, number"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {signupForm.formState.errors.password && (
          <p className="mt-1.5 text-xs text-destructive">{signupForm.formState.errors.password.message}</p>
        )}
      </div>

      <div>
        <label className="block text-xs sm:text-sm text-muted-foreground mb-1.5">Confirm password</label>
        <div className="relative">
          <input
            type={showConfirmPassword ? "text" : "password"}
            {...signupForm.register("confirmPassword")}
            autoComplete="new-password"
            className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 pr-10 bg-background/50 backdrop-blur-sm border rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-white/30 transition-colors duration-300 text-sm ${
              signupForm.formState.errors.confirmPassword ? "border-destructive" : "border-white/10"
            }`}
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {signupForm.formState.errors.confirmPassword && (
          <p className="mt-1.5 text-xs text-destructive">{signupForm.formState.errors.confirmPassword.message}</p>
        )}
      </div>

      <button type="submit" disabled={isLoading} className="w-full mt-4 pill-button justify-center py-2.5 sm:py-3 disabled:opacity-50">
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <>
            <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-background flex items-center justify-center">
              <ArrowRight className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-foreground" />
            </span>
            <span className="text-sm">Create account</span>
          </>
        )}
      </button>
    </form>
  );

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

        {view === "verify" ? renderVerificationView() : (
          <div className={`w-full max-w-md bg-card/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl transition-all duration-300 ${isTransitioning ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-light text-foreground text-center">
              {view === "login" ? "Welcome back" : "Get started"}
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-muted-foreground text-center">
              {view === "login"
                ? "Sign in to your account to continue"
                : "Create an account to start managing your communications"}
            </p>

            {view === "login" ? renderLoginForm() : renderSignupForm()}

            <div className="mt-5 sm:mt-6 flex items-center gap-4">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-xs text-muted-foreground">or</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            <button
              type="button"
              onClick={loginWithGoogle}
              className="w-full mt-5 sm:mt-6 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl py-2.5 sm:py-3 text-sm text-foreground hover:bg-white/10 transition-colors duration-300 flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </button>

            <p className="mt-5 sm:mt-6 text-xs sm:text-sm text-muted-foreground text-center">
              {view === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
              <button 
                type="button" 
                onClick={() => switchView(view === "login" ? "signup" : "login")} 
                className="text-foreground hover:underline transition-all duration-200"
              >
                {view === "login" ? "Sign up" : "Sign in"}
              </button>
            </p>
          </div>
        )}

        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors duration-300 mt-6">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back to home</span>
        </Link>
      </div>
    </div>
  );
};

export default Auth;
