import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  Phone,
  MessageCircle,
  MapPin,
  Clock,
  Package,
  Truck,
  CheckCircle,
  ChefHat,
  User,
  Navigation,
  RefreshCw,
  X,
  Send
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useOrders } from "@/context/OrdersContext";
import { useAuth } from "@/context/AuthContext";
import { useOrderChat, ChatAttachment } from "@/context/ChatContext";
import { cn } from "@/lib/utils";
import { deliveryApi } from "@/lib/api";
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

// Custom driver icon
const driverIcon = L.divIcon({
  className: 'driver-marker',
  html: '<div style="background: #ef4444; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 2px 10px rgba(0,0,0,0.3);"><span style="font-size: 20px;">🛵</span></div>',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

// Custom destination icon
const destinationIcon = L.divIcon({
  className: 'destination-marker',
  html: '<div style="background: #22c55e; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 2px 10px rgba(0,0,0,0.3);"><span style="font-size: 20px;">🏠</span></div>',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

interface TrackingInfo {
  status: "preparing" | "ready" | "picked_up" | "on_the_way" | "nearby" | "delivered";
  driver?: {
    name: string;
    phone: string;
    photo?: string;
    rating: number;
    vehicleType: string;
    vehiclePlate: string;
  };
  estimatedArrival?: string;
  currentLocation?: {
    latitude: number;
    longitude: number;
  };
  timeline: {
    status: string;
    timestamp: string;
    completed: boolean;
  }[];
}

export default function TrackOrderPage() {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { orders } = useOrders();
  const { user, isLoggedIn, isAuthLoading } = useAuth();
  const isRTL = language === "ar";

  useEffect(() => {
    if (!isAuthLoading && !isLoggedIn) {
      navigate("/login");
    }
  }, [isLoggedIn, isAuthLoading, navigate]);

  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const driverMarkerRef = useRef<L.Marker | null>(null);
  const destinationMarkerRef = useRef<L.Marker | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tracking, setTracking] = useState<TrackingInfo | null>(null);
  const [countdown, setCountdown] = useState<string>("");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [chatAttachments, setChatAttachments] = useState<ChatAttachment[]>([]);
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);

  // Find order
  const order = orders.find(o => o.orderNumber === orderNumber);

  // Use order chat hook
  const { messages: chatMessages, sendMessage: sendOrderChat, markAsRead: markChatAsRead, unreadCount: chatUnreadCount } = useOrderChat(order?.id, user?.id);

  // Mark as read when chat opens
  useEffect(() => {
    if (isChatOpen && chatUnreadCount > 0) {
      markChatAsRead();
    }
  }, [isChatOpen, chatUnreadCount, markChatAsRead]);

  // Scroll to bottom
  useEffect(() => {
    if (chatMessagesRef.current && isChatOpen) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [chatMessages, isChatOpen]);

  // Fetch real tracking data from API
  const fetchTrackingData = useCallback(async () => {
    if (!order) return;

    try {
      const response = await deliveryApi.getTracking(order.id);

      if (response.success && response.data) {
        // Map API tracking data to component's TrackingInfo format
        const apiTracking = response.data;

        const statusMap: Record<string, TrackingInfo["status"]> = {
          assigned: "picked_up",
          picked_up: "picked_up",
          in_transit: "on_the_way",
          nearby: "nearby",
          delivered: "delivered",
        };

        const mappedStatus = statusMap[apiTracking.status] || "on_the_way";

        // Build timeline from API data
        const timeline = [
          { status: "preparing", timestamp: order.createdAt, completed: true },
          { status: "ready", timestamp: order.createdAt, completed: true },
          {
            status: "picked_up",
            timestamp: apiTracking.timeline?.find(t => t.status === 'assigned')?.timestamp || '',
            completed: true
          },
          {
            status: "on_the_way",
            timestamp: apiTracking.timeline?.find(t => t.status === 'in_transit')?.timestamp || '',
            completed: ['in_transit', 'nearby', 'delivered'].includes(apiTracking.status)
          },
          {
            status: "delivered",
            timestamp: apiTracking.timeline?.find(t => t.status === 'delivered')?.timestamp || '',
            completed: apiTracking.status === 'delivered'
          },
        ];

        setTracking({
          status: mappedStatus,
          driver: {
            name: apiTracking.driverName,
            phone: apiTracking.driverMobile,
            rating: 4.8, // Fallback
            vehicleType: "Motorcycle", // Fallback
            vehiclePlate: "D-12345", // Fallback
          },
          estimatedArrival: apiTracking.estimatedArrival,
          currentLocation: undefined, // Would come from real-time tracking
          timeline,
        });
      } else {
        // Fall back to order status-based tracking if no API tracking exists
        const statusMap: Record<string, TrackingInfo["status"]> = {
          pending: "preparing",
          confirmed: "preparing",
          processing: "preparing",
          ready_for_pickup: "ready",
          out_for_delivery: "on_the_way",
          delivered: "delivered",
        };

        const currentStatus = statusMap[order.status] || "preparing";

        const now = new Date();
        const timeline = [
          { status: "preparing", timestamp: order.createdAt, completed: true },
          { status: "ready", timestamp: new Date(now.getTime() - 15 * 60000).toISOString(), completed: currentStatus !== "preparing" },
          { status: "picked_up", timestamp: "", completed: ["on_the_way", "nearby", "delivered"].includes(currentStatus) },
          { status: "on_the_way", timestamp: "", completed: ["on_the_way", "nearby", "delivered"].includes(currentStatus) },
          { status: "delivered", timestamp: "", completed: currentStatus === "delivered" },
        ];

        setTracking({
          status: currentStatus,
          driver: undefined,
          estimatedArrival: undefined,
          currentLocation: undefined,
          timeline,
        });
      }
    } catch (error) {
      console.error('Error fetching tracking data:', error);
      // Fallback to basic status
      const statusMap: Record<string, TrackingInfo["status"]> = {
        pending: "preparing",
        confirmed: "preparing",
        processing: "preparing",
        out_for_delivery: "on_the_way",
        delivered: "delivered",
      };

      const currentStatus = statusMap[order.status] || "preparing";

      const now = new Date();
      const timeline = [
        { status: "preparing", timestamp: order.createdAt, completed: true },
        { status: "ready", timestamp: new Date(now.getTime() - 15 * 60000).toISOString(), completed: currentStatus !== "preparing" },
        { status: "picked_up", timestamp: "", completed: ["on_the_way", "nearby", "delivered"].includes(currentStatus) },
        { status: "on_the_way", timestamp: "", completed: ["on_the_way", "nearby", "delivered"].includes(currentStatus) },
        { status: "delivered", timestamp: "", completed: currentStatus === "delivered" },
      ];

      setTracking({
        status: currentStatus,
        driver: undefined,
        estimatedArrival: undefined,
        currentLocation: undefined,
        timeline,
      });
    }
  }, [order]);

  // Fetch tracking data on mount and when order changes
  useEffect(() => {
    fetchTrackingData();

    // Set up polling for real-time updates (every 5 seconds)
    const interval = setInterval(fetchTrackingData, 5000);

    return () => clearInterval(interval);
  }, [fetchTrackingData]);

  // Countdown timer
  useEffect(() => {
    if (!tracking?.estimatedArrival) {
      setCountdown("");
      return;
    }

    const updateCountdown = () => {
      const now = new Date().getTime();
      const arrival = new Date(tracking.estimatedArrival!).getTime();
      const diff = arrival - now;

      if (diff <= 0) {
        setCountdown(t("trackOrder.arrivingNow"));
      } else {
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        setCountdown(`${minutes}:${seconds.toString().padStart(2, "0")}`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [tracking?.estimatedArrival, isRTL]);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || !tracking?.currentLocation || leafletMapRef.current) return;

    // Destination coordinates from order delivery address
    const deliveryCoords = order?.deliveryAddress as any;
    const destination = {
      latitude: deliveryCoords?.latitude || tracking.currentLocation.latitude,
      longitude: deliveryCoords?.longitude || tracking.currentLocation.longitude,
    };

    leafletMapRef.current = L.map(mapRef.current).setView(
      [tracking.currentLocation.latitude, tracking.currentLocation.longitude],
      14
    );

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(leafletMapRef.current);

    // Add driver marker
    driverMarkerRef.current = L.marker(
      [tracking.currentLocation.latitude, tracking.currentLocation.longitude],
      { icon: driverIcon }
    ).addTo(leafletMapRef.current);

    // Add destination marker
    destinationMarkerRef.current = L.marker(
      [destination.latitude, destination.longitude],
      { icon: destinationIcon }
    ).addTo(leafletMapRef.current);

    // Draw route line
    routeLineRef.current = L.polyline(
      [
        [tracking.currentLocation.latitude, tracking.currentLocation.longitude],
        [destination.latitude, destination.longitude],
      ],
      { color: "#ef4444", weight: 4, dashArray: "10, 10" }
    ).addTo(leafletMapRef.current);

    // Fit bounds to show both markers
    const bounds = L.latLngBounds(
      [tracking.currentLocation.latitude, tracking.currentLocation.longitude],
      [destination.latitude, destination.longitude]
    );
    leafletMapRef.current.fitBounds(bounds, { padding: [50, 50] });

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, [tracking?.currentLocation]);

  const handleSend = () => {
    if (!chatMessage.trim() || !user) return;
    const userName = `${user.firstName || ""} ${user.familyName || ""}`.trim() || "Customer";
    sendOrderChat(userName, user.email || "", chatMessage.trim());
    setChatMessage("");
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchTrackingData();
    setIsRefreshing(false);
  };

  const getStatusInfo = (status: string) => {
    const statusConfig: Record<string, { icon: React.ReactNode; color: string }> = {
      preparing: { icon: <ChefHat className="w-5 h-5" />, color: "text-orange-500" },
      ready: { icon: <Package className="w-5 h-5" />, color: "text-blue-500" },
      picked_up: { icon: <Truck className="w-5 h-5" />, color: "text-purple-500" },
      on_the_way: { icon: <Navigation className="w-5 h-5" />, color: "text-primary" },
      nearby: { icon: <MapPin className="w-5 h-5" />, color: "text-green-500" },
      delivered: { icon: <CheckCircle className="w-5 h-5" />, color: "text-green-600" },
    };
    return statusConfig[status] || { icon: <Clock className="w-5 h-5" />, color: "text-gray-500" };
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return null;
  }

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" dir={isRTL ? "rtl" : "ltr"}>
        <div className="text-center">
          <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-xl font-bold text-foreground mb-2">{t("trackOrder.orderNotFound")}</h1>
          <Link to="/orders" className="btn-primary inline-block mt-4">
            {t("trackOrder.goToOrders")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir={isRTL ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white dark:bg-gray-900 border-b border-border shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-muted rounded-full">
              <ArrowLeft className={cn("w-5 h-5", isRTL && "rotate-180")} />
            </button>
            <div>
              <h1 className="font-bold text-foreground">{t("trackOrder.title")}</h1>
              <p className="text-xs text-muted-foreground">{t("trackOrder.orderNumber")} #{orderNumber}</p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            className={cn("p-2 hover:bg-muted rounded-full", isRefreshing && "animate-spin")}
          >
            <RefreshCw className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 space-y-4">
        {/* ETA Card */}
        {tracking?.estimatedArrival && tracking.status !== "delivered" && (
          <div className="bg-gradient-to-r from-primary to-primary/80 rounded-2xl p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-primary-foreground/80 text-sm">{t("trackOrder.estimatedArrival")}</p>
                <p className="text-3xl font-bold mt-1">{countdown}</p>
              </div>
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                <Truck className="w-8 h-8" />
              </div>
            </div>
          </div>
        )}

        {/* Delivered Badge */}
        {tracking?.status === "delivered" && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-green-700">{t("trackOrder.delivered")}</h2>
            <p className="text-green-600 text-sm mt-1">{t("trackOrder.deliveredDesc")}</p>
          </div>
        )}

        {/* Live Map */}
        {tracking?.currentLocation && tracking.status !== "delivered" && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-border overflow-hidden shadow-sm">
            <div className="p-3 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                <span className="font-medium text-sm">{t("trackOrder.liveTracking")}</span>
              </div>
              <span className="text-xs text-muted-foreground">{t("trackOrder.driverLocation")}</span>
            </div>
            <div ref={mapRef} className="w-full h-64" />
          </div>
        )}

        {/* Driver Card */}
        {tracking?.driver && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-border p-4 shadow-sm">
            <h3 className="font-semibold text-foreground mb-3">{t("trackOrder.yourDriver")}</h3>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-muted rounded-full flex items-center justify-center">
                <User className="w-7 h-7 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground">{tracking.driver.name}</p>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <span className="text-yellow-500">★</span>
                  <span>{tracking.driver.rating}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {tracking.driver.vehicleType} • {tracking.driver.vehiclePlate}
                </p>
              </div>
              <div className="flex gap-2">
                <a
                  href={`tel:${tracking.driver.phone}`}
                  className="p-3 bg-green-100 text-green-600 rounded-full hover:bg-green-200 transition-colors"
                >
                  <Phone className="w-5 h-5" />
                </a>
                <button
                  onClick={() => setIsChatOpen(true)}
                  className="p-3 bg-blue-100 text-blue-600 rounded-full hover:bg-blue-200 transition-colors relative"
                >
                  <MessageCircle className="w-5 h-5" />
                  {chatUnreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center border-2 border-white">
                      {chatUnreadCount}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Status Timeline */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-border p-4 shadow-sm">
          <h3 className="font-semibold text-foreground mb-4">{t("trackOrder.orderStatus")}</h3>
          <div className="space-y-4">
            {tracking?.timeline.map((step, index) => {
              const statusInfo = getStatusInfo(step.status);
              const isActive = tracking.status === step.status;
              const statusLabels: Record<string, { title: string; desc: string }> = {
                preparing: { title: t("trackOrder.preparing"), desc: t("trackOrder.preparingDesc") },
                ready: { title: t("trackOrder.ready"), desc: t("trackOrder.readyDesc") },
                picked_up: { title: t("trackOrder.pickedUp"), desc: t("trackOrder.pickedUpDesc") },
                on_the_way: { title: t("trackOrder.onTheWay"), desc: t("trackOrder.onTheWayDesc") },
                delivered: { title: t("trackOrder.delivered"), desc: t("trackOrder.deliveredDesc") },
              };
              const label = statusLabels[step.status] || { title: step.status, desc: "" };

              return (
                <div key={step.status} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all",
                        step.completed
                          ? "bg-green-100 border-green-500 text-green-600"
                          : isActive
                            ? "bg-primary/10 border-primary text-primary animate-pulse"
                            : "bg-muted border-border text-muted-foreground"
                      )}
                    >
                      {step.completed ? <CheckCircle className="w-5 h-5" /> : statusInfo.icon}
                    </div>
                    {index < tracking.timeline.length - 1 && (
                      <div
                        className={cn(
                          "w-0.5 h-12 mt-2",
                          step.completed ? "bg-green-500" : "bg-border"
                        )}
                      />
                    )}
                  </div>
                  <div className="flex-1 pb-4">
                    <p className={cn(
                      "font-medium",
                      step.completed || isActive ? "text-foreground" : "text-muted-foreground"
                    )}>
                      {label.title}
                    </p>
                    <p className="text-sm text-muted-foreground">{label.desc}</p>
                    {step.completed && step.timestamp && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(step.timestamp).toLocaleTimeString(isRTL ? "ar-AE" : "en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Delivery Address */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-border p-4 shadow-sm">
          <h3 className="font-semibold text-foreground mb-3">{t("trackOrder.deliveryAddress")}</h3>
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">{order.deliveryAddress.fullName}</p>
              <p className="text-sm text-muted-foreground">
                {order.deliveryAddress.building}, {order.deliveryAddress.street}
              </p>
              <p className="text-sm text-muted-foreground">
                {order.deliveryAddress.area}, {order.deliveryAddress.emirate}
              </p>
              <p className="text-sm text-muted-foreground">{order.deliveryAddress.mobile}</p>
            </div>
          </div>
        </div>

        {/* Order Summary */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-border p-4 shadow-sm">
          <h3 className="font-semibold text-foreground mb-3">{t("trackOrder.orderDetails")}</h3>
          <div className="space-y-2">
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">
                  {isRTL && item.nameAr ? item.nameAr : item.name} × {item.quantity}
                </span>
                <span className="font-medium">AED {(Number(item.price) * Number(item.quantity)).toFixed(2)}</span>
              </div>
            ))}
            <div className="border-t border-border pt-2 mt-2 flex justify-between items-center">
              <span className="font-semibold">{t("trackOrder.total")}</span>
              <span className="font-bold text-primary">AED {Number(order.total).toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
      {/* Chat Modal */}
      {isChatOpen && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-gray-800 w-full max-w-lg h-[80vh] sm:h-[600px] sm:rounded-2xl flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300">
            {/* Header */}
            <div className="px-6 py-4 bg-primary text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold">{tracking?.driver?.name || t("trackOrder.yourDriver")}</h3>
                  <p className="text-xs text-white/80">{t("trackOrder.liveChat")}</p>
                </div>
              </div>
              <button
                onClick={() => setIsChatOpen(false)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Messages */}
            <div
              ref={chatMessagesRef}
              className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-gray-900"
            >
              {chatMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <div className="w-16 h-16 bg-slate-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                    <MessageCircle className="w-8 h-8 opacity-20" />
                  </div>
                  <p className="text-sm">{t("trackOrder.startChat")}</p>
                </div>
              ) : (
                chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex flex-col",
                      msg.sender === "user" ? "items-end" : "items-start"
                    )}
                  >
                    <div className={cn(
                      "max-w-[85%] rounded-2xl px-4 py-2 text-sm shadow-sm",
                      msg.sender === "user"
                        ? "bg-primary text-white rounded-tr-none"
                        : "bg-white dark:bg-gray-800 text-slate-900 dark:text-gray-100 rounded-tl-none border border-slate-100 dark:border-gray-700"
                    )}>
                      {msg.text}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {msg.attachments.map(att => (
                            <div key={att.id} className="bg-white/10 p-2 rounded flex items-center gap-2">
                              {att.type.startsWith("image/") ? (
                                <img src={att.url} className="w-full rounded" />
                              ) : (
                                <span className="truncate">{att.name}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 px-1">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Input */}
            <div className="p-4 bg-white dark:bg-gray-800 border-t border-slate-100 dark:border-gray-700">
              <div className="flex items-center gap-2 bg-slate-100 dark:bg-gray-900 rounded-full px-4 py-2 border border-slate-200 dark:border-gray-700 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                <input
                  type="text"
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder={t("trackOrder.typeMessage")}
                  className="flex-1 bg-transparent border-none outline-none text-sm dark:text-white"
                />
                <button
                  onClick={handleSend}
                  disabled={!chatMessage.trim()}
                  className="p-1.5 bg-primary text-white rounded-full disabled:opacity-50 transition-all hover:scale-105 active:scale-95 shadow-lg"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Add these to lucide-react imports at the top
// X, MessageCircle, Send
