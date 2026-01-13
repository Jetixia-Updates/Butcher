import React, { useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { X } from "lucide-react";

interface ContactLink {
  icon: React.ReactNode;
  label: string;
  value: string;
  href?: string;
}

// WhatsApp SVG Icon Component
const WhatsAppIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    viewBox="0 0 24 24" 
    className={className}
    fill="currentColor"
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

// Coming Soon Modal Component
const ComingSoonModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { language } = useLanguage();
  
  if (!isOpen) return null;
  
  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-gradient-to-br from-primary/10 via-background to-secondary/10 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-300 border border-primary/20"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        
        {/* Content */}
        <div className="p-8 text-center relative overflow-hidden">
          {/* Decorative elements */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-40 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-full blur-3xl -z-10" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-r from-secondary/20 to-primary/20 rounded-full blur-2xl -z-10" />
          
          {/* Icon */}
          <div className="mb-6 inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-primary to-secondary text-white text-4xl animate-pulse">
            🚀
          </div>
          
          {/* Title with shiny effect */}
          <h2 
            className="text-2xl md:text-3xl font-bold mb-4 bg-gradient-to-r from-primary via-secondary to-primary bg-[length:200%_auto] animate-[shimmer_3s_linear_infinite] bg-clip-text text-transparent"
            style={{
              backgroundSize: "200% auto",
            }}
          >
            {language === "ar" ? "قريباً!" : "Coming Soon!"}
          </h2>
          
          {/* Message */}
          <p className="text-foreground/80 text-lg leading-relaxed mb-6">
            {language === "ar" 
              ? "هذه الصفحة قيد التطوير حالياً. سنكون متاحين قريباً. شكراً لصبرك!"
              : "This page is currently under development. We will be live soon. Thank you for your patience!"
            }
          </p>
          
          {/* Decorative stars */}
          <div className="flex justify-center gap-2 text-2xl">
            <span className="animate-bounce" style={{ animationDelay: "0s" }}>✨</span>
            <span className="animate-bounce" style={{ animationDelay: "0.1s" }}>⭐</span>
            <span className="animate-bounce" style={{ animationDelay: "0.2s" }}>✨</span>
          </div>
          
          {/* Close button */}
          <button
            onClick={onClose}
            className="mt-6 px-8 py-3 bg-gradient-to-r from-primary to-secondary text-white font-semibold rounded-full hover:opacity-90 transition-opacity shadow-lg hover:shadow-xl"
          >
            {language === "ar" ? "حسناً" : "Got it!"}
          </button>
        </div>
      </div>
    </div>
  );
};

export const Footer: React.FC = () => {
  const { t } = useLanguage();
  const [showComingSoon, setShowComingSoon] = useState(false);
  
  const contacts: ContactLink[] = [
    {
      icon: <span className="text-2xl">📍</span>,
      label: t("footer.address"),
      value: "Dubai, UAE",
      href: "#",
    },
    {
      icon: <span className="text-2xl">📱</span>,
      label: t("footer.phone"),
      value: "+971 50 123 4567",
      href: "tel:+971501234567",
    },
    {
      icon: <WhatsAppIcon className="w-7 h-7 mx-auto text-[#25D366]" />,
      label: t("footer.whatsapp"),
      value: "+971 50 123 4567",
      href: "https://wa.me/971501234567",
    },
    {
      icon: <span className="text-2xl">🟢</span>,
      label: t("footer.status"),
      value: "Open Now",
    },
  ];

  return (
    <footer className="bg-accent text-accent-foreground py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* Brand */}
          <div>
            <h3 className="text-2xl font-bold mb-2">🥩 {t("footer.title")}</h3>
            <p className="text-accent-foreground/80 text-sm">
              {t("footer.description")}
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold mb-3">{t("footer.quickLinks")}</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="/products" className="hover:underline">
                  {t("footer.products")}
                </a>
              </li>
              <li>
                <button 
                  onClick={() => setShowComingSoon(true)} 
                  className="hover:underline text-left"
                >
                  {t("footer.about")}
                </button>
              </li>
              <li>
                <button 
                  onClick={() => setShowComingSoon(true)} 
                  className="hover:underline text-left"
                >
                  {t("footer.faq")}
                </button>
              </li>
              <li>
                <button 
                  onClick={() => setShowComingSoon(true)} 
                  className="hover:underline text-left"
                >
                  {t("footer.contact")}
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* Contact Info */}
        <div className="border-t border-accent-foreground/20 pt-8">
          <h4 className="font-semibold mb-4">{t("footer.contactUs")}</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {contacts.map((contact) => (
              <div key={contact.label} className="text-center">
                <div className="mb-2 flex justify-center items-center h-8">{contact.icon}</div>
                <p className="text-xs font-semibold mb-1">{contact.label}</p>
                {contact.href ? (
                  <a
                    href={contact.href}
                    className="text-xs hover:underline break-all"
                  >
                    {contact.value}
                  </a>
                ) : (
                  <p className="text-xs">{contact.value}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-accent-foreground/20 mt-8 pt-8 text-center text-sm text-accent-foreground/60">
          <p>
            © {new Date().getFullYear()} {t("footer.title")}. {t("footer.rights")}
          </p>
          <p className="mt-2">
            <a href="/terms" className="hover:underline">
              {t("footer.terms")}
            </a>
            {" · "}
            <a href="/privacy" className="hover:underline">
              {t("footer.privacy")}
            </a>
            {" · "}
            <a href="/returns" className="hover:underline">
              {t("footer.returns")}
            </a>
          </p>
        </div>
      </div>
      {/* Coming Soon Modal */}
      <ComingSoonModal isOpen={showComingSoon} onClose={() => setShowComingSoon(false)} />
    </footer>
  );
};
