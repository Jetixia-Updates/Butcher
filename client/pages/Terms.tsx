import React from "react";
import { useLanguage } from "@/context/LanguageContext";
import { useSettings } from "@/context/SettingsContext";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Terms: React.FC = () => {
  const { language } = useLanguage();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const isRTL = language === "ar";

  return (
    <div className={`min-h-screen bg-background ${isRTL ? "rtl" : "ltr"}`}>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className={`w-5 h-5 ${isRTL ? "rotate-180" : ""}`} />
          <span>{isRTL ? "رجوع" : "Back"}</span>
        </button>

        <div className="card-premium p-6 sm:p-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
            {isRTL ? "الشروط والأحكام" : "Terms & Conditions"}
          </h1>
          <p className="text-sm text-muted-foreground mb-8">
            {isRTL 
              ? "آخر تحديث: يناير 2026 | متوافق مع قوانين وزارة الاقتصاد الإماراتية" 
              : "Last Updated: January 2026 | Compliant with UAE Ministry of Economy Laws"}
          </p>

          <div className="space-y-8 text-foreground">
            {/* Introduction */}
            <section>
              <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                <span>📋</span>
                {isRTL ? "مقدمة" : "Introduction"}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {isRTL
                  ? "مرحباً بكم في الجزار. بالدخول إلى موقعنا واستخدام خدماتنا، فإنك توافق على الالتزام بهذه الشروط والأحكام وفقاً للقانون الاتحادي رقم (15) لسنة 2020 بشأن حماية المستهلك في دولة الإمارات العربية المتحدة."
                  : "Welcome to Al Jazzar Butcher Shop. By accessing our website and using our services, you agree to be bound by these Terms and Conditions in accordance with UAE Federal Law No. (15) of 2020 on Consumer Protection."}
              </p>
            </section>

            {/* License & Registration */}
            <section>
              <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                <span>🏛️</span>
                {isRTL ? "الترخيص والتسجيل" : "License & Registration"}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {isRTL
                  ? "نحن شركة مسجلة قانونياً في دولة الإمارات العربية المتحدة، ونعمل وفقاً لجميع اللوائح التي تحكم تجارة الأغذية والتجارة الإلكترونية. نحن نمتلك جميع التراخيص اللازمة من دائرة التنمية الاقتصادية وبلدية دبي وهيئة سلامة الغذاء."
                  : "We are a legally registered company in the United Arab Emirates, operating in compliance with all regulations governing food trade and e-commerce. We hold all necessary licenses from the Department of Economic Development (DED), Dubai Municipality, and Food Safety Authority."}
              </p>
            </section>

            {/* Product Quality */}
            <section>
              <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                <span>✅</span>
                {isRTL ? "جودة المنتجات" : "Product Quality"}
              </h2>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  {isRTL
                    ? "جميع منتجات اللحوم حلال 100% ومعتمدة من هيئة الإمارات للمواصفات والمقاييس (إيسما)"
                    : "All meat products are 100% Halal certified by Emirates Authority for Standardization & Metrology (ESMA)"}
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  {isRTL
                    ? "نضمن نضارة وجودة جميع المنتجات وفقاً لمعايير سلامة الغذاء الإماراتية"
                    : "We guarantee freshness and quality of all products as per UAE Food Safety Standards"}
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  {isRTL
                    ? "يتم تخزين ونقل جميع المنتجات في درجات حرارة مناسبة وفقاً لمتطلبات هاسب"
                    : "All products are stored and transported at appropriate temperatures as per HACCP requirements"}
                </li>
              </ul>
            </section>

            {/* Pricing & Payment */}
            <section>
              <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                <span>💰</span>
                {isRTL ? "الأسعار والدفع" : "Pricing & Payment"}
              </h2>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  {isRTL
                    ? "جميع الأسعار معروضة بالدرهم الإماراتي وتشمل ضريبة القيمة المضافة (5%)"
                    : "All prices are displayed in UAE Dirhams (AED) and include VAT (5%)"}
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  {isRTL
                    ? "نقبل الدفع ببطاقات فيزا وماستركارد والدفع عند الاستلام"
                    : "We accept Visa, Mastercard, and Cash on Delivery (COD)"}
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  {isRTL
                    ? "الأسعار قابلة للتغيير دون إشعار مسبق، ولكن الطلبات المؤكدة تحتفظ بسعرها الأصلي"
                    : "Prices are subject to change without prior notice, but confirmed orders retain their original price"}
                </li>
              </ul>
            </section>

            {/* Delivery */}
            <section>
              <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                <span>🚚</span>
                {isRTL ? "التوصيل" : "Delivery"}
              </h2>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  {isRTL
                    ? "نقدم خدمة التوصيل إلى جميع الإمارات"
                    : "We provide delivery services across all Emirates"}
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  {isRTL
                    ? "توصيل مجاني للطلبات التي تتجاوز 200 درهم"
                    : "Free delivery for orders above AED 200"}
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  {isRTL
                    ? "أوقات التوصيل المتوقعة هي تقديرية وقد تختلف بناءً على الموقع والظروف"
                    : "Estimated delivery times are approximate and may vary based on location and conditions"}
                </li>
              </ul>
            </section>

            {/* User Obligations */}
            <section>
              <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                <span>👤</span>
                {isRTL ? "التزامات المستخدم" : "User Obligations"}
              </h2>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  {isRTL
                    ? "يجب عليك تقديم معلومات دقيقة وصحيحة عند إنشاء الحساب وتقديم الطلبات"
                    : "You must provide accurate and correct information when creating an account and placing orders"}
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  {isRTL
                    ? "أنت مسؤول عن الحفاظ على سرية بيانات حسابك"
                    : "You are responsible for maintaining the confidentiality of your account credentials"}
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  {isRTL
                    ? "يُحظر استخدام الموقع لأي أغراض غير قانونية"
                    : "Using the website for any unlawful purposes is prohibited"}
                </li>
              </ul>
            </section>

            {/* Dispute Resolution */}
            <section>
              <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                <span>⚖️</span>
                {isRTL ? "تسوية النزاعات" : "Dispute Resolution"}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {isRTL
                  ? "في حالة وجود أي نزاع، نشجع على التواصل معنا أولاً لحل المشكلة ودياً. إذا تعذر الوصول إلى حل، يحق للمستهلك تقديم شكوى إلى وزارة الاقتصاد أو دائرة حماية المستهلك وفقاً للقانون الإماراتي."
                  : "In case of any dispute, we encourage you to contact us first for an amicable resolution. If a resolution cannot be reached, the consumer has the right to file a complaint with the Ministry of Economy or Consumer Protection Department as per UAE law."}
              </p>
            </section>

            {/* Governing Law */}
            <section>
              <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                <span>🇦🇪</span>
                {isRTL ? "القانون الحاكم" : "Governing Law"}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {isRTL
                  ? "تخضع هذه الشروط والأحكام لقوانين دولة الإمارات العربية المتحدة، وتختص محاكم دبي بالنظر في أي نزاعات تنشأ عنها."
                  : "These Terms and Conditions are governed by the laws of the United Arab Emirates. The courts of Dubai shall have exclusive jurisdiction over any disputes arising from these terms."}
              </p>
            </section>

            {/* Contact */}
            <section className="bg-secondary/20 rounded-xl p-6">
              <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                <span>📞</span>
                {isRTL ? "تواصل معنا" : "Contact Us"}
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                {isRTL
                  ? "للاستفسارات حول هذه الشروط والأحكام:"
                  : "For inquiries about these Terms and Conditions:"}
              </p>
              <div className="space-y-2 text-muted-foreground">
                <p>📧 Email: {settings.contactEmail}</p>
                <p>📱 Phone: {settings.contactPhone}</p>
                <p>📍 {isRTL ? "دبي، الإمارات العربية المتحدة" : "Dubai, United Arab Emirates"}</p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Terms;
