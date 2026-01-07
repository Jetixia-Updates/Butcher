import React from "react";
import { useLanguage } from "@/context/LanguageContext";

interface ContactLink {
  icon: string;
  label: string;
  value: string;
  href?: string;
}

export const Footer: React.FC = () => {
  const { t } = useLanguage();
  const contacts: ContactLink[] = [
    {
      icon: "📍",
      label: t("footer.address"),
      value: "Dubai, UAE",
      href: "#",
    },
    {
      icon: "☎",
      label: t("footer.phone"),
      value: "+971 50 123 4567",
      href: "tel:+971501234567",
    },
    {
      icon: "📱",
      label: t("footer.whatsapp"),
      value: "+971 50 123 4567",
      href: "https://wa.me/971501234567",
    },
    {
      icon: "🟢",
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
                <a href="/about" className="hover:underline">
                  {t("footer.about")}
                </a>
              </li>
              <li>
                <a href="/faq" className="hover:underline">
                  {t("footer.faq")}
                </a>
              </li>
              <li>
                <a href="/contact" className="hover:underline">
                  {t("footer.contact")}
                </a>
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
                <div className="text-2xl mb-2">{contact.icon}</div>
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
    </footer>
  );
};
