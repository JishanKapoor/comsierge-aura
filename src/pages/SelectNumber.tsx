import { useState, useEffect, useRef } from "react";
import { ArrowLeft, ArrowRight, Loader2, Phone, CheckCircle2, ChevronDown } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { preloadedImages } from "@/hooks/useImagePreloader";
import Logo from "@/components/Logo";
import { toast } from "sonner";
import { API_BASE_URL } from "@/config";
import AppFooter from "@/components/AppFooter";

const API_URL = `${API_BASE_URL}/api`;

const SelectNumber = () => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [availableNumbers, setAvailableNumbers] = useState<string[]>([]);
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingNumbers, setIsFetchingNumbers] = useState(true);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const isConfirmedRef = useRef(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { user, isAuthenticated, refreshUser } = useAuth();

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/auth");
    }
  }, [isAuthenticated, navigate]);

  // Redirect if user already has a phone number
  useEffect(() => {
    // If the user already has a phone number when loading this page,
    // and we are not in the middle of a confirmation flow, redirect to dashboard.
    // We use a ref to track if a confirmation just happened, which is safer than state
    // inside a useEffect that depends on 'user'.
    if (user?.phoneNumber && !isConfirmedRef.current && !isConfirmed) {
      navigate("/dashboard");
    }
  }, [user, navigate, isConfirmed]);

  // Preload background image
  useEffect(() => {
    const img = new Image();
    img.src = preloadedImages.heroNyc;
    if (img.complete) {
      setImageLoaded(true);
    } else {
      img.onload = () => setImageLoaded(true);
    }
  }, []);

  // Load available phone numbers from backend
  useEffect(() => {
    const fetchAvailableNumbers = async () => {
      setIsFetchingNumbers(true);
      try {
        const token = localStorage.getItem("comsierge_token");
        if (!token) {
          navigate("/auth", { replace: true });
          return;
        }

        const response = await fetch(`${API_URL}/auth/available-phones`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.message || "Failed to load available numbers");
        }

        const available = (data.data?.available || []) as string[];
        setAvailableNumbers(available);
        setSelectedNumber(available[0] || null);
      } catch (error) {
        console.error("Failed to fetch available numbers:", error);
        setAvailableNumbers([]);
        setSelectedNumber(null);
      } finally {
        setIsFetchingNumbers(false);
      }
    };

    fetchAvailableNumbers();
  }, []);

  const formatPhoneNumber = (phone: string) => {
    // Format +1XXXXXXXXXX to +1 (XXX) XXX-XXXX
    if (phone.startsWith("+1") && phone.length === 12) {
      return `+1 (${phone.slice(2, 5)}) ${phone.slice(5, 8)}-${phone.slice(8)}`;
    }
    return phone;
  };

  const handleConfirmNumber = async () => {
    if (!selectedNumber || !user) {
      toast.error("Please select a phone number");
      return;
    }

    setIsLoading(true);

    try {
      const token = localStorage.getItem("comsierge_token");
      if (!token) {
        toast.error("Please log in again");
        navigate("/auth", { replace: true });
        return;
      }

      // Save the assignment via backend API (current user)
      const response = await fetch(`${API_URL}/auth/me/phone`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ phoneNumber: selectedNumber }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to assign phone number");
      }

      // Update ref immediately to block the auto-redirect in useEffect
      isConfirmedRef.current = true;

      // Update state to show success screen immediately to prevent
      // the useEffect from redirecting to dashboard prematurely
      setIsConfirmed(true);

      // DON'T refresh user here - that would trigger Dashboard's redirect logic
      // We'll refresh when user clicks "Continue"
      
      toast.success("Number assigned successfully!");
    } catch (error) {
      console.error("Failed to assign number:", error);
      toast.error("Failed to assign number. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinueToDashboard = async () => {
    // Refresh user data now before navigating
    await refreshUser();
    navigate("/setup-forwarding");
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-background flex flex-col">
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
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-8 sm:py-12">
        {/* Logo */}
        <div className="w-full max-w-md mb-6 sm:mb-8 flex justify-center">
          <Link to="/" className="text-xl sm:text-2xl">
            <Logo />
          </Link>
        </div>

        {/* Card */}
        <div className="w-full max-w-md bg-card/40 backdrop-blur-xl border border-white/10 rounded-3xl px-6 sm:px-8 py-8 sm:py-10 shadow-2xl">
          {!isConfirmed ? (
            <>
              <div className="flex justify-center mb-6">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <Phone className="w-6 h-6 sm:w-7 sm:h-7 text-primary" />
                </div>
              </div>

              <h1 className="text-xl sm:text-2xl md:text-3xl font-light text-foreground text-center">
                Choose your number
              </h1>
              <p className="mt-2 text-xs sm:text-sm text-muted-foreground text-center">
                Select a Comsierge number for your AI-powered communications
              </p>

              <div className="mt-6 sm:mt-8 space-y-4">
                {isFetchingNumbers ? (
                  <div className="text-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">
                      Loading available numbers...
                    </p>
                  </div>
                ) : availableNumbers.length > 0 ? (
                  <>
                    <div ref={dropdownRef} className="relative">
                      <label className="block text-xs sm:text-sm text-muted-foreground mb-1.5">
                        Available numbers
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className="w-full px-4 sm:px-5 py-3 sm:py-3 bg-background/50 backdrop-blur-sm border border-white/10 rounded-xl text-left focus:outline-none focus:border-white/30 transition-colors duration-300 text-sm flex items-center justify-between"
                      >
                        <span className={selectedNumber ? "text-foreground" : "text-muted-foreground/50"}>
                          {selectedNumber ? formatPhoneNumber(selectedNumber) : "Select a number..."}
                        </span>
                        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isDropdownOpen ? "rotate-180" : ""}`} />
                      </button>
                      
                      {isDropdownOpen && (
                        <div className="absolute z-50 w-full top-full mt-2 bg-card/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                          <div className="max-h-48 overflow-y-auto">
                            {availableNumbers.map((number) => (
                              <button
                                key={number}
                                type="button"
                                onClick={() => {
                                  setSelectedNumber(number);
                                  setIsDropdownOpen(false);
                                }}
                                className={`w-full px-3 sm:px-4 py-3 text-left text-sm transition-colors duration-150 flex items-center justify-between ${
                                  selectedNumber === number
                                    ? "bg-primary/20 text-foreground"
                                    : "text-foreground/80 hover:bg-white/10"
                                }`}
                              >
                                <span>{formatPhoneNumber(number)}</span>
                                {selectedNumber === number && (
                                  <CheckCircle2 className="w-4 h-4 text-primary" />
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleConfirmNumber}
                      disabled={isLoading || !selectedNumber}
                      className="w-full mt-12 pill-button justify-center py-2.5 sm:py-3 disabled:opacity-50"
                    >
                      {isLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-background flex items-center justify-center">
                            <ArrowRight className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-foreground" />
                          </span>
                          <span className="text-sm">Confirm selection</span>
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground">
                      No numbers available at the moment.
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Please contact support or check back later.
                    </p>
                  </div>
                )}
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
                Your Comsierge number has been assigned
              </p>
              <p className="mt-3 text-lg font-medium text-foreground text-center">
                {formatPhoneNumber(selectedNumber || "")}
              </p>

              <div className="mt-6 bg-primary/5 border border-primary/10 rounded-xl p-4">
                <p className="text-xs text-muted-foreground text-center">
                  Calls and messages to this number will be managed by your AI assistant.
                  You can configure your preferences in the dashboard.
                </p>
              </div>

              <button
                type="button"
                onClick={handleContinueToDashboard}
                className="w-full mt-6 pill-button justify-center py-2.5 sm:py-3"
              >
                <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-background flex items-center justify-center">
                  <ArrowRight className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-foreground" />
                </span>
                <span className="text-sm">Go to dashboard</span>
              </button>
            </>
          )}
        </div>

        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors duration-300 mt-6">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back to home</span>
        </Link>
      </div>

      <AppFooter />
    </div>
  );
};

export default SelectNumber;
