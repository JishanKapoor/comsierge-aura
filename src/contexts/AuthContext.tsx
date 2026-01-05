import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { toast } from "sonner";
import { API_BASE_URL } from "@/config";

export type UserRole = "user" | "admin";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  plan?: string;
  phoneNumber?: string | null;
  personalPhoneNumber?: string | null;
  forwardingNumber?: string | null;
  createdAt?: string;
}

interface SignupResult {
  success: boolean;
  requiresVerification?: boolean;
  email?: string;
  message?: string;
}

interface LoginResult {
  user: User | null;
  requiresVerification?: boolean;
  email?: string;
  useGoogle?: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  signup: (name: string, email: string, password: string) => Promise<SignupResult>;
  verifyEmail: (email: string, otp: string) => Promise<User | null>;
  resendOTP: (email: string) => Promise<boolean>;
  loginWithGoogle: () => void;
  logout: () => void;
  requestPasswordReset: (email: string) => Promise<boolean>;
  refreshUser: () => Promise<void>;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// API base URL - uses env var in production, proxy in dev
const API_URL = `${API_BASE_URL}/api`;

// Session cache configuration
const SESSION_CACHE_KEY = "comsierge_session_cache";
const SESSION_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes - refetch user data after this

interface SessionCache {
  user: User;
  timestamp: number;
}

// Helper to get cached session
const getCachedSession = (): SessionCache | null => {
  try {
    const cached = sessionStorage.getItem(SESSION_CACHE_KEY);
    if (cached) {
      const session: SessionCache = JSON.parse(cached);
      const isValid = Date.now() - session.timestamp < SESSION_CACHE_DURATION;
      if (isValid) {
        return session;
      }
    }
  } catch {
    sessionStorage.removeItem(SESSION_CACHE_KEY);
  }
  return null;
};

// Helper to set session cache
const setCachedSession = (user: User) => {
  const session: SessionCache = { user, timestamp: Date.now() };
  sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(session));
  localStorage.setItem("comsierge_user", JSON.stringify(user));
};

