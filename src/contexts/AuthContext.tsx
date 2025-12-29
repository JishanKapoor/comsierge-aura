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
  const [user, setUser] = useState<User | null>(() => {
    // Try to restore user immediately from cache for faster initial render
    const cached = getCachedSession();
    if (cached) return cached.user;
    
    // Fallback to localStorage
    try {
      const stored = localStorage.getItem("comsierge_user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState(true);

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
      } else {
        // Token invalid, clear storage
        localStorage.removeItem("comsierge_token");
        localStorage.removeItem("comsierge_user");
        clearSessionCache();
        return null;
      }
    } catch (error) {
      console.error("Auth check failed:", error);
      // Server might be down, try to use cached user from localStorage
      const cachedUser = localStorage.getItem("comsierge_user");
      if (cachedUser) {
        try {
          return JSON.parse(cachedUser);
        } catch {
          localStorage.removeItem("comsierge_user");
        }
      }
      return null;
    }
  }, []);

  // Check for existing session on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem("comsierge_token");
      if (!token) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      // If we already have a cached user from initial state, just validate in background
      if (user) {
        setIsLoading(false);
        // Validate token in background (don't block UI)
        fetchCurrentUser(token).then((userData) => {
          if (!userData) {
            setUser(null);
          } else if (JSON.stringify(userData) !== JSON.stringify(user)) {
            setUser(userData);
          }
        });
        return;
      }

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
