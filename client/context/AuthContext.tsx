import React, { createContext, useContext, useState, useEffect } from "react";
import { authApi, setAuthToken, getAuthToken } from "@/lib/api";

export interface User {
  id: string;
  username: string;
  firstName: string;
  familyName: string;
  email: string;
  mobile: string;
  emirate: string;
  address?: string;
  isVisitor: boolean;
  isAdmin?: boolean;
  role?: string;
}

export interface RegisteredUser extends User {
  password: string;
}

interface PasswordResetRequest {
  email: string;
  mobile: string;
  token: string;
  expiresAt: number;
}

interface AuthContextType {
  user: User | null;
  isLoggedIn: boolean;
  isAdmin: boolean;
  isAuthLoading: boolean;
  login: (user: User) => void;
  loginWithCredentials: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginAdmin: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  register: (user: Omit<User, "id"> & {
    username: string; password: string; deliveryAddress?: {
      label: string;
      fullName: string;
      mobile: string;
      emirate: string;
      area: string;
      street: string;
      building: string;
      floor?: string;
      apartment?: string;
      latitude?: number;
      longitude?: number;
      isDefault: boolean;
    }
  }) => Promise<{ success: boolean; error?: string }>;
  updateUser: (user: Partial<User>) => void;
  requestPasswordReset: (email: string) => Promise<{ success: boolean; error?: string; resetLink?: string }>;
  verifyResetToken: (token: string) => Promise<{ valid: boolean; email?: string }>;
  resetPassword: (token: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  getRegisteredUsers: () => RegisteredUser[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Load user from localStorage on mount and validate token
  useEffect(() => {
    const initAuth = async () => {
      const savedUser = localStorage.getItem("user");
      const token = getAuthToken();

      if (savedUser && token) {
        try {
          // Validate token with backend
          const response = await authApi.getCurrentUser();
          if (response.success && response.data) {
            const userData: User = {
              id: response.data.id,
              username: response.data.username,
              firstName: response.data.firstName,
              familyName: response.data.familyName,
              email: response.data.email,
              mobile: response.data.mobile,
              emirate: response.data.emirate,
              address: response.data.address,
              isVisitor: false,
              isAdmin: response.data.role === "admin",
              role: response.data.role,
            };
            setUser(userData);
            localStorage.setItem("user", JSON.stringify(userData));
          } else {
            // Token explicitly invalid or expired - ONLY clear if we're sure
            // A network failure or temporary server issue shouldn't log the user out
            setAuthToken(null);
            localStorage.removeItem("user");
          }
        } catch (error) {
          // Fallback to local user if API fails (network error)
          try {
            setUser(JSON.parse(savedUser));
          } catch (e) {
            console.error("Failed to parse saved user", e);
          }
        }
      } else if (savedUser) {
        // We have a saved user but no token - this shouldn't happen usually
        // but let's try to restore the user state just in case
        try {
          setUser(JSON.parse(savedUser));
        } catch (e) {
          console.error("Failed to parse saved user", e);
        }
      }
      setIsAuthLoading(false);
    };

    initAuth();
  }, []);

  // Helper to get all registered users from localStorage (for backward compatibility)
  const getRegisteredUsers = (): RegisteredUser[] => {
    const saved = localStorage.getItem("registered_users");
    return saved ? JSON.parse(saved) : [];
  };

  // Helper to save registered users to localStorage
  const saveRegisteredUsers = (users: RegisteredUser[]) => {
    localStorage.setItem("registered_users", JSON.stringify(users));
  };

  // Helper to get password reset requests
  const getResetRequests = (): PasswordResetRequest[] => {
    const saved = localStorage.getItem("password_reset_requests");
    return saved ? JSON.parse(saved) : [];
  };

  // Helper to save password reset requests
  const saveResetRequests = (requests: PasswordResetRequest[]) => {
    localStorage.setItem("password_reset_requests", JSON.stringify(requests));
  };

  const login = (newUser: User) => {
    setUser(newUser);
    localStorage.setItem("user", JSON.stringify(newUser));
  };

  const loginWithCredentials = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await authApi.login(username, password);

      if (response.success && response.data) {
        // Set auth token
        setAuthToken(response.data.token);

        // Create user object
        const userData: User = {
          id: response.data.user.id,
          username: response.data.user.username,
          firstName: response.data.user.firstName,
          familyName: response.data.user.familyName,
          email: response.data.user.email,
          mobile: response.data.user.mobile,
          emirate: response.data.user.emirate,
          address: response.data.user.address,
          isVisitor: false,
          isAdmin: response.data.user.role === "admin",
          role: response.data.user.role,
        };

        login(userData);
        return { success: true };
      }

      return { success: false, error: response.error || "Login failed" };
    } catch (error) {
      return { success: false, error: "Network error. Please try again." };
    }
  };

