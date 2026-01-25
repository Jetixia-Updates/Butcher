
import { db } from "./server/db/connection";
import { appSettings, banners, deliveryTimeSlots } from "./server/db/schema";
import { eq } from "drizzle-orm";

const DEFAULT_SETTINGS = {
    id: "default",
    vatRate: "0.05",
    deliveryFee: "15",
    freeDeliveryThreshold: "200",
    expressDeliveryFee: "25",
    minimumOrderAmount: "50",
    maxOrdersPerDay: 100,
    enableCashOnDelivery: true,
    enableCardPayment: true,
    enableWallet: true,
    enableLoyalty: true,
    enableReviews: true,
    enableWishlist: true,
    enableExpressDelivery: true,
    enableScheduledDelivery: true,
    enableWelcomeBonus: true,
    welcomeBonus: "50",
    cashbackPercentage: "2",
    loyaltyPointsPerAed: "1",
    loyaltyPointValue: "0.1",
    storePhone: "+971 4 123 4567",
    storeEmail: "support@aljazirabutcher.ae",
    storeAddress: "Al Jazira Butcher Shop, Dubai, UAE",
    storeAddressAr: "ملحمة الجزيرة، دبي، الإمارات العربية المتحدة",
    workingHoursStart: "08:00",
    workingHoursEnd: "22:00",
};

async function testSettings() {
    try {
        console.log("Checking app settings...");
        const current = await db.select().from(appSettings).where(eq(appSettings.id, "default"));
        console.log("Current settings:", current);

        if (current.length === 0) {
            console.log("Inserting default settings...");
            await db.insert(appSettings).values(DEFAULT_SETTINGS);
            console.log("Insert success!");
        } else {
            console.log("Settings exist.");
        }
    } catch (error) {
        console.error("Error in settings test:", error);
    } finally {
        process.exit(0);
    }
}

testSettings();
