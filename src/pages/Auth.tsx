import { useState, useEffect } from "react";
import { ArrowRight, ArrowLeft, Eye, EyeOff, Loader2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/contexts/AuthContext";
import { loginSchema, signupSchema, LoginFormData, SignupFormData } from "@/lib/validations";
import { preloadedImages } from "@/hooks/useImagePreloader";
import Logo from "@/components/Logo";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const navigate = useNavigate();
  const { login, signup, loginWithGoogle, isLoading } = useAuth();

  // Preload background image
  useEffect(() => {
    const img = new Image();
    img.onload = () => setImageLoaded(true);
    img.src = preloadedImages.heroNyc;
  }, []);

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const signupForm = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  });

  const handleLoginSubmit = async (data: LoginFormData) => {
    const loggedInUser = await login(data.email, data.password);
    if (loggedInUser) {
      if (loggedInUser.role === "admin") {
        navigate("/admin");
      } else if (!loggedInUser.phoneNumber) {
        // No phone number assigned yet
        navigate("/select-number");
      } else if (!loggedInUser.forwardingNumber) {
        // Phone assigned but no forwarding set up
        navigate("/setup-forwarding");
      } else {
        navigate("/dashboard");
      }
    }
  };

  const handleSignupSubmit = async (data: SignupFormData) => {
    const success = await signup(data.name, data.email, data.password);
    if (success) {
      navigate("/select-number");
    }
  };

  const toggleMode = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setIsLogin(!isLogin);
      loginForm.reset();
      signupForm.reset();
      setTimeout(() => setIsTransitioning(false), 50);
    }, 150);
  };

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

        {/* Card with smooth transition */}
        <div className={`w-full max-w-md bg-card/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl transition-all duration-300 ${isTransitioning ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-light text-foreground text-center">
            {isLogin ? "Welcome back" : "Get started"}
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-muted-foreground text-center">
            {isLogin
              ? "Sign in to your account to continue"
              : "Create an account to start managing your communications"}
          </p>

          {isLogin ? (
            <form onSubmit={loginForm.handleSubmit(handleLoginSubmit)} className="mt-6 sm:mt-8 space-y-3 sm:space-y-4">
              <div>
                <label className="block text-xs sm:text-sm text-muted-foreground mb-1.5">Email address</label>
                <input
                  type="text"
                  {...loginForm.register("email")}
                  className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-background/50 backdrop-blur-sm border rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-white/30 transition-colors duration-300 text-sm ${
                    loginForm.formState.errors.email ? "border-destructive" : "border-white/10"
                  }`}
                  placeholder="you@example.com or admin"
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
          ) : (
            <form onSubmit={signupForm.handleSubmit(handleSignupSubmit)} className="mt-6 sm:mt-8 space-y-3 sm:space-y-4">
              <div>
                <label className="block text-xs sm:text-sm text-muted-foreground mb-1.5">Full name</label>
                <input
                  type="text"
                  {...signupForm.register("name")}
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
          )}

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
            {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
            <button type="button" onClick={toggleMode} className="text-foreground hover:underline transition-all duration-200">
              {isLogin ? "Sign up" : "Sign in"}
            </button>
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

export default Auth;
