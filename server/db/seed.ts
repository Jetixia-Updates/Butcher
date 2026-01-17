/**
 * Database Seed Script for Butcher Shop
 * Seeds the PostgreSQL database with initial data
 */

import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const sql = neon(databaseUrl);
const db = drizzle(sql, { schema });

// ID generator
const generateId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

async function seedDatabase() {
  console.log("🌱 Starting database seed...");

  try {
    // =====================================================
    // SEED PRODUCTS
    // =====================================================
    console.log("📦 Seeding products...");
    
    const productsData = [
      {
        id: "prod_1",
        name: "Premium Beef Steak",
        nameAr: "ستيك لحم بقري ممتاز",
        sku: "BEEF-STEAK-001",
        price: "89.99",
        costPrice: "55",
        category: "Beef",
        description: "Aged premium ribeye steak, perfect for grilling",
        descriptionAr: "ستيك ريب آي معتق ممتاز، مثالي للشوي",
        image: "https://images.unsplash.com/photo-1588347818036-558601350947?w=400&h=300&fit=crop",
        unit: "kg" as const,
        minOrderQuantity: "0.25",
        maxOrderQuantity: "10",
        isActive: true,
        isFeatured: true,
        tags: ["premium", "grilling", "steak"],
      },
      {
        id: "prod_2",
        name: "Lamb Chops",
        nameAr: "ريش لحم ضأن",
        sku: "LAMB-CHOPS-001",
        price: "74.50",
        costPrice: "45",
        category: "Lamb",
        description: "Fresh lamb chops, ideal for Mediterranean cuisine",
        descriptionAr: "ريش لحم ضأن طازجة، مثالية للمطبخ المتوسطي",
        image: "https://images.unsplash.com/photo-1602470520998-f4a52199a3d6?w=400&h=300&fit=crop",
        unit: "kg" as const,
        minOrderQuantity: "0.25",
        maxOrderQuantity: "10",
        isActive: true,
        isFeatured: true,
        tags: ["lamb", "chops", "mediterranean"],
      },
      {
        id: "prod_3",
        name: "Chicken Breast",
        nameAr: "صدر دجاج",
        sku: "CHKN-BRST-001",
        price: "34.99",
        costPrice: "20",
        category: "Chicken",
        description: "Boneless, skinless chicken breasts - versatile and healthy",
        descriptionAr: "صدور دجاج بدون عظم وجلد - متعددة الاستخدامات وصحية",
        image: "https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=400&h=300&fit=crop",
        unit: "kg" as const,
        minOrderQuantity: "0.25",
        maxOrderQuantity: "20",
        isActive: true,
        isFeatured: false,
        tags: ["chicken", "healthy", "lean"],
      },
      {
        id: "prod_4",
        name: "Ground Beef",
        nameAr: "لحم بقري مفروم",
        sku: "BEEF-GRND-001",
        price: "45.00",
        costPrice: "28",
        category: "Beef",
        description: "Lean ground beef for burgers and meatballs",
        descriptionAr: "لحم بقري مفروم قليل الدهن للبرغر وكرات اللحم",
        image: "https://images.unsplash.com/photo-1551028150-64b9f398f678?w=400&h=300&fit=crop",
        unit: "kg" as const,
        minOrderQuantity: "0.5",
        maxOrderQuantity: "10",
        isActive: true,
        isFeatured: false,
        tags: ["ground", "burgers", "meatballs"],
      },
      {
        id: "prod_5",
        name: "Beef Brisket",
        nameAr: "صدر لحم بقري",
        sku: "BEEF-BRSK-001",
        price: "95.00",
        costPrice: "60",
        category: "Beef",
        description: "Slow-cooked perfection for your BBQ",
        descriptionAr: "مثالي للطهي البطيء والشواء",
        image: "https://images.unsplash.com/photo-1594041680534-e8c8cdebd659?w=400&h=300&fit=crop",
        unit: "kg" as const,
        minOrderQuantity: "1",
        maxOrderQuantity: "5",
        isActive: true,
        isFeatured: true,
        tags: ["bbq", "slow-cook", "brisket"],
      },
      {
        id: "prod_6",
        name: "Sheep Leg",
        nameAr: "فخذ خروف",
        sku: "SHEP-LEG-001",
        price: "125.00",
        costPrice: "80",
        category: "Sheep",
        description: "Whole sheep leg, perfect for traditional dishes",
        descriptionAr: "فخذ خروف كامل، مثالي للأطباق التقليدية",
        image: "https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=400&h=300&fit=crop",
        unit: "piece" as const,
        minOrderQuantity: "1",
        maxOrderQuantity: "3",
        isActive: true,
        isFeatured: true,
        tags: ["sheep", "traditional", "whole"],
      },
      {
        id: "prod_7",
        name: "Lamb Leg",
        nameAr: "فخذ ضأن",
        sku: "LAMB-LEG-001",
        price: "125.00",
        costPrice: "75",
        category: "Lamb",
        description: "Whole lamb leg, perfect for family dinners",
        descriptionAr: "فخذ ضأن كامل، مثالي لعشاء العائلة",
        image: "https://images.unsplash.com/photo-1603048297172-c92544798d5a?w=400&h=300&fit=crop",
        unit: "piece" as const,
        minOrderQuantity: "1",
        maxOrderQuantity: "3",
        isActive: false,
        isFeatured: false,
        tags: ["lamb", "family", "dinner"],
      },
      {
        id: "prod_8",
        name: "Sheep Ribs",
        nameAr: "ريش خروف",
        sku: "SHEP-RIBS-001",
        price: "85.00",
        costPrice: "50",
        category: "Sheep",
        description: "Premium sheep ribs, perfect for grilling",
        descriptionAr: "ريش خروف ممتازة، مثالية للشوي",
        image: "https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=400&h=300&fit=crop",
        unit: "kg" as const,
        minOrderQuantity: "0.5",
        maxOrderQuantity: "5",
        isActive: true,
        isFeatured: false,
        tags: ["sheep", "ribs", "grilling"],
      },
      {
        id: "prod_9",
        name: "Wagyu Ribeye",
        nameAr: "واغيو ريب آي",
        sku: "BEEF-WAGY-001",
        price: "249.99",
        costPrice: "180",
        category: "Beef",
        description: "Premium Australian Wagyu A5, melt-in-your-mouth texture",
        descriptionAr: "واغيو أسترالي ممتاز A5، قوام يذوب في الفم",
        image: "https://images.unsplash.com/photo-1615937657715-bc7b4b7962c1?w=400&h=300&fit=crop",
        unit: "kg" as const,
        minOrderQuantity: "0.25",
        maxOrderQuantity: "3",
        isActive: true,
        isFeatured: true,
        tags: ["wagyu", "premium", "beef"],
      },
      {
        id: "prod_10",
        name: "Organic Chicken Thighs",
        nameAr: "أفخاذ دجاج عضوي",
        sku: "CHKN-THGH-001",
        price: "42.99",
        costPrice: "25",
        category: "Chicken",
        description: "Free-range organic chicken thighs, extra juicy",
        descriptionAr: "أفخاذ دجاج عضوي حر، طرية وغنية بالعصارة",
        image: "https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=400&h=300&fit=crop",
        unit: "kg" as const,
        minOrderQuantity: "0.25",
        maxOrderQuantity: "10",
        isActive: true,
        isFeatured: false,
        tags: ["organic", "chicken", "thighs"],
      },
    ];

    await db.insert(schema.products).values(productsData).onConflictDoNothing();

    // =====================================================
    // SEED STOCK
    // =====================================================
    console.log("📊 Seeding stock...");
    
    const stockData = productsData.map((p) => ({
      id: `stock_${p.id}`,
      productId: p.id,
      quantity: String(Math.floor(Math.random() * 50) + 10),
      reservedQuantity: "0",
      availableQuantity: String(Math.floor(Math.random() * 50) + 10),
      lowStockThreshold: 5,
      reorderPoint: 10,
      reorderQuantity: 20,
    }));

    await db.insert(schema.stock).values(stockData).onConflictDoNothing();

    // =====================================================
    // SEED USERS
    // =====================================================
    console.log("👥 Seeding users...");
    
    const usersData = [
      {
        id: "admin_1",
        username: "admin",
        email: "admin@butcher.ae",
        mobile: "+971501234567",
        password: "admin123",
        firstName: "Admin",
        familyName: "User",
        role: "admin" as const,
        isActive: true,
        isVerified: true,
        emirate: "Dubai",
        preferences: {
          language: "en" as const,
          currency: "AED" as const,
          emailNotifications: true,
          smsNotifications: true,
          marketingEmails: false,
        },
      },
      {
        id: "user_1",
        username: "ahmed",
        email: "ahmed@example.com",
        mobile: "+971501111111",
        password: "password123",
        firstName: "Ahmed",
        familyName: "Al Maktoum",
        role: "customer" as const,
        isActive: true,
        isVerified: true,
        emirate: "Dubai",
        preferences: {
          language: "en" as const,
          currency: "AED" as const,
          emailNotifications: true,
          smsNotifications: true,
          marketingEmails: true,
        },
      },
      {
        id: "user_2",
        username: "fatima",
        email: "fatima@example.com",
        mobile: "+971502222222",
        password: "password123",
        firstName: "Fatima",
        familyName: "Al Nahyan",
        role: "customer" as const,
        isActive: true,
        isVerified: true,
        emirate: "Abu Dhabi",
        preferences: {
          language: "en" as const,
          currency: "AED" as const,
          emailNotifications: true,
          smsNotifications: true,
          marketingEmails: true,
        },
      },
      {
        id: "user_3",
        username: "mohamed",
        email: "mohamed@example.com",
        mobile: "+971503333333",
        password: "password123",
        firstName: "Mohamed",
        familyName: "Al Sharqi",
        role: "customer" as const,
        isActive: true,
        isVerified: true,
        emirate: "Sharjah",
        preferences: {
          language: "en" as const,
          currency: "AED" as const,
          emailNotifications: true,
          smsNotifications: true,
          marketingEmails: true,
        },
      },
      {
        id: "driver_1",
        username: "driver1",
        email: "hassan@butcher.ae",
        mobile: "+971504444444",
        password: "driver123",
        firstName: "Hassan",
        familyName: "Al Rashid",
        role: "delivery" as const,
        isActive: true,
        isVerified: true,
        emirate: "Dubai",
        preferences: {
          language: "en" as const,
          currency: "AED" as const,
          emailNotifications: true,
          smsNotifications: true,
          marketingEmails: false,
        },
      },
      {
        id: "driver_2",
        username: "driver2",
        email: "omar@butcher.ae",
        mobile: "+971505555555",
        password: "driver123",
        firstName: "Omar",
        familyName: "Al Farsi",
        role: "delivery" as const,
        isActive: true,
        isVerified: true,
        emirate: "Dubai",
        preferences: {
          language: "en" as const,
          currency: "AED" as const,
          emailNotifications: true,
          smsNotifications: true,
          marketingEmails: false,
        },
      },
    ];

    await db.insert(schema.users).values(usersData).onConflictDoNothing();

    // =====================================================
    // SEED ADDRESSES
    // =====================================================
    console.log("📍 Seeding addresses...");
    
    const addressesData = [
      {
        id: "addr_1",
        userId: "user_1",
        label: "Home",
        fullName: "Ahmed Al Maktoum",
        mobile: "+971501111111",
        emirate: "Dubai",
        area: "Downtown Dubai",
        street: "Sheikh Mohammed bin Rashid Boulevard",
        building: "Burj Khalifa Tower",
        floor: "45",
        apartment: "4502",
        isDefault: true,
      },
      {
        id: "addr_2",
        userId: "user_1",
        label: "Office",
        fullName: "Ahmed Al Maktoum",
        mobile: "+971501111111",
        emirate: "Dubai",
        area: "DIFC",
        street: "Gate Avenue",
        building: "Emirates Towers",
        floor: "22",
        apartment: "2205",
        isDefault: false,
      },
      {
        id: "addr_3",
        userId: "user_2",
        label: "Home",
        fullName: "Fatima Al Nahyan",
        mobile: "+971502222222",
        emirate: "Abu Dhabi",
        area: "Al Reem Island",
        street: "Marina Walk",
        building: "Sky Tower",
        floor: "32",
        apartment: "3201",
        isDefault: true,
      },
    ];

    await db.insert(schema.addresses).values(addressesData).onConflictDoNothing();

    // =====================================================
    // SEED DELIVERY ZONES
    // =====================================================
    console.log("🚚 Seeding delivery zones...");
    
    const deliveryZonesData = [
      {
        id: "zone_dubai_downtown",
        name: "Dubai Downtown",
        nameAr: "وسط دبي",
        emirate: "Dubai",
        areas: ["Downtown Dubai", "DIFC", "Business Bay", "City Walk"],
        deliveryFee: "15",
        minimumOrder: "50",
        estimatedMinutes: 45,
        isActive: true,
      },
      {
        id: "zone_dubai_marina",
        name: "Dubai Marina",
        nameAr: "مرسى دبي",
        emirate: "Dubai",
        areas: ["Dubai Marina", "JBR", "JLT", "Palm Jumeirah"],
        deliveryFee: "20",
        minimumOrder: "75",
        estimatedMinutes: 60,
        isActive: true,
      },
      {
        id: "zone_abu_dhabi",
        name: "Abu Dhabi City",
        nameAr: "مدينة أبوظبي",
        emirate: "Abu Dhabi",
        areas: ["Al Reem Island", "Corniche", "Al Maryah Island", "Yas Island"],
        deliveryFee: "25",
        minimumOrder: "100",
        estimatedMinutes: 90,
        isActive: true,
      },
      {
        id: "zone_sharjah",
        name: "Sharjah City",
        nameAr: "مدينة الشارقة",
        emirate: "Sharjah",
        areas: ["Al Majaz", "Al Nahda", "Al Qasimia", "Al Khan"],
        deliveryFee: "20",
        minimumOrder: "75",
        estimatedMinutes: 75,
        isActive: true,
      },
    ];

    await db.insert(schema.deliveryZones).values(deliveryZonesData).onConflictDoNothing();

    // =====================================================
    // SEED DISCOUNT CODES
    // =====================================================
    console.log("🎟️ Seeding discount codes...");
    
    const discountCodesData = [
      {
        id: "disc_1",
        code: "WELCOME10",
        type: "percentage" as const,
        value: "10",
        minimumOrder: "50",
        maximumDiscount: "50",
        usageLimit: 1000,
        usageCount: 150,
        userLimit: 1,
        validFrom: new Date(),
        validTo: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        isActive: true,
      },
      {
        id: "disc_2",
        code: "MEAT20",
        type: "percentage" as const,
        value: "20",
        minimumOrder: "150",
        maximumDiscount: "100",
        usageLimit: 500,
        usageCount: 45,
        userLimit: 2,
        validFrom: new Date(),
        validTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isActive: true,
        applicableCategories: ["Beef", "Lamb"],
      },
      {
        id: "disc_3",
        code: "FLAT50",
        type: "fixed" as const,
        value: "50",
        minimumOrder: "200",
        usageLimit: 200,
        usageCount: 20,
        userLimit: 1,
        validFrom: new Date(),
        validTo: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        isActive: true,
      },
    ];

    await db.insert(schema.discountCodes).values(discountCodesData).onConflictDoNothing();

    // =====================================================
    // SEED FINANCE ACCOUNTS
    // =====================================================
    console.log("💰 Seeding finance accounts...");
    
    const financeAccountsData = [
      {
        id: "acc_cash",
        name: "Cash",
        nameAr: "نقدي",
        type: "cash" as const,
        balance: "5000",
        currency: "AED" as const,
        isActive: true,
      },
      {
        id: "acc_bank",
        name: "Main Bank Account",
        nameAr: "الحساب البنكي الرئيسي",
        type: "bank" as const,
        balance: "50000",
        currency: "AED" as const,
        isActive: true,
        bankName: "Emirates NBD",
        accountNumber: "1234567890",
        iban: "AE123456789012345678901",
      },
      {
        id: "acc_card",
        name: "Card Payments",
        nameAr: "مدفوعات البطاقات",
        type: "card_payments" as const,
        balance: "15000",
        currency: "AED" as const,
        isActive: true,
      },
      {
        id: "acc_cod",
        name: "COD Collections",
        nameAr: "تحصيلات الدفع عند الاستلام",
        type: "cod_collections" as const,
        balance: "3500",
        currency: "AED" as const,
        isActive: true,
      },
    ];

    await db.insert(schema.financeAccounts).values(financeAccountsData).onConflictDoNothing();

    // =====================================================
    // SEED SAMPLE ORDERS
    // =====================================================
    console.log("📝 Seeding sample orders...");
    
    const orderStatuses: ("pending" | "confirmed" | "processing" | "out_for_delivery" | "delivered" | "cancelled")[] = 
      ["pending", "confirmed", "processing", "out_for_delivery", "delivered", "cancelled"];
    
    for (let i = 0; i < 20; i++) {
      const daysAgo = Math.floor(Math.random() * 30);
      const orderDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
      const status = orderStatuses[Math.floor(Math.random() * orderStatuses.length)];
      const userId = `user_${(i % 3) + 1}`;
      
      const orderId = `order_${1000 + i}`;
      const orderNumber = `ORD-${String(1000 + i).padStart(6, "0")}`;
      
      // Random items
      const numItems = Math.floor(Math.random() * 3) + 1;
      let subtotal = 0;
      const items = [];
      
      for (let j = 0; j < numItems; j++) {
        const productIndex = Math.floor(Math.random() * productsData.length);
        const product = productsData[productIndex];
        const quantity = Math.round((Math.random() * 2 + 0.5) * 100) / 100;
        const unitPrice = parseFloat(product.price);
        const totalPrice = unitPrice * quantity;
        subtotal += totalPrice;
        
        items.push({
          id: `item_${orderId}_${j}`,
          orderId,
          productId: product.id,
          productName: product.name,
          productNameAr: product.nameAr,
          sku: product.sku,
          quantity: String(quantity),
          unitPrice: product.price,
          totalPrice: String(Math.round(totalPrice * 100) / 100),
        });
      }
      
      const vatRate = 0.05;
      const deliveryFee = 15;
      const vatAmount = subtotal * vatRate;
      const total = subtotal + vatAmount + deliveryFee;
      
      const addressData = addressesData.find(a => a.userId === userId) || addressesData[0];
      
      // Insert order
      await db.insert(schema.orders).values({
        id: orderId,
        orderNumber,
        userId,
        customerName: usersData.find(u => u.id === userId)?.firstName + " " + usersData.find(u => u.id === userId)?.familyName || "Customer",
        customerEmail: usersData.find(u => u.id === userId)?.email || "customer@example.com",
        customerMobile: usersData.find(u => u.id === userId)?.mobile || "+971500000000",
        subtotal: String(Math.round(subtotal * 100) / 100),
        discount: "0",
        deliveryFee: String(deliveryFee),
        vatAmount: String(Math.round(vatAmount * 100) / 100),
        vatRate: String(vatRate),
        total: String(Math.round(total * 100) / 100),
        status,
        paymentStatus: status === "cancelled" ? "failed" : status === "delivered" ? "captured" : "pending",
        paymentMethod: Math.random() > 0.3 ? "card" : "cod",
        addressId: addressData.id,
        deliveryAddress: {
          ...addressData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        statusHistory: [
          {
            status: "pending",
            changedBy: "system",
            changedAt: orderDate.toISOString(),
          },
        ],
        source: "web",
        createdAt: orderDate,
        updatedAt: new Date(),
      }).onConflictDoNothing();
      
      // Insert order items
      await db.insert(schema.orderItems).values(items).onConflictDoNothing();
      
      // Insert payment
      await db.insert(schema.payments).values({
        id: `pay_${orderId}`,
        orderId,
        orderNumber,
        amount: String(Math.round(total * 100) / 100),
        currency: "AED",
        method: Math.random() > 0.3 ? "card" : "cod",
        status: status === "cancelled" ? "failed" : status === "delivered" ? "captured" : "pending",
        refundedAmount: "0",
        refunds: [],
        cardBrand: Math.random() > 0.3 ? "Visa" : undefined,
        cardLast4: Math.random() > 0.3 ? "4242" : undefined,
      }).onConflictDoNothing();
    }

    console.log("✅ Database seeded successfully!");
    console.log("📊 Summary:");
    console.log(`   - ${productsData.length} products`);
    console.log(`   - ${usersData.length} users`);
    console.log(`   - ${addressesData.length} addresses`);
    console.log(`   - ${deliveryZonesData.length} delivery zones`);
    console.log(`   - ${discountCodesData.length} discount codes`);
    console.log(`   - ${financeAccountsData.length} finance accounts`);
    console.log(`   - 20 sample orders`);
    
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    throw error;
  }
}

// Run seed
seedDatabase()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
