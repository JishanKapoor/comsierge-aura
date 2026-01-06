import { useState, useEffect } from "react";
import { ArrowLeft, ArrowRight, Loader2, PhoneForwarded, CheckCircle2, Phone } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { preloadedImages } from "@/hooks/useImagePreloader";
import { isValidUsPhoneNumber, normalizeUsPhoneDigits } from "@/lib/validations";
import Logo from "@/components/Logo";
import { toast } from "sonner";
import { API_BASE_URL } from "@/config";

const API_URL = `${API_BASE_URL}/api`;

const SetupForwarding = () => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [forwardingNumber, setForwardingNumber] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { user, isAuthenticated, refreshUser } = useAuth();

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/auth");
    }
  }, [isAuthenticated, navigate]);

  // Redirect if user doesn't have a phone number yet
  useEffect(() => {
    if (user && !user.phoneNumber) {
      navigate("/select-number");
    }
  }, [user, navigate]);

  // Pre-populate if user already has a forwarding number
  useEffect(() => {
    if (user?.forwardingNumber && !forwardingNumber) {
      setForwardingNumber(user.forwardingNumber);
    }
  }, [user]);

  // Preload background image
  useEffect(() => {
    const img = new Image();
    img.onload = () => setImageLoaded(true);
    img.src = preloadedImages.heroNyc;
  }, []);

  // Format phone number as user types
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow only digits, spaces, dashes, parentheses, and plus
    const cleaned = value.replace(/[^\d\s\-()+ ]/g, "");
    setForwardingNumber(cleaned);
    setError("");
  };

  const formatPhoneNumber = (phone: string) => {
    const digits = normalizeUsPhoneDigits(phone);
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    if (digits.length === 11 && digits.startsWith("1")) {
      return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    return phone;
  };

  const handleSaveForwarding = async () => {
    if (!user) {
      toast.error("Please log in again");
      return;
    }

    // Validate phone number
    if (!forwardingNumber.trim()) {
      setError("Please enter a phone number");
      return;
    }

    if (!isValidUsPhoneNumber(forwardingNumber)) {
      setError("Please enter a valid US phone number");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      // Convert to E.164 format for storage
      const digits = normalizeUsPhoneDigits(forwardingNumber);
      const e164 = digits.length === 10 ? `+1${digits}` : `+${digits}`;

      const token = localStorage.getItem("comsierge_token");
      if (!token) {
        throw new Error("Please log in again");
      }

      const response = await fetch(`${API_URL}/auth/me/forwarding`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ forwardingNumber: e164 }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to save forwarding number");
      }

      // Refresh user data
      await refreshUser();
      
      setIsConfirmed(true);
      toast.success("Forwarding number saved!");
    } catch (error: any) {
      console.error("Failed to save forwarding number:", error);
      setError(error.message || "Failed to save. Please try again.");
      toast.error(error.message || "Failed to save forwarding number");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    navigate("/dashboard");
  };

  const handleContinue = () => {
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-background">
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
          {!isConfirmed ? (
            <>
              <div className="flex justify-center mb-6">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <PhoneForwarded className="w-6 h-6 sm:w-7 sm:h-7 text-primary" />
                </div>
              </div>

              <h1 className="text-xl sm:text-2xl md:text-3xl font-light text-foreground text-center">
                Forward Incoming Calls
              </h1>
              <p className="mt-2 text-xs sm:text-sm text-muted-foreground text-center">
                Where should we forward calls to your business number?
              </p>

              {/* User's assigned number display */}
              {user?.phoneNumber && (
                <div className="mt-4 bg-primary/5 border border-primary/10 rounded-xl p-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Phone className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Your business number</p>
                    <p className="text-sm font-medium text-foreground">{formatPhoneNumber(user.phoneNumber)}</p>
                  </div>
                </div>
              )}

              <div className="mt-6 space-y-4">
                <div>
                  <label className="block text-xs sm:text-sm text-muted-foreground mb-1.5">
                    Your personal phone number
                  </label>
                  <input
                    type="tel"
                    value={forwardingNumber}
                    onChange={handlePhoneChange}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && forwardingNumber && isValidUsPhoneNumber(forwardingNumber)) {
                        handleSaveForwarding();
                      }
                    }}
                    className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-background/50 backdrop-blur-sm border rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-white/30 transition-colors duration-300 text-sm ${
                      error ? "border-destructive" : "border-white/10"
                    }`}
                    placeholder="(555) 123-4567"
                    autoFocus
                  />
                  {error && (
                    <p className="mt-1.5 text-xs text-destructive">{error}</p>
                  )}
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Incoming calls will ring on this phone
                  </p>
                </div>

                <button
                  onClick={handleSaveForwarding}
                  disabled={isLoading || !forwardingNumber}
                  className="w-full pill-button justify-center py-2.5 sm:py-3 disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-background flex items-center justify-center">
                        <ArrowRight className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-foreground" />
                      </span>
                      <span className="text-sm">Save & Continue</span>
                    </>
                  )}
                </button>
              </div>

              <div className="mt-6 bg-white/5 border border-white/10 rounded-xl p-4">
                <p className="text-xs text-muted-foreground text-center">
                  You can change this later in{" "}
                  <span className="text-foreground font-medium">Routing</span>
                </p>
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
                You're all set!
              </h1>
              <p className="mt-2 text-xs sm:text-sm text-muted-foreground text-center">
                Incoming calls will be forwarded to
              </p>
              <p className="mt-1 text-sm font-medium text-foreground text-center">
                {formatPhoneNumber(forwardingNumber)}
              </p>

              <div className="mt-6 space-y-4">
                <div className="bg-primary/5 border border-primary/10 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <Phone className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium text-foreground">How it works</span>
                  </div>
                  <ul className="text-xs text-muted-foreground space-y-1.5 ml-7">
                    <li>• When someone calls your business number, your phone will ring</li>
                    <li>• The caller ID will show your business number</li>
                    <li>• Answer from anywhere on your personal phone</li>
                  </ul>
                </div>

                <button
                  onClick={handleContinue}
                  className="w-full pill-button justify-center py-2.5 sm:py-3"
                >
                  <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-background flex items-center justify-center">
                    <ArrowRight className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-foreground" />
                  </span>
                  <span className="text-sm">Go to Dashboard</span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Back link */}
        {!isConfirmed && (
          <div className="mt-6 text-center">
            <Link
              to="/select-number"
              className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors duration-300 inline-flex items-center gap-2"
            >
              <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4" />
              Back to number selection
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default SetupForwarding;
