import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export default function VisitorPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Attempt to get geolocation
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          // Successfully got location
          const { latitude, longitude, accuracy } = position.coords;

          // Save visitor location to localStorage
          localStorage.setItem(
            "visitorLocation",
            JSON.stringify({
              latitude,
              longitude,
              accuracy,
              timestamp: new Date().toISOString(),
            })
          );

          // Create visitor session
          login({
            id: `visitor_${Date.now()}`,
            username: `visitor_${Date.now()}`,
            firstName: "Visitor",
            familyName: "Guest",
            email: `visitor_${Date.now()}@guest.butcher.ae`,
            mobile: "+971 00 000 0000",
            emirate: "Dubai",
            address: `Coordinates: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
            isVisitor: true,
          });

          // Redirect to products page
          setLoading(false);
          setTimeout(() => {
            navigate("/products");
          }, 500);
        },
        (error) => {
          // Handle geolocation error
          let errorMessage = "Unable to detect your location";

          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage =
                "Location permission denied. You can still browse as a guest.";
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = "Location information is unavailable.";
              break;
            case error.TIMEOUT:
              errorMessage = "Location request timed out.";
              break;
          }

          setError(errorMessage);
          setLoading(false);

          // Still allow visitor access without location
          localStorage.setItem(
            "visitorLocation",
            JSON.stringify({
              latitude: null,
              longitude: null,
              accuracy: null,
              timestamp: new Date().toISOString(),
            })
          );

          login({
            id: `visitor_${Date.now()}`,
            username: `visitor_${Date.now()}`,
            firstName: "Visitor",
            familyName: "Guest",
            email: `visitor_${Date.now()}@guest.butcher.ae`,
            mobile: "+971 00 000 0000",
            emirate: "Dubai",
            address: "Location not available",
            isVisitor: true,
          });

          // Auto redirect after 2 seconds
          setTimeout(() => {
            navigate("/products");
          }, 2000);
        }
      );
    } else {
      setError("Geolocation is not supported by your browser");
      setLoading(false);

      // Still proceed as visitor
      login({
        id: `visitor_${Date.now()}`,
        username: `visitor_${Date.now()}`,
        firstName: "Visitor",
        familyName: "Guest",
        email: `visitor_${Date.now()}@guest.butcher.ae`,
        mobile: "+971 00 000 0000",
        emirate: "Dubai",
        address: "Location not available",
        isVisitor: true,
      });

      // Auto redirect after 2 seconds
      setTimeout(() => {
        navigate("/products");
      }, 2000);
    }
  }, [login, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex items-center justify-center p-3 sm:p-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-6 sm:mb-8">
          <div className="inline-block animate-spin">
            <svg className="w-12 h-12 sm:w-16 sm:h-16 text-primary" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
            </svg>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mt-4">
            🔍 Detecting Location...
          </h1>
          <p className="text-muted-foreground mt-2 text-xs sm:text-sm">
            We're finding your location to show available products
          </p>
        </div>

        {error && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
            <p className="text-yellow-800 text-xs sm:text-sm">{error}</p>
            <p className="text-yellow-700 text-[10px] sm:text-xs mt-2">
              Redirecting you anyway...
            </p>
          </div>
        )}

        <div className="card-premium p-4 sm:p-6">
          <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">
            Please allow location access in the popup above
          </p>
          <button
            onClick={() => {
              // Manual fallback
              login({
                id: `visitor_${Date.now()}`,
                username: `visitor_${Date.now()}`,
                firstName: "Visitor",
                familyName: "Guest",
                email: `visitor_${Date.now()}@guest.butcher.ae`,
                mobile: "+971 00 000 0000",
                emirate: "Dubai",
                address: "Manual entry",
                isVisitor: true,
              });
              navigate("/products");
            }}
            className="btn-secondary w-full py-2 rounded-lg text-xs sm:text-sm font-semibold"
          >
            Continue Without Location
          </button>
        </div>
      </div>
    </div>
  );
}
