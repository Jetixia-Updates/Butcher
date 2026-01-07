import React, { useState, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import {
  isValidName,
  isValidEmail,
  isValidUAEPhone,
  isStrongPassword,
} from "@/utils/validators";

const EMIRATES = [
  "Dubai",
  "Abu Dhabi",
  "Sharjah",
  "Ajman",
  "Ras Al Khaimah",
  "Fujairah",
  "Umm Al Quwain",
];

interface FormFieldProps {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  value: string;
  error?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}

const FormField: React.FC<FormFieldProps> = ({
  label,
  name,
  type = "text",
  placeholder,
  required = true,
  value,
  error,
  onChange,
}) => (
  <div>
    <label className="block text-sm font-semibold text-foreground mb-2">
      {label}
      {required && <span className="text-destructive">*</span>}
    </label>
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={`w-full px-4 py-2 rounded-lg border-2 transition-colors ${
        error
          ? "border-destructive bg-destructive/5"
          : "border-input bg-white focus:border-primary"
      } text-foreground placeholder-muted-foreground focus:outline-none`}
    />
    {error && (
      <p className="text-destructive text-xs mt-1">{error}</p>
    )}
  </div>
);

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [formData, setFormData] = useState({
    firstName: "",
    familyName: "",
    email: "",
    mobile: "+971 ",
    password: "",
    confirmPassword: "",
    emirate: "",
    address: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPasswords, setShowPasswords] = useState({
    password: false,
    confirmPassword: false,
  });

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!isValidName(formData.firstName)) {
      newErrors.firstName = "First name must be at least 2 characters";
    }

    if (!isValidName(formData.familyName)) {
      newErrors.familyName = "Family name must be at least 2 characters";
    }

    if (!isValidEmail(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!isValidUAEPhone(formData.mobile)) {
      newErrors.mobile = "Please enter a valid UAE phone number";
    }

    if (!isStrongPassword(formData.password)) {
      newErrors.password =
        "Password must be at least 8 characters with 1 uppercase and 1 special character";
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    if (!formData.emirate) {
      newErrors.emirate = "Please select an emirate";
    }

    if (formData.address.length < 5) {
      newErrors.address = "Please enter a valid address";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    // Simulate API call
    setTimeout(() => {
      register({
        firstName: formData.firstName,
        familyName: formData.familyName,
        email: formData.email,
        mobile: formData.mobile,
        emirate: formData.emirate,
        address: formData.address,
        isVisitor: false,
      });

      setIsLoading(false);
      navigate("/products");
    }, 500);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    if (name === "mobile" && !value.startsWith("+971")) {
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: undefined,
      }));
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header showBasketIcon={false} />

      <main className="flex-1 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          {/* Page Title */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-foreground">Create Account</h1>
            <p className="text-muted-foreground mt-2">
              Join us and start shopping for premium quality meats
            </p>
          </div>

          {/* Register Form */}
          <form onSubmit={handleRegister} className="card-premium p-8 space-y-6">
            {/* Personal Information */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">
                Personal Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField 
                  label="First Name" 
                  name="firstName"
                  value={formData.firstName}
                  error={errors.firstName}
                  onChange={handleChange}
                />
                <FormField 
                  label="Family Name" 
                  name="familyName"
                  value={formData.familyName}
                  error={errors.familyName}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Contact Information */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">
                Contact Information
              </h3>
              <div className="space-y-4">
                <FormField
                  label="Email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  error={errors.email}
                  onChange={handleChange}
                />
                <FormField
                  label="Mobile Number"
                  name="mobile"
                  type="tel"
                  placeholder="+971 50 123 4567"
                  value={formData.mobile}
                  error={errors.mobile}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Location Information */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">
                Location Information
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    Emirates<span className="text-destructive">*</span>
                  </label>
                  <select
                    name="emirate"
                    value={formData.emirate}
                    onChange={handleChange}
                    className={`w-full px-4 py-2 rounded-lg border-2 transition-colors ${
                      errors.emirate
                        ? "border-destructive bg-destructive/5"
                        : "border-input bg-white focus:border-primary"
                    } text-foreground focus:outline-none`}
                  >
                    <option value="">Select an emirate</option>
                    {EMIRATES.map((emirate) => (
                      <option key={emirate} value={emirate}>
                        {emirate}
                      </option>
                    ))}
                  </select>
                  {errors.emirate && (
                    <p className="text-destructive text-xs mt-1">{errors.emirate}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    Detailed Address<span className="text-destructive">*</span>
                  </label>
                  <textarea
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    placeholder="Enter your full address"
                    rows={3}
                    className={`w-full px-4 py-2 rounded-lg border-2 transition-colors resize-none ${
                      errors.address
                        ? "border-destructive bg-destructive/5"
                        : "border-input bg-white focus:border-primary"
                    } text-foreground placeholder-muted-foreground focus:outline-none`}
                  />
                  {errors.address && (
                    <p className="text-destructive text-xs mt-1">{errors.address}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Password */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">
                Security
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    Password<span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswords.password ? "text" : "password"}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Min 8 chars, 1 uppercase, 1 special"
                      className={`w-full px-4 py-2 rounded-lg border-2 transition-colors ${
                        errors.password
                          ? "border-destructive bg-destructive/5"
                          : "border-input bg-white focus:border-primary"
                      } text-foreground placeholder-muted-foreground focus:outline-none pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowPasswords({
                          ...showPasswords,
                          password: !showPasswords.password,
                        })
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPasswords.password ? "👁️" : "👁️‍🗨️"}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-destructive text-xs mt-1">{errors.password}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    Confirm Password<span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswords.confirmPassword ? "text" : "password"}
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      placeholder="Confirm your password"
                      className={`w-full px-4 py-2 rounded-lg border-2 transition-colors ${
                        errors.confirmPassword
                          ? "border-destructive bg-destructive/5"
                          : "border-input bg-white focus:border-primary"
                      } text-foreground placeholder-muted-foreground focus:outline-none pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowPasswords({
                          ...showPasswords,
                          confirmPassword: !showPasswords.confirmPassword,
                        })
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPasswords.confirmPassword ? "👁️" : "👁️‍🗨️"}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <p className="text-destructive text-xs mt-1">{errors.confirmPassword}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn-primary py-3 rounded-lg font-semibold text-base disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isLoading ? "Creating Account..." : "Create Account"}
            </button>

            {/* Login Link */}
            <p className="text-center text-muted-foreground">
              Already have an account?{" "}
              <Link to="/" className="text-primary font-semibold hover:text-primary/80">
                Login here
              </Link>
            </p>
          </form>
        </div>
      </main>

      <Footer />
    </div>
  );
}
