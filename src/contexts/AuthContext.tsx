import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export type UserRole = "user" | "admin";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (name: string, email: string, password: string) => Promise<boolean>;
  loginWithGoogle: () => void;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Demo users for frontend-only mode
const DEMO_USERS: User[] = [
  {
    id: "admin-001",
    email: "admin",
    name: "Admin User",
    role: "admin",
  },
  {
    id: "user-001",
    email: "user",
    name: "Demo User",
    role: "user",
  },
];

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session on mount
    const storedUser = localStorage.getItem("comsierge_user");
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem("comsierge_user");
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 800));

    // Demo admin login
    if (email === "admin" && password === "admin") {
      const adminUser = DEMO_USERS.find((u) => u.email === "admin");
      if (adminUser) {
        setUser(adminUser);
        localStorage.setItem("comsierge_user", JSON.stringify(adminUser));
        setIsLoading(false);
        toast.success("Welcome back, Admin!");
        return true;
      }
    }

    // Demo user login
    if (email === "user" && password === "user") {
      const demoUser = DEMO_USERS.find((u) => u.email === "user");
      if (demoUser) {
        setUser(demoUser);
        localStorage.setItem("comsierge_user", JSON.stringify(demoUser));
        setIsLoading(false);
        toast.success("Welcome back!");
        return true;
      }
    }

    // Regular user login (demo mode - accept any valid email/password)
    const newUser: User = {
      id: `user-${Date.now()}`,
      email,
      name: email.split("@")[0],
      role: "user",
    };
    setUser(newUser);
    localStorage.setItem("comsierge_user", JSON.stringify(newUser));
    setIsLoading(false);
    toast.success("Welcome back!");
    return true;
  };

  const signup = async (name: string, email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 800));

    const newUser: User = {
      id: `user-${Date.now()}`,
      email,
      name,
      role: "user",
    };
    setUser(newUser);
    localStorage.setItem("comsierge_user", JSON.stringify(newUser));
    setIsLoading(false);
    toast.success("Account created successfully!");
    return true;
  };

  const loginWithGoogle = () => {
    toast.info("Google OAuth requires backend integration. Please enable Lovable Cloud for full functionality.", {
      duration: 5000,
    });
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("comsierge_user");
    toast.success("Logged out successfully");
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
