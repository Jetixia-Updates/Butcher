import React from "react";
import { useLanguage } from "@/context/LanguageContext";
import { useSettings } from "@/context/SettingsContext";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Privacy: React.FC = () => {
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
            {isRTL ? "سياسة الخصوصية" : "Privacy Policy"}
          </h1>
          <p className="text-sm text-muted-foreground mb-8">
            {isRTL 
              ? "آخر تحديث: يناير 2026 | متوافق مع قوانين حماية البيانات في دولة الإمارات" 
              : "Last Updated: January 2026 | Compliant with UAE Data Protection Laws"}
          </p>

          <div className="space-y-8 text-foreground">
            {/* Commitment */}
            <section className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
              <h2 className="text-xl font-semibold mb-3 flex items-center gap-2 text-blue-700 dark:text-blue-400">
                <span>🔒</span>
                {isRTL ? "التزامنا بحماية خصوصيتك" : "Our Commitment to Your Privacy"}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {isRTL
                  ? "نحن في الجزار نلتزم بحماية خصوصيتك وبياناتك الشخصية وفقاً للمرسوم بقانون اتحادي رقم (45) لسنة 2021 بشأن حماية البيانات الشخصية في دولة الإمارات العربية المتحدة."
                  : "At Al Jazzar Butcher Shop, we are committed to protecting your privacy and personal data in accordance with UAE Federal Decree-Law No. (45) of 2021 on Personal Data Protection."}
              </p>
            </section>

            {/* Data We Collect */}
            <section>
              <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                <span>📊</span>
                {isRTL ? "البيانات التي نجمعها" : "Data We Collect"}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-secondary/20 p-4 rounded-xl">
                  <h3 className="font-semibold mb-2 text-primary">{isRTL ? "بيانات الهوية" : "Identity Data"}</h3>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>• {isRTL ? "الاسم الأول واسم العائلة" : "First name and family name"}</li>
                    <li>• {isRTL ? "رقم الهاتف المحمول" : "Mobile phone number"}</li>
                    <li>• {isRTL ? "البريد الإلكتروني" : "Email address"}</li>
                  </ul>
                </div>
                <div className="bg-secondary/20 p-4 rounded-xl">
                  <h3 className="font-semibold mb-2 text-primary">{isRTL ? "بيانات التوصيل" : "Delivery Data"}</h3>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>• {isRTL ? "عنوان التوصيل" : "Delivery address"}</li>
                    <li>• {isRTL ? "الإمارة والمنطقة" : "Emirate and area"}</li>
                    <li>• {isRTL ? "تعليمات التوصيل" : "Delivery instructions"}</li>
                  </ul>
                </div>
                <div className="bg-secondary/20 p-4 rounded-xl">
                  <h3 className="font-semibold mb-2 text-primary">{isRTL ? "بيانات المعاملات" : "Transaction Data"}</h3>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>• {isRTL ? "سجل الطلبات" : "Order history"}</li>
                    <li>• {isRTL ? "طرق الدفع المستخدمة" : "Payment methods used"}</li>
                    <li>• {isRTL ? "رصيد المحفظة" : "Wallet balance"}</li>
                  </ul>
                </div>
                <div className="bg-secondary/20 p-4 rounded-xl">
                  <h3 className="font-semibold mb-2 text-primary">{isRTL ? "البيانات التقنية" : "Technical Data"}</h3>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>• {isRTL ? "عنوان IP" : "IP address"}</li>
                    <li>• {isRTL ? "نوع الجهاز والمتصفح" : "Device and browser type"}</li>
                    <li>• {isRTL ? "الموقع الجغرافي (بإذنك)" : "Location (with your consent)"}</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* How We Use Data */}
            <section>
              <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                <span>⚙️</span>
                {isRTL ? "كيف نستخدم بياناتك" : "How We Use Your Data"}
              </h2>
              <ul className="space-y-3 text-muted-foreground">
                <li className="flex items-start gap-3">
                  <span className="text-green-500 text-xl">✓</span>
                  <div>
                    <strong>{isRTL ? "معالجة الطلبات:" : "Order Processing:"}</strong>
                    <p className="text-sm mt-1">
                      {isRTL
                        ? "لمعالجة طلباتك وتوصيلها وتتبعها"
                        : "To process, deliver, and track your orders"}
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-green-500 text-xl">✓</span>
                  <div>
                    <strong>{isRTL ? "التواصل معك:" : "Communication:"}</strong>
                    <p className="text-sm mt-1">
                      {isRTL
                        ? "لإرسال تحديثات الطلبات والعروض الترويجية (بموافقتك)"
                        : "To send order updates and promotional offers (with your consent)"}
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-green-500 text-xl">✓</span>
                  <div>
                    <strong>{isRTL ? "تحسين الخدمة:" : "Service Improvement:"}</strong>
                    <p className="text-sm mt-1">
                      {isRTL
                        ? "لتحليل أنماط الاستخدام وتحسين تجربتك"
                        : "To analyze usage patterns and improve your experience"}
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-green-500 text-xl">✓</span>
                  <div>
                    <strong>{isRTL ? "الامتثال القانوني:" : "Legal Compliance:"}</strong>
                    <p className="text-sm mt-1">
                      {isRTL
                        ? "للامتثال للمتطلبات القانونية والتنظيمية"
                        : "To comply with legal and regulatory requirements"}
                    </p>
                  </div>
                </li>
              </ul>
            </section>

            {/* Data Protection */}
            <section>
              <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                <span>🛡️</span>
                {isRTL ? "حماية بياناتك" : "Protecting Your Data"}
              </h2>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  {isRTL
                    ? "نستخدم تشفير SSL لحماية جميع البيانات المنقولة"
                    : "We use SSL encryption to protect all transmitted data"}
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  {isRTL
                    ? "لا نخزن تفاصيل بطاقات الدفع على خوادمنا"
                    : "We do not store payment card details on our servers"}
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  {isRTL
                    ? "الوصول إلى البيانات الشخصية مقيد بالموظفين المصرح لهم فقط"
                    : "Access to personal data is restricted to authorized personnel only"}
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  {isRTL
                    ? "نجري مراجعات أمنية منتظمة لأنظمتنا"
                    : "We conduct regular security audits of our systems"}
                </li>
              </ul>
            </section>

            {/* Your Rights */}
            <section>
              <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                <span>✋</span>
                {isRTL ? "حقوقك" : "Your Rights"}
              </h2>
              <p className="text-muted-foreground mb-4">
                {isRTL
                  ? "وفقاً لقوانين حماية البيانات الإماراتية، لديك الحق في:"
                  : "Under UAE Data Protection laws, you have the right to:"}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-center gap-3 bg-secondary/20 p-3 rounded-lg">
                  <span className="text-2xl">👁️</span>
                  <span className="text-sm">{isRTL ? "الوصول إلى بياناتك" : "Access your data"}</span>
                </div>
                <div className="flex items-center gap-3 bg-secondary/20 p-3 rounded-lg">
                  <span className="text-2xl">✏️</span>
                  <span className="text-sm">{isRTL ? "تصحيح بياناتك" : "Correct your data"}</span>
                </div>
                <div className="flex items-center gap-3 bg-secondary/20 p-3 rounded-lg">
                  <span className="text-2xl">🗑️</span>
                  <span className="text-sm">{isRTL ? "حذف بياناتك" : "Delete your data"}</span>
                </div>
                <div className="flex items-center gap-3 bg-secondary/20 p-3 rounded-lg">
                  <span className="text-2xl">📤</span>
                  <span className="text-sm">{isRTL ? "نقل بياناتك" : "Port your data"}</span>
                </div>
                <div className="flex items-center gap-3 bg-secondary/20 p-3 rounded-lg">
                  <span className="text-2xl">🚫</span>
                  <span className="text-sm">{isRTL ? "الاعتراض على المعالجة" : "Object to processing"}</span>
                </div>
                <div className="flex items-center gap-3 bg-secondary/20 p-3 rounded-lg">
                  <span className="text-2xl">⏸️</span>
                  <span className="text-sm">{isRTL ? "تقييد المعالجة" : "Restrict processing"}</span>
                </div>
              </div>
            </section>

            {/* Data Sharing */}
            <section>
              <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                <span>🤝</span>
                {isRTL ? "مشاركة البيانات" : "Data Sharing"}
              </h2>
              <p className="text-muted-foreground mb-4">
                {isRTL
                  ? "قد نشارك بياناتك مع:"
                  : "We may share your data with:"}
              </p>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <strong>{isRTL ? "شركاء التوصيل:" : "Delivery Partners:"}</strong>
                  {isRTL
                    ? " لتوصيل طلباتك (العنوان ورقم الهاتف فقط)"
                    : " To deliver your orders (address and phone only)"}
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <strong>{isRTL ? "مزودي الدفع:" : "Payment Providers:"}</strong>
                  {isRTL
                    ? " لمعالجة المدفوعات بشكل آمن"
                    : " To process payments securely"}
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <strong>{isRTL ? "الجهات الحكومية:" : "Government Authorities:"}</strong>
                  {isRTL
                    ? " عند الطلب القانوني فقط"
                    : " Only when legally required"}
                </li>
              </ul>
              <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
                  <span>🚫</span>
                  {isRTL
                    ? "لا نبيع بياناتك الشخصية لأي طرف ثالث"
                    : "We never sell your personal data to any third party"}
                </p>
              </div>
            </section>

            {/* Cookies */}
            <section>
              <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                <span>🍪</span>
                {isRTL ? "ملفات تعريف الارتباط" : "Cookies"}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {isRTL
                  ? "نستخدم ملفات تعريف الارتباط لتحسين تجربتك وتذكر تفضيلاتك. يمكنك التحكم في إعدادات ملفات تعريف الارتباط من خلال متصفحك."
                  : "We use cookies to improve your experience and remember your preferences. You can control cookie settings through your browser."}
              </p>
            </section>

            {/* Data Retention */}
            <section>
              <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                <span>📅</span>
                {isRTL ? "الاحتفاظ بالبيانات" : "Data Retention"}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {isRTL
                  ? "نحتفظ ببياناتك طالما كان حسابك نشطاً أو حسب الحاجة لتقديم الخدمات. قد نحتفظ ببعض البيانات لفترة أطول للامتثال للمتطلبات القانونية (مثل السجلات المالية لمدة 5 سنوات)."
                  : "We retain your data as long as your account is active or as needed to provide services. We may retain certain data longer to comply with legal requirements (e.g., financial records for 5 years)."}
              </p>
            </section>

            {/* Contact */}
            <section className="bg-secondary/20 rounded-xl p-6">
              <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                <span>📞</span>
                {isRTL ? "مسؤول حماية البيانات" : "Data Protection Officer"}
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                {isRTL
                  ? "للاستفسارات حول خصوصيتك أو لممارسة حقوقك:"
                  : "For privacy inquiries or to exercise your rights:"}
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

export default Privacy;
