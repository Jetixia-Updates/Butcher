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
  requestPasswordReset: (email: string, mobile: string) => { success: boolean; error?: string };
  verifyResetToken: (token: string) => { valid: boolean; email?: string };
  resetPassword: (token: string, newPassword: string) => { success: boolean; error?: string };
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
    localStorage.removeItem("basket");
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

  const requestPasswordReset = (email: string, mobile: string): { success: boolean; error?: string } => {
    const users = getRegisteredUsers();
    const normalizedMobile = mobile.replace(/\s/g, "");

    // Find user by mobile number
    const foundUser = users.find(
      (u) => u.mobile.replace(/\s/g, "") === normalizedMobile
    );

    if (!foundUser) {
      return { success: false, error: "No account found with this phone number" };
    }

    // Verify email matches the registered email for this mobile
    if (foundUser.email.toLowerCase() !== email.toLowerCase()) {
      return { success: false, error: "Email does not match the registered email for this phone number" };
    }

    // Generate reset token
    const token = `reset_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    const expiresAt = Date.now() + 30 * 60 * 1000; // 30 minutes

    // Save reset request
    const requests = getResetRequests();
    // Remove any existing requests for this email
    const filteredRequests = requests.filter((r) => r.email.toLowerCase() !== email.toLowerCase());
    filteredRequests.push({ email, mobile: normalizedMobile, token, expiresAt });
    saveResetRequests(filteredRequests);

    // In a real app, send email here
    console.log(`Password reset link: /reset-password?token=${token}`);

    return { success: true };
  };

  const verifyResetToken = (token: string): { valid: boolean; email?: string } => {
    const requests = getResetRequests();
    const request = requests.find((r) => r.token === token);

    if (!request) {
      return { valid: false };
    }

    if (Date.now() > request.expiresAt) {
      // Token expired, remove it
      const filteredRequests = requests.filter((r) => r.token !== token);
      saveResetRequests(filteredRequests);
      return { valid: false };
    }

    return { valid: true, email: request.email };
  };

  const resetPassword = (token: string, newPassword: string): { success: boolean; error?: string } => {
    const verification = verifyResetToken(token);

    if (!verification.valid) {
      return { success: false, error: "Invalid or expired reset link" };
    }

    const users = getRegisteredUsers();
    const userIndex = users.findIndex(
      (u) => u.email.toLowerCase() === verification.email?.toLowerCase()
    );

    if (userIndex === -1) {
      return { success: false, error: "User not found" };
    }

    // Update password
    users[userIndex].password = newPassword;
    saveRegisteredUsers(users);

    // Remove the used token
    const requests = getResetRequests();
    const filteredRequests = requests.filter((r) => r.token !== token);
    saveResetRequests(filteredRequests);

    return { success: true };
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
