import React, { useState, useEffect, useRef } from "react";
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
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default marker icon issue
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

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
          : "border-input bg-white dark:bg-gray-800 focus:border-primary"
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
    username: "",
    firstName: "",
    familyName: "",
    email: "",
    mobile: "+971 ",
    password: "",
    confirmPassword: "",
    emirate: "",
    area: "",
    street: "",
    building: "",
    floor: "",
    apartment: "",
    latitude: undefined as number | undefined,
    longitude: undefined as number | undefined,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState({
    password: false,
    confirmPassword: false,
  });
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [locationDetected, setLocationDetected] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // Auto-detect location on component mount
  useEffect(() => {
    autoDetectLocation();
  }, []);

  // Initialize map when location is detected
  useEffect(() => {
    if (!mapContainerRef.current || !formData.latitude || !formData.longitude) return;
    if (leafletMapRef.current) return; // Already initialized

    leafletMapRef.current = L.map(mapContainerRef.current).setView(
      [formData.latitude, formData.longitude],
      16
    );

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(leafletMapRef.current);

    markerRef.current = L.marker([formData.latitude, formData.longitude], { draggable: true })
      .addTo(leafletMapRef.current);

    // Handle marker drag
    markerRef.current.on("dragend", async () => {
      const pos = markerRef.current?.getLatLng();
      if (pos) {
        setFormData(prev => ({ ...prev, latitude: pos.lat, longitude: pos.lng }));
        await reverseGeocodeAndFillAddress(pos.lat, pos.lng);
      }
    });

    // Handle map click
    leafletMapRef.current.on("click", async (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      }
      setFormData(prev => ({ ...prev, latitude: lat, longitude: lng }));
      await reverseGeocodeAndFillAddress(lat, lng);
    });

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, [formData.latitude, formData.longitude]);

  // Reverse geocode to get address components
  const reverseGeocodeAndFillAddress = async (lat: number, lng: number) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        { headers: { "Accept-Language": "en" } }
      );
      const data = await response.json();
      
      if (data.address) {
        const addr = data.address;
        // Try to extract area/neighborhood
        const area = addr.suburb || addr.neighbourhood || addr.district || addr.city_district || "";
        const street = addr.road || addr.street || "";
        const building = addr.house_number || "";
        
        // Determine emirate from city/state
        let emirate = "";
        const city = (addr.city || addr.town || addr.state || "").toLowerCase();
        if (city.includes("dubai")) emirate = "Dubai";
        else if (city.includes("abu dhabi")) emirate = "Abu Dhabi";
        else if (city.includes("sharjah")) emirate = "Sharjah";
        else if (city.includes("ajman")) emirate = "Ajman";
        else if (city.includes("ras al")) emirate = "Ras Al Khaimah";
        else if (city.includes("fujairah")) emirate = "Fujairah";
        else if (city.includes("umm al")) emirate = "Umm Al Quwain";

        setFormData(prev => ({
          ...prev,
          area: area || prev.area,
          street: street || prev.street,
          building: building || prev.building,
          emirate: emirate || prev.emirate,
        }));
      }
    } catch (error) {
      console.error("Reverse geocoding failed:", error);
    }
  };

  const autoDetectLocation = () => {
    if (!navigator.geolocation) {
      setApiError("Geolocation is not supported by your browser");
      return;
    }

    setIsDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setFormData(prev => ({ ...prev, latitude, longitude }));
        setLocationDetected(true);
        setIsDetectingLocation(false);
        
        // Reverse geocode to fill address fields
        await reverseGeocodeAndFillAddress(latitude, longitude);
      },
      (error) => {
        console.error("Location detection failed:", error);
        setIsDetectingLocation(false);
        // Set default Dubai location
        setFormData(prev => ({ 
          ...prev, 
          latitude: 25.2048, 
          longitude: 55.2708,
          emirate: "Dubai"
        }));
        setLocationDetected(true);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.username || formData.username.length < 3) {
      newErrors.username = "Username must be at least 3 characters";
    } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      newErrors.username = "Username can only contain letters, numbers, and underscores";
    }

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

    if (!formData.area || formData.area.length < 2) {
      newErrors.area = "Please enter your area";
    }

    if (!formData.street || formData.street.length < 2) {
      newErrors.street = "Please enter your street";
    }

    if (!formData.building || formData.building.length < 1) {
      newErrors.building = "Please enter your building name/number";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    // Build full address string
    const fullAddress = `${formData.building}, ${formData.street}, ${formData.area}, ${formData.emirate}${formData.floor ? `, Floor ${formData.floor}` : ""}${formData.apartment ? `, Apt ${formData.apartment}` : ""}`;

    // Call backend API for registration with address data
    const result = await register({
      username: formData.username,
      firstName: formData.firstName,
      familyName: formData.familyName,
      email: formData.email,
      mobile: formData.mobile,
      emirate: formData.emirate,
      address: fullAddress,
      isVisitor: false,
      password: formData.password,
      // Include delivery address data
      deliveryAddress: {
        label: "Home",
        fullName: `${formData.firstName} ${formData.familyName}`,
        mobile: formData.mobile,
        emirate: formData.emirate,
        area: formData.area,
        street: formData.street,
        building: formData.building,
        floor: formData.floor,
        apartment: formData.apartment,
        latitude: formData.latitude,
        longitude: formData.longitude,
        isDefault: true,
      },
    });

    if (result.success) {
      navigate("/home");
    } else {
      setApiError(result.error || "Registration failed. Please try again.");
    }
    
    setIsLoading(false);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    if (name === "mobile" && !value.startsWith("+971")) {
      return;
    }

    // Sanitize username input
    if (name === "username") {
      const sanitizedValue = value.replace(/[^a-zA-Z0-9_]/g, "");
      setFormData((prev) => ({
        ...prev,
        [name]: sanitizedValue,
      }));
      if (errors[name]) {
        setErrors((prev) => ({
          ...prev,
          [name]: undefined,
        }));
      }
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

      <main className="flex-1 py-6 sm:py-12 px-3 sm:px-4">
        <div className="max-w-2xl mx-auto">
          {/* Page Title */}
          <div className="text-center mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-4xl font-bold text-foreground">Create Account</h1>
            <p className="text-muted-foreground mt-2 text-sm sm:text-base">
              Join us and start shopping for premium quality meats
            </p>
          </div>

          {/* Register Form */}
          <form onSubmit={handleRegister} className="card-premium p-4 sm:p-8 space-y-4 sm:space-y-6">
            {/* API Error Display */}
            {apiError && (
              <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded-lg text-sm">
                {apiError}
              </div>
            )}
            
            {/* Personal Information */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">
                Personal Information
              </h3>
              <div className="space-y-4">
                <FormField 
                  label="Username" 
                  name="username"
                  placeholder="Choose a unique username"
                  value={formData.username}
                  error={errors.username}
                  onChange={handleChange}
                />
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
                Delivery Address
              </h3>
              <div className="space-y-4">
                {/* Map for location */}
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    Your Location
                    {isDetectingLocation && (
                      <span className="ml-2 text-muted-foreground font-normal">
                        (Detecting...)
                      </span>
                    )}
                    {locationDetected && (
                      <span className="ml-2 text-green-600 font-normal">✓ Detected</span>
                    )}
                  </label>
                  {locationDetected && formData.latitude && formData.longitude ? (
                    <div 
                      ref={mapContainerRef} 
                      className="w-full h-48 rounded-lg border border-input overflow-hidden"
                    />
                  ) : (
                    <div className="w-full h-48 rounded-lg border border-input bg-muted flex items-center justify-center">
                      {isDetectingLocation ? (
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                          <p className="text-sm text-muted-foreground">Detecting your location...</p>
                        </div>
                      ) : (
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground mb-2">Location not detected</p>
                          <button
                            type="button"
                            onClick={autoDetectLocation}
                            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
                          >
                            📍 Detect My Location
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Click on the map or drag the marker to adjust your exact location
                  </p>
                </div>

                {/* Emirate */}
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
                        : "border-input bg-white dark:bg-gray-800 focus:border-primary"
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

                {/* Area */}
                <FormField
                  label="Area / Neighborhood"
                  name="area"
                  placeholder="e.g., Al Barsha, Jumeirah, Downtown"
                  value={formData.area}
                  error={errors.area}
                  onChange={handleChange}
                />

                {/* Street */}
                <FormField
                  label="Street"
                  name="street"
                  placeholder="Street name"
                  value={formData.street}
                  error={errors.street}
                  onChange={handleChange}
                />

                {/* Building */}
                <FormField
                  label="Building Name / Number"
                  name="building"
                  placeholder="Building name or number"
                  value={formData.building}
                  error={errors.building}
                  onChange={handleChange}
                />

                {/* Floor and Apartment */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    label="Floor"
                    name="floor"
                    placeholder="Optional"
                    value={formData.floor}
                    error={errors.floor}
                    onChange={handleChange}
                    required={false}
                  />
                  <FormField
                    label="Apartment"
                    name="apartment"
                    placeholder="Optional"
                    value={formData.apartment}
                    error={errors.apartment}
                    onChange={handleChange}
                    required={false}
                  />
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
                          : "border-input bg-white dark:bg-gray-800 focus:border-primary"
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
                          : "border-input bg-white dark:bg-gray-800 focus:border-primary"
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
