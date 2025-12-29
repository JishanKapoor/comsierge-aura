import { useState, useEffect, useRef } from "react";
import { ArrowLeft, ArrowRight, Loader2, Phone, CheckCircle2, ChevronDown } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { preloadedImages } from "@/hooks/useImagePreloader";
import Logo from "@/components/Logo";
import { toast } from "sonner";
import { loadTwilioAccounts } from "@/components/dashboard/adminStore";

const API_URL = "/api";

const SelectNumber = () => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [availableNumbers, setAvailableNumbers] = useState<string[]>([]);
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingNumbers, setIsFetchingNumbers] = useState(true);
  const [isConfirmed, setIsConfirmed] = useState(false);
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
    if (user?.phoneNumber) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  // Preload background image
  useEffect(() => {
    const img = new Image();
    img.onload = () => setImageLoaded(true);
    img.src = preloadedImages.heroNyc;
  }, []);

  // Load available phone numbers from backend
  useEffect(() => {
    const fetchAvailableNumbers = async () => {
      setIsFetchingNumbers(true);
      try {
        // Get Twilio accounts from local storage (admin-added phones)
        const twilioAccounts = loadTwilioAccounts();
        const allPhones = twilioAccounts.flatMap((acc) => acc.phoneNumbers);
        
        // Get all users from backend to know which phones are assigned
        const response = await fetch(`${API_URL}/auth/users`);
        const data = await response.json();
        
        if (data.success) {
          // Get assigned phones from backend users
          const assignedPhones = data.data
            .filter((u: any) => u.phoneNumber)
            .map((u: any) => u.phoneNumber);
          
          // Filter to get available phones
          const available = allPhones.filter((phone) => !assignedPhones.includes(phone));
          setAvailableNumbers(available);
          setSelectedNumber(available[0] || null);
        } else {
          setAvailableNumbers(allPhones);
          setSelectedNumber(allPhones[0] || null);
        }
      } catch (error) {
        console.error("Failed to fetch available numbers:", error);
        // Fallback to all phones from Twilio accounts
        const twilioAccounts = loadTwilioAccounts();
        const allPhones = twilioAccounts.flatMap((acc) => acc.phoneNumbers);
        setAvailableNumbers(allPhones);
        setSelectedNumber(allPhones[0] || null);
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
      // Save the assignment via backend API
      const response = await fetch(`${API_URL}/auth/users/${user.id}/phone`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: selectedNumber }),
      });

      if (!response.ok) {
        throw new Error("Failed to assign phone number");
      }

      // Refresh user data to get the updated phone number
      await refreshUser();
      
      setIsConfirmed(true);
      toast.success("Number assigned successfully!");
    } catch (error) {
      console.error("Failed to assign number:", error);
      toast.error("Failed to assign number. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinueToDashboard = () => {
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
    </div>
  );
};

export default SelectNumber;