  const loginAdmin = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await authApi.adminLogin(username, password);

      if (response.success && response.data) {
        // Set auth token
        setAuthToken(response.data.token);

        // Create staff user object
        const staffUser: User = {
          id: response.data.user.id,
          username: response.data.user.username || response.data.user.email,
          firstName: response.data.user.firstName,
          familyName: response.data.user.familyName,
          email: response.data.user.email,
          mobile: response.data.user.mobile,
          emirate: response.data.user.emirate,
          address: response.data.user.address,
          isVisitor: false,
          isAdmin: response.data.user.role === "admin",
          role: response.data.user.role,
        };

        setUser(staffUser);
        localStorage.setItem("user", JSON.stringify(staffUser));
        return { success: true };
      }

      return { success: false, error: response.error || "Invalid staff credentials" };
    } catch (error) {
      return { success: false, error: "Network error. Please check if the server is running." };
    }
  };

  const logout = () => {
    // Call backend logout (fire and forget)
    authApi.logout().catch(() => { });

    setAuthToken(null);
    setUser(null);
    localStorage.removeItem("user");
    // Note: We don't clear the basket on logout so customers can continue shopping
    // The basket will persist across login/logout sessions
  };

  const register = async (newUser: Omit<User, "id"> & {
    username: string; password: string; deliveryAddress?: {
      label: string;
      fullName: string;
      mobile: string;
      emirate: string;
      area: string;
      street: string;
      building: string;
      floor?: string;
      apartment?: string;
      latitude?: number;
      longitude?: number;
      isDefault: boolean;
    }
  }): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await authApi.register({
        username: newUser.username,
        email: newUser.email,
        mobile: newUser.mobile,
        password: newUser.password,
        firstName: newUser.firstName,
        familyName: newUser.familyName,
        emirate: newUser.emirate,
        address: newUser.address,
        deliveryAddress: newUser.deliveryAddress,
      });

      if (response.success && response.data) {
        // Save the delivery address to localStorage for Profile/Checkout sync
        if (newUser.deliveryAddress && response.data.userId) {
          const addressToSave = {
            id: `addr_${Date.now()}`,
            userId: response.data.userId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            ...newUser.deliveryAddress,
          };
          localStorage.setItem(`addresses_${response.data.userId}`, JSON.stringify([addressToSave]));
        }

        // Auto-login after registration
        const loginResult = await loginWithCredentials(newUser.username, newUser.password);
        return loginResult;
      }

      return { success: false, error: response.error || "Registration failed" };
    } catch (error) {
      return { success: false, error: "Network error. Please try again." };
    }
  };

  const updateUser = (updates: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...updates };
      setUser(updatedUser);
      localStorage.setItem("user", JSON.stringify(updatedUser));

      // Also update in registered users
      const users = getRegisteredUsers();
      const updatedUsers = users.map((u) =>
        u.id === user.id ? { ...u, ...updates } : u
      );
      saveRegisteredUsers(updatedUsers);
    }
  };

  const requestPasswordReset = async (email: string): Promise<{ success: boolean; error?: string; resetLink?: string }> => {
    try {
      const { passwordResetApi } = await import('@/lib/api');
      const response = await passwordResetApi.forgotPassword(email);
      if (response.success) {
        return { success: true, resetLink: response.data?.resetLink };
      }
      return { success: false, error: response.error || 'Failed to process request' };
    } catch (err) {
      return { success: false, error: 'Network error. Please try again.' };
    }
  };

  const verifyResetToken = async (token: string): Promise<{ valid: boolean; email?: string }> => {
    try {
      const { passwordResetApi } = await import('@/lib/api');
      const response = await passwordResetApi.verifyResetToken(token);
      if (response.success && response.data) {
        return { valid: response.data.valid, email: response.data.email };
      }
      return { valid: false };
    } catch (err) {
      return { valid: false };
    }
  };

  const resetPassword = async (token: string, newPassword: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { passwordResetApi } = await import('@/lib/api');
      const response = await passwordResetApi.resetPassword(token, newPassword);
      if (response.success) {
        return { success: true };
      }
      return { success: false, error: response.error || 'Failed to reset password' };
    } catch (err) {
      return { success: false, error: 'Network error. Please try again.' };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoggedIn: !!user && !user.isVisitor,
        isAdmin: !!user?.isAdmin,
        isAuthLoading,
        login,
        loginWithCredentials,
        loginAdmin,
        logout,
        register,
        updateUser,
        requestPasswordReset,
        verifyResetToken,
        resetPassword,
        getRegisteredUsers,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
