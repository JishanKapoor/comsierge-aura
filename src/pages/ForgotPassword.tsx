import { useState, useEffect } from "react";
import { ArrowLeft, ArrowRight, Loader2, Mail, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/contexts/AuthContext";
import { forgotPasswordSchema, ForgotPasswordFormData } from "@/lib/validations";
import { preloadedImages } from "@/hooks/useImagePreloader";
import Logo from "@/components/Logo";

const ForgotPassword = () => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { requestPasswordReset, isLoading } = useAuth();

  // Preload background image
  useEffect(() => {
    const img = new Image();
    img.onload = () => setImageLoaded(true);
    img.src = preloadedImages.heroNyc;
  }, []);

  const form = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const handleSubmit = async (data: ForgotPasswordFormData) => {
    const success = await requestPasswordReset(data.email);
    if (success) {
      setIsSubmitted(true);
    }
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

        {/* Card */}
        <div className="w-full max-w-md bg-card/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl">
          {!isSubmitted ? (
            <>
              <div className="flex justify-center mb-6">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mail className="w-6 h-6 sm:w-7 sm:h-7 text-primary" />
                </div>
              </div>

              <h1 className="text-xl sm:text-2xl md:text-3xl font-light text-foreground text-center">
                Forgot your password?
              </h1>
              <p className="mt-2 text-xs sm:text-sm text-muted-foreground text-center">
                No worries, we'll send you reset instructions to your email
              </p>

              <form onSubmit={form.handleSubmit(handleSubmit)} className="mt-6 sm:mt-8 space-y-4">
                <div>
                  <label className="block text-xs sm:text-sm text-muted-foreground mb-1.5">Email address</label>
                  <input
                    type="email"
                    {...form.register("email")}
                    className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-background/50 backdrop-blur-sm border rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-white/30 transition-colors duration-300 text-sm ${
                      form.formState.errors.email ? "border-destructive" : "border-white/10"
                    }`}
                    placeholder="you@example.com"
                    autoFocus
                  />
                  {form.formState.errors.email && (
                    <p className="mt-1.5 text-xs text-destructive">{form.formState.errors.email.message}</p>
                  )}
                </div>

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
                      <span className="text-sm">Send reset link</span>
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 text-center">
                <Link 
                  to="/auth" 
                  className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors duration-300 inline-flex items-center gap-2"
                >
                  <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4" />
                  Back to sign in
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-center mb-6">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 sm:w-7 sm:h-7 text-green-500" />
                </div>
              </div>

              <h1 className="text-xl sm:text-2xl md:text-3xl font-light text-foreground text-center">
                Check your email
              </h1>
              <p className="mt-2 text-xs sm:text-sm text-muted-foreground text-center">
                We've sent a password reset link to
              </p>
              <p className="mt-1 text-sm font-medium text-foreground text-center">
                {form.getValues("email")}
              </p>

              <div className="mt-6 bg-primary/5 border border-primary/10 rounded-xl p-4">
                <p className="text-xs text-muted-foreground text-center">
                  Didn't receive the email? Check your spam folder or{" "}
                  <button
                    type="button"
                    onClick={() => setIsSubmitted(false)}
                    className="text-foreground hover:underline font-medium"
                  >
                    try another email address
                  </button>
                </p>
              </div>

              <div className="mt-6 text-center">
                <Link 
                  to="/auth" 
                  className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors duration-300 inline-flex items-center gap-2"
                >
                  <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4" />
                  Back to sign in
                </Link>
              </div>
            </>
          )}
        </div>

        {!isSubmitted && (
          <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors duration-300 mt-6">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back to home</span>
          </Link>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
