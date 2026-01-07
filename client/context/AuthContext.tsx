import React, { createContext, useContext, useState, useEffect } from "react";

export interface User {
  id: string;
  firstName: string;
  familyName: string;
  email: string;
  mobile: string;
  emirate: string;
  address: string;
  isVisitor: boolean;
  isAdmin?: boolean;
  password?: string; // For demo purposes - in production, never store passwords in frontend
}

export interface RegisteredUser extends User {
  password: string;
}

// Admin credentials (in production, this should be handled securely on the server)
const ADMIN_CREDENTIALS = {
  email: "admin@butcher.ae",
  password: "admin123",
};

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
  login: (user: User) => void;
  loginWithCredentials: (mobile: string, password: string) => { success: boolean; error?: string };
  loginAdmin: (email: string, password: string) => boolean;
  logout: () => void;
  register: (user: Omit<User, "id"> & { password: string }) => void;
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

  // Load user from localStorage on mount
  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (error) {
        console.error("Failed to parse user from localStorage:", error);
      }
    }
  }, []);

  // Helper to get all registered users from localStorage
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

  const loginWithCredentials = (mobile: string, password: string): { success: boolean; error?: string } => {
    const users = getRegisteredUsers();
    const normalizedMobile = mobile.replace(/\s/g, "");
    
    const foundUser = users.find(
      (u) => u.mobile.replace(/\s/g, "") === normalizedMobile
    );

    if (!foundUser) {
      return { success: false, error: "No account found with this phone number" };
    }

    if (foundUser.password !== password) {
      return { success: false, error: "Incorrect password" };
    }

    // Login successful
    const { password: _, ...userWithoutPassword } = foundUser;
    login(userWithoutPassword);
    return { success: true };
  };

  const loginAdmin = (email: string, password: string): boolean => {
    if (email === ADMIN_CREDENTIALS.email && password === ADMIN_CREDENTIALS.password) {
      const adminUser: User = {
        id: "admin_1",
        firstName: "Admin",
        familyName: "User",
        email: ADMIN_CREDENTIALS.email,
        mobile: "",
        emirate: "",
        address: "",
        isVisitor: false,
        isAdmin: true,
      };
      setUser(adminUser);
      localStorage.setItem("user", JSON.stringify(adminUser));
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("user");
    localStorage.removeItem("basket");
  };

  const register = (newUser: Omit<User, "id"> & { password: string }) => {
    const users = getRegisteredUsers();
    
    // Check if mobile already exists
    const normalizedMobile = newUser.mobile.replace(/\s/g, "");
    const existingUser = users.find(
      (u) => u.mobile.replace(/\s/g, "") === normalizedMobile
    );

    if (existingUser) {
      // Update existing user
      const updatedUsers = users.map((u) =>
        u.mobile.replace(/\s/g, "") === normalizedMobile
          ? { ...u, ...newUser, id: u.id }
          : u
      );
      saveRegisteredUsers(updatedUsers);
    } else {
      // Create new user
      const userWithId: RegisteredUser = {
        ...newUser,
        id: `user_${Date.now()}`,
      };
      users.push(userWithId);
      saveRegisteredUsers(users);
    }

    // Login the user (without password in session)
    const { password: _, ...userWithoutPassword } = newUser;
    login({
      ...userWithoutPassword,
      id: existingUser?.id || `user_${Date.now()}`,
    });
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
