import React, { createContext, useContext, useState, useEffect } from "react";
import { authApi, customerAuthApi, setAuthToken, getAuthToken } from "@/lib/api";

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
  isStaff?: boolean;
  isCustomer?: boolean;
  role?: string;
  // Customer-specific fields
  customerNumber?: string;
  segment?: string;
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
  isStaff: boolean;
  isCustomer: boolean;
  isLoading: boolean;
  login: (user: User) => void;
  loginWithCredentials: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginAdmin: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  register: (user: Omit<User, "id"> & { username: string; password: string; deliveryAddress?: {
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
  } }) => Promise<{ success: boolean; error?: string }>;
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
  const [isLoading, setIsLoading] = useState(true);

  // Load user from localStorage on mount and validate token
  useEffect(() => {
    const initAuth = async () => {
      const savedUser = localStorage.getItem("user");
      const token = getAuthToken();
      const userType = localStorage.getItem("user_type"); // "customer" or "staff"

      if (savedUser && token) {
        try {
          // Validate token with appropriate backend endpoint
          if (userType === "customer") {
            // Validate customer session
            const response = await customerAuthApi.getCurrentCustomer();
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
                isAdmin: false,
                isStaff: false,
                isCustomer: true,
                role: "customer",
                customerNumber: response.data.customerNumber,
                segment: response.data.segment,
              };
              setUser(userData);
              localStorage.setItem("user", JSON.stringify(userData));
            } else {
              // Token invalid, clear auth
              setAuthToken(null);
              localStorage.removeItem("user");
              localStorage.removeItem("user_type");
            }
          } else {
            // Validate staff session
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
                isStaff: ["admin", "staff", "delivery"].includes(response.data.role || ""),
                isCustomer: false,
                role: response.data.role,
              };
              setUser(userData);
              localStorage.setItem("user", JSON.stringify(userData));
            } else {
              // Token invalid, clear auth
              setAuthToken(null);
              localStorage.removeItem("user");
              localStorage.removeItem("user_type");
            }
          }
        } catch (error) {
          // Fallback to local user if API fails
          setUser(JSON.parse(savedUser));
        }
      }
      setIsLoading(false);
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
      // Use customer auth API for customer login
      const response = await customerAuthApi.login(username, password);

      if (response.success && response.data) {
        // Set auth token
        setAuthToken(response.data.token);

        // Mark as customer user type
        localStorage.setItem("user_type", "customer");

        // Create user object from customer data
        const userData: User = {
          id: response.data.customer.id,
          username: response.data.customer.username,
          firstName: response.data.customer.firstName,
          familyName: response.data.customer.familyName,
          email: response.data.customer.email,
          mobile: response.data.customer.mobile,
          emirate: response.data.customer.emirate,
          address: response.data.customer.address,
          isVisitor: false,
          isAdmin: false,
          isStaff: false,
          isCustomer: true,
          role: "customer",
          customerNumber: response.data.customer.customerNumber,
          segment: response.data.customer.segment,
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
      // Use staff auth API for admin/staff login
      const response = await authApi.adminLogin(username, password);

      if (response.success && response.data) {
        // Set auth token
        setAuthToken(response.data.token);

        // Mark as staff user type
        localStorage.setItem("user_type", "staff");

        // Create admin/staff user object
        const adminUser: User = {
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
          isStaff: true,
          isCustomer: false,
          role: response.data.user.role,
        };

        setUser(adminUser);
        localStorage.setItem("user", JSON.stringify(adminUser));
        return { success: true };
      }

      return { success: false, error: response.error || "Invalid admin credentials" };
    } catch (error) {
      return { success: false, error: "Network error. Please check if the server is running." };
    }
  };

  const logout = () => {
    // Call appropriate backend logout based on user type
    const userType = localStorage.getItem("user_type");
    if (userType === "customer") {
      customerAuthApi.logout().catch(() => {});
    } else {
      authApi.logout().catch(() => {});
    }
    
    setAuthToken(null);
    setUser(null);
    localStorage.removeItem("user");
    localStorage.removeItem("user_type");
    localStorage.removeItem("basket");
  };

  const register = async (newUser: Omit<User, "id"> & { username: string; password: string; deliveryAddress?: {
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
  } }): Promise<{ success: boolean; error?: string }> => {
    try {
      // Use customer auth API for customer registration
      const response = await customerAuthApi.register({
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
        if (newUser.deliveryAddress && response.data.id) {
          const addressToSave = {
            id: `addr_${Date.now()}`,
            customerId: response.data.id,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            ...newUser.deliveryAddress,
          };
          localStorage.setItem(`addresses_${response.data.id}`, JSON.stringify([addressToSave]));
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
        isStaff: !!user?.isStaff,
        isCustomer: !!user?.isCustomer,
        isLoading,
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
