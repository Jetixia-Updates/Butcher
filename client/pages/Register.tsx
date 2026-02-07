import React, { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
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

const EMIRATES_KEYS = [
  { value: "Dubai", key: "register.dubai" },
  { value: "Abu Dhabi", key: "register.abuDhabi" },
  { value: "Sharjah", key: "register.sharjah" },
  { value: "Ajman", key: "register.ajman" },
  { value: "Ras Al Khaimah", key: "register.rasAlKhaimah" },
  { value: "Fujairah", key: "register.fujairah" },
  { value: "Umm Al Quwain", key: "register.ummAlQuwain" },
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
  const { t, language, isRTL } = useLanguage();

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
      setApiError(t("register.locationNotSupported"));
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
      newErrors.username = t("register.validation.usernameMinLength");
    } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      newErrors.username = t("register.validation.usernameRequired");
    }

    if (!isValidName(formData.firstName)) {
      newErrors.firstName = t("register.validation.firstNameRequired");
    }

    if (!isValidName(formData.familyName)) {
      newErrors.familyName = t("register.validation.familyNameRequired");
    }

    if (!isValidEmail(formData.email)) {
      newErrors.email = t("register.validation.emailInvalid");
    }

    if (!isValidUAEPhone(formData.mobile)) {
      newErrors.mobile = t("register.validation.phoneInvalid");
    }

    if (!isStrongPassword(formData.password)) {
      newErrors.password = t("register.validation.passwordWeak");
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = t("register.validation.passwordMismatch");
    }

    if (!formData.emirate) {
      newErrors.emirate = t("register.validation.emirateRequired");
    }

    if (!formData.area || formData.area.length < 2) {
      newErrors.area = t("register.validation.areaRequired");
    }

    if (!formData.street || formData.street.length < 2) {
      newErrors.street = t("register.validation.streetRequired");
    }

    if (!formData.building || formData.building.length < 1) {
      newErrors.building = t("register.validation.buildingRequired");
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
    <div className="min-h-screen bg-background flex flex-col" dir={isRTL ? "rtl" : "ltr"}>
      <Header showBasketIcon={false} />

      <main className="flex-1 py-6 sm:py-12 px-3 sm:px-4">
        <div className="max-w-2xl mx-auto">
          {/* Page Title */}
          <div className="text-center mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-4xl font-bold text-foreground">{t("register.title")}</h1>
            <p className="text-muted-foreground mt-2 text-sm sm:text-base">
              {t("register.subtitle")}
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
                {t("register.personalInfo")}
              </h3>
              <div className="space-y-4">
                <FormField 
                  label={t("register.username")} 
                  name="username"
                  placeholder={t("register.usernamePlaceholder")}
                  value={formData.username}
                  error={errors.username}
                  onChange={handleChange}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField 
                    label={t("register.firstName")} 
                    name="firstName"
                    placeholder={t("register.firstNamePlaceholder")}
                    value={formData.firstName}
                    error={errors.firstName}
                    onChange={handleChange}
                  />
                  <FormField 
                    label={t("register.familyName")} 
                    name="familyName"
                    placeholder={t("register.familyNamePlaceholder")}
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
                {t("register.contactInfo")}
              </h3>
              <div className="space-y-4">
                <FormField
                  label={t("register.email")}
                  name="email"
                  type="email"
                  placeholder={t("register.emailPlaceholder")}
                  value={formData.email}
                  error={errors.email}
                  onChange={handleChange}
                />
                <FormField
                  label={t("register.phone")}
                  name="mobile"
                  type="tel"
                  placeholder={t("register.phonePlaceholder")}
                  value={formData.mobile}
                  error={errors.mobile}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Location Information */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">
                {t("checkout.deliveryAddress")}
              </h3>
              <div className="space-y-4">
                {/* Map for location */}
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    {t("register.yourLocation")}
                    {isDetectingLocation && (
                      <span className="ml-2 text-muted-foreground font-normal">
                        ({t("register.detecting")})
                      </span>
                    )}
                    {locationDetected && (
                      <span className="ml-2 text-green-600 font-normal">{t("register.detected")}</span>
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
                          <p className="text-sm text-muted-foreground">{t("register.detecting")}...</p>
                        </div>
                      ) : (
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground mb-2">{t("register.locationNotDetected")}</p>
                          <button
                            type="button"
                            onClick={autoDetectLocation}
                            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
                          >
                            {t("register.detectLocation")}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("register.clickMapOrDrag")}
                  </p>
                </div>

                {/* Emirate */}
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    {t("register.emirate")}<span className="text-destructive">*</span>
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
                    <option value="">{t("register.selectEmirate")}</option>
                    {EMIRATES_KEYS.map((emirate) => (
                      <option key={emirate.value} value={emirate.value}>
                        {t(emirate.key)}
                      </option>
                    ))}
                  </select>
                  {errors.emirate && (
                    <p className="text-destructive text-xs mt-1">{errors.emirate}</p>
                  )}
                </div>

                {/* Area */}
                <FormField
                  label={t("register.area")}
                  name="area"
                  placeholder={t("register.areaPlaceholder")}
                  value={formData.area}
                  error={errors.area}
                  onChange={handleChange}
                />

                {/* Street */}
                <FormField
                  label={t("register.street")}
                  name="street"
                  placeholder={t("register.streetPlaceholder")}
                  value={formData.street}
                  error={errors.street}
                  onChange={handleChange}
                />

                {/* Building */}
                <FormField
                  label={t("register.building")}
                  name="building"
                  placeholder={t("register.buildingPlaceholder")}
                  value={formData.building}
                  error={errors.building}
                  onChange={handleChange}
                />

                {/* Floor and Apartment */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    label={t("register.floor")}
                    name="floor"
                    placeholder={t("register.floorPlaceholder")}
                    value={formData.floor}
                    error={errors.floor}
                    onChange={handleChange}
                    required={false}
                  />
                  <FormField
                    label={t("register.apartment")}
                    name="apartment"
                    placeholder={t("register.apartmentPlaceholder")}
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
                {t("register.security")}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    {t("register.password")}<span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswords.password ? "text" : "password"}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder={t("register.passwordPlaceholder")}
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
                    {t("register.confirmPassword")}<span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswords.confirmPassword ? "text" : "password"}
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      placeholder={t("register.confirmPasswordPlaceholder")}
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
              {isLoading ? t("register.creatingAccount") : t("register.createAccount")}
            </button>

            {/* Login Link */}
            <p className="text-center text-muted-foreground">
              {t("register.alreadyHaveAccount")}{" "}
              <Link to="/" className="text-primary font-semibold hover:text-primary/80">
                {t("register.loginHere")}
              </Link>
            </p>
          </form>
        </div>
      </main>

      <Footer />
    </div>
  );
}
