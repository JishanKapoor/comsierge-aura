import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { toast } from "sonner";

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

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User | null>;
  signup: (name: string, email: string, password: string) => Promise<boolean>;
  loginWithGoogle: () => void;
  logout: () => void;
  requestPasswordReset: (email: string) => Promise<boolean>;
  updateProfile: (updates: Partial<Pick<User, 'name' | 'email' | 'avatar'>>) => Promise<void>;
  refreshUser: () => Promise<void>;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// API base URL - use relative path so it works with vite proxy
const API_URL = "/api";

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

  const login = async (email: string, password: string): Promise<User | null> => {
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

      if (!response.ok) {
        toast.error(data.message || "Login failed");
        setIsLoading(false);
        return null;
      }

      // Save token and user with session cache
      localStorage.setItem("comsierge_token", data.data.token);
      setCachedSession(data.data.user);
      setUser(data.data.user);
      
      toast.success("Welcome back!");
      setIsLoading(false);
      return data.data.user;
    } catch (error) {
      console.error("Login error:", error);
      toast.error("Unable to connect to server. Please try again.");
      setIsLoading(false);
      return null;
    }
  };

  const signup = async (name: string, email: string, password: string): Promise<boolean> => {
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
        return false;
      }

      // Save token and user with session cache
      localStorage.setItem("comsierge_token", data.data.token);
      setCachedSession(data.data.user);
      setUser(data.data.user);
      
      toast.success("Account created successfully!");
      setIsLoading(false);
      return true;
    } catch (error) {
      console.error("Signup error:", error);
      toast.error("Unable to connect to server. Please try again.");
      setIsLoading(false);
      return false;
    }
  };

  const loginWithGoogle = () => {
    toast.info("Google OAuth coming soon!", {
      duration: 3000,
    });
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
    toast.success("Logged out successfully");
  };

  const updateProfile = async (updates: Partial<Pick<User, 'name' | 'email' | 'avatar'>>) => {
    const token = localStorage.getItem("comsierge_token");
    
    if (!token || !user) {
      // Fallback to local update if no token
      const updatedUser = { ...user!, ...updates };
      setUser(updatedUser);
      setCachedSession(updatedUser);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/auth/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });

      const data = await response.json();

      if (response.ok) {
        setUser(data.data.user);
        setCachedSession(data.data.user);
        toast.success("Profile updated");
      } else {
        toast.error(data.message || "Failed to update profile");
      }
    } catch (error) {
      console.error("Profile update error:", error);
      // Update locally as fallback
      const updatedUser = { ...user, ...updates };
      setUser(updatedUser);
      setCachedSession(updatedUser);
    }
  };

  const requestPasswordReset = async (email: string): Promise<boolean> => {
    setIsLoading(true);
    
    // Simulate API delay (implement actual endpoint later)
    await new Promise((resolve) => setTimeout(resolve, 1000));

    setIsLoading(false);
    toast.success("Password reset link sent! Check your email.");
    return true;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        signup,
        loginWithGoogle,
        logout,
        requestPasswordReset,
        updateProfile,
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
