import React from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";

interface LayoutProps {
  children: React.ReactNode;
  showHeader?: boolean;
  showBasketIcon?: boolean;
  showFooter?: boolean;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  showHeader = true,
  showBasketIcon = true,
  showFooter = true,
}) => {
  return (
    <div className="min-h-screen flex flex-col">
      {showHeader && <Header showBasketIcon={showBasketIcon} />}
      <main className="flex-1">{children}</main>
      {showFooter && <Footer />}
    </div>
  );
};
