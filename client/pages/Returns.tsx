import React from "react";
import { useLanguage } from "@/context/LanguageContext";
import { useSettings } from "@/context/SettingsContext";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Returns: React.FC = () => {
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
            {isRTL ? "سياسة الإرجاع والاستبدال" : "Return & Refund Policy"}
          </h1>
          <p className="text-sm text-muted-foreground mb-8">
            {isRTL 
              ? "آخر تحديث: يناير 2026 | متوافق مع القانون الاتحادي رقم (15) لسنة 2020 بشأن حماية المستهلك" 
              : "Last Updated: January 2026 | Compliant with UAE Federal Law No. (15) of 2020 on Consumer Protection"}
          </p>

          <div className="space-y-8 text-foreground">
            {/* Consumer Rights */}
            <section className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-6">
              <h2 className="text-xl font-semibold mb-3 flex items-center gap-2 text-green-700 dark:text-green-400">
                <span>⚖️</span>
                {isRTL ? "حقوق المستهلك الإماراتي" : "UAE Consumer Rights"}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {isRTL
                  ? "وفقاً للقانون الاتحادي رقم (15) لسنة 2020 بشأن حماية المستهلك، يحق لك استبدال أو استرداد المنتجات المعيبة أو التي لا تطابق المواصفات المتفق عليها. نحن ملتزمون بحماية حقوقك كمستهلك."
                  : "As per UAE Federal Law No. (15) of 2020 on Consumer Protection, you have the right to exchange or refund defective products or those that do not match agreed specifications. We are committed to protecting your consumer rights."}
              </p>
            </section>

            {/* Eligibility for Returns */}
            <section>
              <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                <span>✅</span>
                {isRTL ? "شروط قبول الإرجاع" : "Eligibility for Returns"}
              </h2>
              <p className="text-muted-foreground mb-4">
                {isRTL
                  ? "نظراً لطبيعة منتجاتنا (اللحوم الطازجة والمبردة)، يُقبل الإرجاع في الحالات التالية:"
                  : "Due to the nature of our products (fresh and chilled meats), returns are accepted in the following cases:"}
              </p>
              <ul className="space-y-3 text-muted-foreground">
                <li className="flex items-start gap-3 bg-secondary/20 p-3 rounded-lg">
                  <span className="text-green-500 text-xl">✓</span>
                  <div>
                    <strong>{isRTL ? "منتج معيب أو تالف:" : "Defective or Damaged Product:"}</strong>
                    <p className="text-sm mt-1">
                      {isRTL
                        ? "إذا استلمت منتجاً تالفاً أو فاسداً أو غير صالح للاستهلاك"
                        : "If you receive a product that is damaged, spoiled, or unfit for consumption"}
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3 bg-secondary/20 p-3 rounded-lg">
                  <span className="text-green-500 text-xl">✓</span>
                  <div>
                    <strong>{isRTL ? "منتج غير مطابق للطلب:" : "Wrong Product Delivered:"}</strong>
                    <p className="text-sm mt-1">
                      {isRTL
                        ? "إذا استلمت منتجاً مختلفاً عما طلبته"
                        : "If you receive a product different from what you ordered"}
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3 bg-secondary/20 p-3 rounded-lg">
                  <span className="text-green-500 text-xl">✓</span>
                  <div>
                    <strong>{isRTL ? "كمية غير صحيحة:" : "Incorrect Quantity:"}</strong>
                    <p className="text-sm mt-1">
                      {isRTL
                        ? "إذا كانت الكمية المستلمة أقل من الكمية المطلوبة"
                        : "If the quantity received is less than what was ordered"}
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3 bg-secondary/20 p-3 rounded-lg">
                  <span className="text-green-500 text-xl">✓</span>
                  <div>
                    <strong>{isRTL ? "جودة غير مرضية:" : "Unsatisfactory Quality:"}</strong>
                    <p className="text-sm mt-1">
                      {isRTL
                        ? "إذا لم يلبِ المنتج معايير الجودة المتوقعة"
                        : "If the product does not meet expected quality standards"}
                    </p>
                  </div>
                </li>
              </ul>
            </section>

            {/* Return Process */}
            <section>
              <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                <span>📋</span>
                {isRTL ? "خطوات الإرجاع" : "Return Process"}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-primary/5 rounded-xl border border-primary/20">
                  <div className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto mb-3 text-xl font-bold">1</div>
                  <h3 className="font-semibold mb-2">{isRTL ? "إبلاغنا فوراً" : "Notify Us Immediately"}</h3>
                  <p className="text-sm text-muted-foreground">
                    {isRTL
                      ? "تواصل معنا خلال ساعتين من استلام الطلب"
                      : "Contact us within 2 hours of receiving your order"}
                  </p>
                </div>
                <div className="text-center p-4 bg-primary/5 rounded-xl border border-primary/20">
                  <div className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto mb-3 text-xl font-bold">2</div>
                  <h3 className="font-semibold mb-2">{isRTL ? "إرسال الصور" : "Send Photos"}</h3>
                  <p className="text-sm text-muted-foreground">
                    {isRTL
                      ? "أرسل صوراً واضحة للمنتج المعيب عبر واتساب"
                      : "Send clear photos of the defective product via WhatsApp"}
                  </p>
                </div>
                <div className="text-center p-4 bg-primary/5 rounded-xl border border-primary/20">
                  <div className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto mb-3 text-xl font-bold">3</div>
                  <h3 className="font-semibold mb-2">{isRTL ? "الحل" : "Resolution"}</h3>
                  <p className="text-sm text-muted-foreground">
                    {isRTL
                      ? "سنقوم بالاستبدال أو الاسترداد خلال 24 ساعة"
                      : "We will replace or refund within 24 hours"}
                  </p>
                </div>
              </div>
            </section>

            {/* Time Limits */}
            <section>
              <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                <span>⏰</span>
                {isRTL ? "المهلة الزمنية" : "Time Limits"}
              </h2>
              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-6">
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <span className="text-orange-500">⚠️</span>
                    {isRTL
                      ? "يجب الإبلاغ عن أي مشكلة خلال ساعتين (2) من استلام الطلب"
                      : "Issues must be reported within 2 hours of receiving the order"}
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-orange-500">⚠️</span>
                    {isRTL
                      ? "لا يُقبل الإرجاع بعد فتح المنتج أو تخزينه بشكل غير صحيح"
                      : "Returns are not accepted after opening the product or improper storage"}
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-orange-500">⚠️</span>
                    {isRTL
                      ? "يجب الاحتفاظ بالمنتج في حالته الأصلية حتى إتمام الإرجاع"
                      : "Product must be kept in original condition until return is completed"}
                  </li>
                </ul>
              </div>
            </section>

            {/* Refund Methods */}
            <section>
              <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                <span>💳</span>
                {isRTL ? "طرق الاسترداد" : "Refund Methods"}
              </h2>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <strong>{isRTL ? "الدفع بالبطاقة:" : "Card Payment:"}</strong>
                  {isRTL
                    ? " يتم الاسترداد إلى نفس البطاقة خلال 5-14 يوم عمل"
                    : " Refund to the same card within 5-14 business days"}
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <strong>{isRTL ? "الدفع عند الاستلام:" : "Cash on Delivery:"}</strong>
                  {isRTL
                    ? " يتم الاسترداد نقداً أو إضافته كرصيد للمحفظة"
                    : " Refund in cash or added as wallet credit"}
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <strong>{isRTL ? "رصيد المحفظة:" : "Wallet Credit:"}</strong>
                  {isRTL
                    ? " يتم الاسترداد فوراً إلى محفظتك"
                    : " Instant refund to your wallet"}
                </li>
              </ul>
            </section>

            {/* Non-Returnable Items */}
            <section>
              <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                <span>🚫</span>
                {isRTL ? "المنتجات غير القابلة للإرجاع" : "Non-Returnable Items"}
              </h2>
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6">
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <span className="text-red-500">✗</span>
                    {isRTL
                      ? "المنتجات المتبلة أو المعدة حسب الطلب"
                      : "Marinated or custom-prepared products"}
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-red-500">✗</span>
                    {isRTL
                      ? "المنتجات التي تم تخزينها بشكل غير صحيح من قبل العميل"
                      : "Products stored improperly by the customer"}
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-red-500">✗</span>
                    {isRTL
                      ? "المنتجات التي تم الإبلاغ عنها بعد المهلة المحددة"
                      : "Products reported after the specified time limit"}
                  </li>
                </ul>
              </div>
            </section>

            {/* Consumer Protection */}
            <section>
              <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                <span>🛡️</span>
                {isRTL ? "حماية المستهلك" : "Consumer Protection"}
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                {isRTL
                  ? "إذا لم تكن راضياً عن حل المشكلة، يمكنك تقديم شكوى إلى:"
                  : "If you are not satisfied with the resolution, you may file a complaint with:"}
              </p>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  {isRTL ? "وزارة الاقتصاد - قسم حماية المستهلك" : "Ministry of Economy - Consumer Protection Department"}
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  {isRTL ? "دائرة التنمية الاقتصادية في إمارتك" : "Department of Economic Development in your Emirate"}
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  {isRTL ? "الخط الساخن لحماية المستهلك: 600 522 225" : "Consumer Protection Hotline: 600 522 225"}
                </li>
              </ul>
            </section>

            {/* Contact */}
            <section className="bg-secondary/20 rounded-xl p-6">
              <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                <span>📞</span>
                {isRTL ? "تواصل معنا للإرجاع" : "Contact Us for Returns"}
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                {isRTL
                  ? "للإبلاغ عن مشكلة أو طلب إرجاع:"
                  : "To report an issue or request a return:"}
              </p>
              <div className="space-y-2 text-muted-foreground">
                <p>📱 WhatsApp: {settings.contactPhone}</p>
                <p>📧 Email: {settings.contactEmail}</p>
                <p>☎️ Phone: {settings.contactPhone}</p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Returns;