// Helper to clear session cache
const clearSessionCache = () => {
  sessionStorage.removeItem(SESSION_CACHE_KEY);
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  // Restore user synchronously from storage
  const [user, setUser] = useState<User | null>(() => {
    const cached = getCachedSession();
    if (cached) return cached.user;
    
    try {
      const stored = localStorage.getItem("comsierge_user");
      const token = localStorage.getItem("comsierge_token");
      if (stored && token) {
        return JSON.parse(stored);
      }
      return null;
    } catch {
      return null;
    }
  });
  
  // If we already have a user from storage, we're not "loading"
  const [isLoading, setIsLoading] = useState(() => {
    const token = localStorage.getItem("comsierge_token");
    const stored = localStorage.getItem("comsierge_user");
    // Only loading if we have token but no cached user yet
    return !!(token && !stored);
  });

  // Function to fetch current user from server
  const fetchCurrentUser = useCallback(async (token: string, forceRefresh = false): Promise<User | null> => {
    // Check session cache first (unless forced refresh)
    if (!forceRefresh) {
      const cached = getCachedSession();
      if (cached) {
        return cached.user;
      }
    }
    
    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const userData: User = {
          ...data.data.user,
          phoneNumber: data.data.user.phoneNumber || null,
        };
        setCachedSession(userData);
        return userData;
      } else if (response.status === 401) {
        // Token explicitly invalid/expired - clear storage
        console.log("Token invalid (401), clearing auth");
        localStorage.removeItem("comsierge_token");
        localStorage.removeItem("comsierge_user");
        clearSessionCache();
        return null;
      } else {
        // Other server error (500, etc) - try to use cached user
        console.log("Server error, using cached user");
        const cachedUser = localStorage.getItem("comsierge_user");
        if (cachedUser) {
          try {
            return JSON.parse(cachedUser);
          } catch {
            // ignore
          }
        }
        return null;
      }
    } catch (error) {
      console.error("Auth check failed:", error);
      // Server might be down, try to use cached user from localStorage
      // Keep the user logged in with cached data - don't force logout on network errors
      const cachedUser = localStorage.getItem("comsierge_user");
      if (cachedUser) {
        try {
          const parsed = JSON.parse(cachedUser);
          console.log("Using cached user due to server unavailable");
          return parsed;
        } catch {
          // Only clear if parse fails, not on network error
          localStorage.removeItem("comsierge_user");
        }
      }
      // No cached user and server is down - return null to show login
      return null;
    }
  }, []);

  // Check for existing session on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem("comsierge_token");
      const storedUser = localStorage.getItem("comsierge_user");
      
      // No token = not logged in
      if (!token) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      // If we have both token and stored user, USE IT immediately
      // Don't wait for server validation - the user is logged in
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
          setIsLoading(false);
          
          // Validate in background - but DON'T logout on any error
          fetchCurrentUser(token).then((userData) => {
            if (userData) {
              // Update with fresh data if available
              setUser(userData);
            }
            // If validation fails, keep the cached user - don't logout
          }).catch(() => {
            // Network error - keep cached user
          });
          return;
        } catch {
          // Parse error - try server
        }
      }
      
      // No stored user - try to fetch from server
      const userData = await fetchCurrentUser(token);
      setUser(userData);
      setIsLoading(false);
    };

    checkAuth();
  }, [fetchCurrentUser]);

  // Refresh user data from server (force refresh)
  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem("comsierge_token");
    if (!token) return;
    
    const userData = await fetchCurrentUser(token, true);
    if (userData) {
      setUser(userData);
    }
  }, [fetchCurrentUser]);

  const login = async (email: string, password: string): Promise<LoginResult> => {
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      // Handle email verification required
      if (response.status === 403 && data.requiresVerification) {
        toast.info("Please verify your email. A new code has been sent.");
        setIsLoading(false);
        return { 
          user: null, 
          requiresVerification: true, 
          email: data.email 
        };
      }

      // Handle Google-only account
      if (response.status === 401 && data.useGoogle) {
        toast.error(data.message);
        setIsLoading(false);
        return { user: null, useGoogle: true };
      }

      if (!response.ok) {
        toast.error(data.message || "Login failed");
        setIsLoading(false);
        return { user: null };
      }

      // Save token and user with session cache
      localStorage.setItem("comsierge_token", data.data.token);
      setCachedSession(data.data.user);
      setUser(data.data.user);
      
      toast.success("Welcome back!");
      setIsLoading(false);
      return { user: data.data.user };
    } catch (error) {
      console.error("Login error:", error);
      toast.error("Unable to connect to server. Please try again.");
      setIsLoading(false);
      return { user: null };
    }
  };

  const signup = async (name: string, email: string, password: string): Promise<SignupResult> => {
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.message || "Signup failed");
        setIsLoading(false);
        return { success: false, message: data.message };
      }

      // Direct signup - save token and user
      if (data.data?.token) {
        localStorage.setItem("comsierge_token", data.data.token);
        const userData = {
          id: data.data.user.id,
          email: data.data.user.email,
          name: data.data.user.name,
          role: data.data.user.role,
          avatar: data.data.user.avatar,
          phoneNumber: data.data.user.phoneNumber,
          forwardingNumber: data.data.user.forwardingNumber,
        };
        localStorage.setItem("comsierge_user", JSON.stringify(userData));
        setCachedSession(userData);
        setUser(userData);
      }
      
      toast.success("Account created successfully!");
      setIsLoading(false);
      return { success: true };
    } catch (error) {
      console.error("Signup error:", error);
      toast.error("Unable to connect to server. Please try again.");
      setIsLoading(false);
      return { success: false, message: "Connection error" };
    }
  };

  const verifyEmail = async (email: string, otp: string): Promise<User | null> => {
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/verify-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, otp }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.expired) {
          toast.error("Code expired. Please request a new one.");
        } else {
          toast.error(data.message || "Verification failed");
        }
        setIsLoading(false);
        return null;
      }

      // Save token and user with session cache
      localStorage.setItem("comsierge_token", data.data.token);
      setCachedSession(data.data.user);
      setUser(data.data.user);
      
      toast.success("Email verified successfully!");
      setIsLoading(false);
      return data.data.user;
    } catch (error) {
      console.error("Verify email error:", error);
      toast.error("Unable to connect to server. Please try again.");
      setIsLoading(false);
      return null;
    }
  };

  const resendOTP = async (email: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_URL}/auth/resend-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.message || "Failed to resend code");
        return false;
      }

      toast.success("New verification code sent!");
      return true;
    } catch (error) {
      console.error("Resend OTP error:", error);
      toast.error("Unable to connect to server.");
      return false;
    }
  };

  const loginWithGoogle = async () => {
    try {
      // Load Google Identity Services script if not already loaded
      if (!window.google) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://accounts.google.com/gsi/client';
          script.async = true;
          script.defer = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load Google Sign-In'));
          document.head.appendChild(script);
        });
      }

      // Initialize Google Sign-In
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: '320917556164-gncrlmkhm6v412dl7h3ju3l8e2imc2lu.apps.googleusercontent.com',
        scope: 'email profile',
        callback: async (tokenResponse: { access_token?: string; error?: string; error_description?: string }) => {
          if (tokenResponse.error) {
            console.error('Google OAuth error:', tokenResponse.error, tokenResponse.error_description);
            toast.error('Google sign-in was cancelled');
            return;
          }

          if (!tokenResponse.access_token) {
            console.error('No access token received from Google');
            toast.error('Google sign-in failed - no token received');
            return;
          }

          try {
            setIsLoading(true);
            console.log('Sending access token to backend...');
            
            // Send access token to backend
            const response = await fetch(`${API_URL}/auth/google`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ accessToken: tokenResponse.access_token }),
            });

            const data = await response.json();
            console.log('Backend response:', response.status, data);

            if (!response.ok) {
              toast.error(data.message || 'Google sign-in failed');
              setIsLoading(false);
              return;
            }

            // Store token and user
            localStorage.setItem('comsierge_token', data.data.token);
            const userData = {
              id: data.data.user.id,
              email: data.data.user.email,
              name: data.data.user.name,
              role: data.data.user.role,
              phoneNumber: data.data.user.phoneNumber,
              forwardingNumber: data.data.user.forwardingNumber,
            };
            localStorage.setItem('comsierge_user', JSON.stringify(userData));
            setUser(userData);

            if (data.data.linked) {
              toast.success('Google account linked successfully!');
            } else if (data.data.isNew) {
              toast.success('Account created with Google!');
            } else {
              toast.success('Signed in with Google!');
            }

            setIsLoading(false);
          } catch (error) {
            console.error('Google auth backend error:', error);
            toast.error('Failed to complete Google sign-in. Please try again.');
            setIsLoading(false);
          }
        },
      });

      // Trigger the sign-in flow
      client.requestAccessToken();
    } catch (error) {
      console.error('Google Sign-In initialization error:', error);
      toast.error('Failed to initialize Google Sign-In. Please refresh and try again.');
    }
  };

  const logout = () => {
    setUser(null);
    // Clear all auth-related storage
    localStorage.removeItem("comsierge_token");
    localStorage.removeItem("comsierge_user");
    clearSessionCache();
    // Clear app data on logout (messages, contacts, etc.)
    localStorage.removeItem("comsierge.inbox.messages");
    localStorage.removeItem("comsierge.inbox.pinned");
    localStorage.removeItem("comsierge.inbox.muted");
    localStorage.removeItem("comsierge.inbox.transferPrefs");
    localStorage.removeItem("comsierge.inbox.languages");
    localStorage.removeItem("comsierge.contacts");
    localStorage.removeItem("comsierge_rules");
  };

  const requestPasswordReset = async (email: string): Promise<boolean> => {
    setIsLoading(true);
    
    try {
      const response = await fetch(`${API_URL}/auth/forgot-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.message || "Failed to send reset link");
        setIsLoading(false);
        return false;
      }

      toast.success("If an account exists with this email, you will receive a password reset link.");
      setIsLoading(false);
      return true;
    } catch (error) {
      console.error("Password reset error:", error);
      toast.error("Unable to connect to server. Please try again.");
      setIsLoading(false);
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        signup,
        verifyEmail,
        resendOTP,
        loginWithGoogle,
        logout,
        requestPasswordReset,
        refreshUser,
        isAuthenticated: !!user,
        isAdmin: user?.role === "admin",
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
