/**
 * In-memory database for the Butcher Shop
 * In production, replace with PostgreSQL, MongoDB, or your preferred database
 */

import type {
  User,
  Address,
  Order,
  OrderItem,
  Payment,
  StockItem,
  StockMovement,
  Notification,
  DeliveryZone,
  DeliveryTracking,
  DiscountCode,
  Product,
} from "@shared/api";

// =====================================================
// DATABASE STORAGE
// =====================================================

interface Database {
  users: Map<string, User & { password: string }>;
  addresses: Map<string, Address>;
  orders: Map<string, Order>;
  payments: Map<string, Payment>;
  products: Map<string, Product>;
  stock: Map<string, StockItem>;
  stockMovements: StockMovement[];
  notifications: Notification[];
  deliveryZones: Map<string, DeliveryZone>;
  deliveryTracking: Map<string, DeliveryTracking>;
  discountCodes: Map<string, DiscountCode>;
  sessions: Map<string, { userId: string; expiresAt: string }>;
}

export const db: Database = {
  users: new Map(),
  addresses: new Map(),
  orders: new Map(),
  payments: new Map(),
  products: new Map(),
  stock: new Map(),
  stockMovements: [],
  notifications: [],
  deliveryZones: new Map(),
  deliveryTracking: new Map(),
  discountCodes: new Map(),
  sessions: new Map(),
};

// =====================================================
// ID GENERATORS
// =====================================================

let orderCounter = 1000;
export const generateId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
export const generateOrderNumber = () => `ORD-${String(++orderCounter).padStart(6, "0")}`;
export const generateToken = () => `tok_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;

// =====================================================
// SEED DATA
// =====================================================

let isSeeded = false;

export function seedDatabase() {
  // Prevent duplicate seeding
  if (isSeeded) {
    return;
  }
  isSeeded = true;

  // Seed products
  const products: Product[] = [
    {
      id: "prod_1",
      name: "Premium Beef Steak",
      nameAr: "ستيك لحم بقري ممتاز",
      sku: "BEEF-STEAK-001",
      price: 89.99,
      costPrice: 55,
      category: "Beef",
      description: "Aged premium ribeye steak, perfect for grilling",
      descriptionAr: "ستيك ريب آي معتق ممتاز، مثالي للشوي",
      image: "https://images.unsplash.com/photo-1588347818036-558601350947?w=400&h=300&fit=crop",
      unit: "kg",
      minOrderQuantity: 0.25,
      maxOrderQuantity: 10,
      isActive: true,
      isFeatured: true,
      tags: ["premium", "grilling", "steak"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "prod_2",
      name: "Lamb Chops",
      nameAr: "ريش لحم ضأن",
      sku: "LAMB-CHOPS-001",
      price: 74.5,
      costPrice: 45,
      category: "Lamb",
      description: "Fresh lamb chops, ideal for Mediterranean cuisine",
      descriptionAr: "ريش لحم ضأن طازجة، مثالية للمطبخ المتوسطي",
      image: "https://images.unsplash.com/photo-1602470520998-f4a52199a3d6?w=400&h=300&fit=crop",
      unit: "kg",
      minOrderQuantity: 0.25,
      maxOrderQuantity: 10,
      isActive: true,
      isFeatured: true,
      tags: ["lamb", "chops", "mediterranean"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "prod_3",
      name: "Chicken Breast",
      nameAr: "صدر دجاج",
      sku: "CHKN-BRST-001",
      price: 34.99,
      costPrice: 20,
      category: "Chicken",
      description: "Boneless, skinless chicken breasts - versatile and healthy",
      descriptionAr: "صدور دجاج بدون عظم وجلد - متعددة الاستخدامات وصحية",
      image: "https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=400&h=300&fit=crop",
      unit: "kg",
      minOrderQuantity: 0.25,
      maxOrderQuantity: 20,
      isActive: true,
      isFeatured: false,
      tags: ["chicken", "healthy", "lean"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "prod_4",
      name: "Ground Beef",
      nameAr: "لحم بقري مفروم",
      sku: "BEEF-GRND-001",
      price: 45.0,
      costPrice: 28,
      category: "Beef",
      description: "Lean ground beef for burgers and meatballs",
      descriptionAr: "لحم بقري مفروم قليل الدهن للبرغر وكرات اللحم",
      image: "https://images.unsplash.com/photo-1551028150-64b9f398f678?w=400&h=300&fit=crop",
      unit: "kg",
      minOrderQuantity: 0.5,
      maxOrderQuantity: 10,
      isActive: true,
      isFeatured: false,
      tags: ["ground", "burgers", "meatballs"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "prod_5",
      name: "Beef Brisket",
      nameAr: "صدر لحم بقري",
      sku: "BEEF-BRSK-001",
      price: 95.0,
      costPrice: 60,
      category: "Beef",
      description: "Slow-cooked perfection for your BBQ",
      descriptionAr: "مثالي للطهي البطيء والشواء",
      image: "https://images.unsplash.com/photo-1594041680534-e8c8cdebd659?w=400&h=300&fit=crop",
      unit: "kg",
      minOrderQuantity: 1,
      maxOrderQuantity: 5,
      isActive: true,
      isFeatured: true,
      tags: ["bbq", "slow-cook", "brisket"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "prod_6",
      name: "Sheep Leg",
      nameAr: "فخذ خروف",
      sku: "SHEP-LEG-001",
      price: 125.0,
      costPrice: 80,
      category: "Sheep",
      description: "Whole sheep leg, perfect for traditional dishes",
      descriptionAr: "فخذ خروف كامل، مثالي للأطباق التقليدية",
      image: "https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=400&h=300&fit=crop",
      unit: "piece",
      minOrderQuantity: 1,
      maxOrderQuantity: 3,
      isActive: true,
      isFeatured: true,
      tags: ["sheep", "traditional", "whole"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "prod_7",
      name: "Lamb Leg",
      nameAr: "فخذ ضأن",
      sku: "LAMB-LEG-001",
      price: 125.0,
      costPrice: 75,
      category: "Lamb",
      description: "Whole lamb leg, perfect for family dinners",
      descriptionAr: "فخذ ضأن كامل، مثالي لعشاء العائلة",
      image: "https://images.unsplash.com/photo-1603048297172-c92544798d5a?w=400&h=300&fit=crop",
      unit: "piece",
      minOrderQuantity: 1,
      maxOrderQuantity: 3,
      isActive: false,
      isFeatured: false,
      tags: ["lamb", "family", "dinner"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "prod_8",
      name: "Sheep Ribs",
      nameAr: "ريش خروف",
      sku: "SHEP-RIBS-001",
      price: 85.0,
      costPrice: 50,
      category: "Sheep",
      description: "Premium sheep ribs, perfect for grilling",
      descriptionAr: "ريش خروف ممتازة، مثالية للشوي",
      image: "https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=400&h=300&fit=crop",
      unit: "kg",
      minOrderQuantity: 0.5,
      maxOrderQuantity: 5,
      isActive: true,
      isFeatured: false,
      tags: ["sheep", "ribs", "grilling"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "prod_9",
      name: "Wagyu Ribeye",
      nameAr: "واغيو ريب آي",
      sku: "BEEF-WAGY-001",
      price: 249.99,
      costPrice: 180,
      category: "Beef",
      description: "Premium Australian Wagyu A5, melt-in-your-mouth texture",
      descriptionAr: "واغيو أسترالي ممتاز A5، قوام يذوب في الفم",
      image: "https://images.unsplash.com/photo-1615937657715-bc7b4b7962c1?w=400&h=300&fit=crop",
      unit: "kg",
      minOrderQuantity: 0.25,
      maxOrderQuantity: 3,
      isActive: true,
      isFeatured: true,
      tags: ["wagyu", "premium", "beef"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "prod_10",
      name: "Organic Chicken Thighs",
      nameAr: "أفخاذ دجاج عضوي",
      sku: "CHKN-THGH-001",
      price: 42.99,
      costPrice: 25,
      category: "Chicken",
      description: "Free-range organic chicken thighs, extra juicy",
      descriptionAr: "أفخاذ دجاج عضوي حر، طرية وغنية بالعصارة",
      image: "https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=400&h=300&fit=crop",
      unit: "kg",
      minOrderQuantity: 0.25,
      maxOrderQuantity: 10,
      isActive: true,
      isFeatured: false,
      tags: ["organic", "chicken", "thighs"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  products.forEach((p) => db.products.set(p.id, p));

  // Seed stock for each product
  products.forEach((p) => {
    const stockItem: StockItem = {
      id: `stock_${p.id}`,
      productId: p.id,
      quantity: Math.floor(Math.random() * 50) + 10,
      reservedQuantity: 0,
      availableQuantity: 0,
      lowStockThreshold: 5,
      reorderPoint: 10,
      reorderQuantity: 20,
      updatedAt: new Date().toISOString(),
    };
    stockItem.availableQuantity = stockItem.quantity - stockItem.reservedQuantity;
    db.stock.set(stockItem.id, stockItem);
  });

  // Seed admin user
  db.users.set("admin_1", {
    id: "admin_1",
    username: "admin",
    email: "admin@butcher.ae",
    mobile: "+971501234567",
    password: "admin123",
    firstName: "Admin",
    familyName: "User",
    role: "admin",
    isActive: true,
    isVerified: true,
    emirate: "Dubai",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    preferences: {
      language: "en",
      currency: "AED",
      emailNotifications: true,
      smsNotifications: true,
      marketingEmails: false,
    },
  });

  // Seed sample customers
  const customers = [
    {
      id: "user_1",
      username: "Mohamed",
      email: "ahmed@example.com",
      mobile: "+971501111111",
      password: "password123",
      firstName: "Ahmed",
      familyName: "Al Maktoum",
      role: "customer" as const,
      isActive: true,
      isVerified: true,
      emirate: "Dubai",
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
    },
  ];

  customers.forEach((c) => {
    db.users.set(c.id, {
      ...c,
      createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
      preferences: {
        language: "en",
        currency: "AED",
        emailNotifications: true,
        smsNotifications: true,
        marketingEmails: true,
      },
    });
  });

  // Seed delivery driver
  db.users.set("driver_1", {
    id: "driver_1",
    username: "driver",
    email: "driver@butcher.ae",
    mobile: "+971504444444",
    password: "driver123",
    firstName: "Hassan",
    familyName: "Driver",
    role: "delivery",
    isActive: true,
    isVerified: true,
    emirate: "Dubai",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    preferences: {
      language: "en",
      currency: "AED",
      emailNotifications: true,
      smsNotifications: true,
      marketingEmails: false,
    },
  });

  // Seed addresses
  const addresses: Address[] = [
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  addresses.forEach((a) => db.addresses.set(a.id, a));

  // Seed delivery zones
  const deliveryZones: DeliveryZone[] = [
    {
      id: "zone_dubai_downtown",
      name: "Dubai Downtown",
      nameAr: "وسط دبي",
      emirate: "Dubai",
      areas: ["Downtown Dubai", "DIFC", "Business Bay", "City Walk"],
      deliveryFee: 15,
      minimumOrder: 50,
      estimatedMinutes: 45,
      isActive: true,
    },
    {
      id: "zone_dubai_marina",
      name: "Dubai Marina",
      nameAr: "مرسى دبي",
      emirate: "Dubai",
      areas: ["Dubai Marina", "JBR", "JLT", "Palm Jumeirah"],
      deliveryFee: 20,
      minimumOrder: 75,
      estimatedMinutes: 60,
      isActive: true,
    },
    {
      id: "zone_abu_dhabi",
      name: "Abu Dhabi City",
      nameAr: "مدينة أبوظبي",
      emirate: "Abu Dhabi",
      areas: ["Al Reem Island", "Corniche", "Al Maryah Island", "Yas Island"],
      deliveryFee: 25,
      minimumOrder: 100,
      estimatedMinutes: 90,
      isActive: true,
    },
    {
      id: "zone_sharjah",
      name: "Sharjah City",
      nameAr: "مدينة الشارقة",
      emirate: "Sharjah",
      areas: ["Al Majaz", "Al Nahda", "Al Qasimia", "Al Khan"],
      deliveryFee: 20,
      minimumOrder: 75,
      estimatedMinutes: 75,
      isActive: true,
    },
  ];

  deliveryZones.forEach((z) => db.deliveryZones.set(z.id, z));

  // Seed discount codes
  const discountCodes: DiscountCode[] = [
    {
      id: "disc_1",
      code: "WELCOME10",
      type: "percentage",
      value: 10,
      minimumOrder: 50,
      maximumDiscount: 50,
      usageLimit: 1000,
      usageCount: 150,
      userLimit: 1,
      validFrom: new Date().toISOString(),
      validTo: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "disc_2",
      code: "MEAT20",
      type: "percentage",
      value: 20,
      minimumOrder: 150,
      maximumDiscount: 100,
      usageLimit: 500,
      usageCount: 45,
      userLimit: 2,
      validFrom: new Date().toISOString(),
      validTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      isActive: true,
      applicableCategories: ["Beef", "Lamb"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "disc_3",
      code: "FLAT50",
      type: "fixed",
      value: 50,
      minimumOrder: 200,
      usageLimit: 200,
      usageCount: 20,
      userLimit: 1,
      validFrom: new Date().toISOString(),
      validTo: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  discountCodes.forEach((d) => db.discountCodes.set(d.id, d));

  // Seed sample orders
  const sampleOrders = generateSampleOrders();
  sampleOrders.forEach((o) => db.orders.set(o.id, o));

  // Seed sample payments for orders
  sampleOrders.forEach((order) => {
    const payment: Payment = {
      id: `pay_${order.id}`,
      orderId: order.id,
      orderNumber: order.orderNumber,
      amount: order.total,
      currency: "AED",
      method: order.paymentMethod,
      status: order.paymentStatus,
      refundedAmount: 0,
      refunds: [],
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };

    if (order.paymentMethod === "card") {
      payment.cardBrand = "Visa";
      payment.cardLast4 = "4242";
      payment.gatewayTransactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    db.payments.set(payment.id, payment);
  });

  console.log("Database seeded successfully!");
  console.log(`- ${db.products.size} products`);
  console.log(`- ${db.users.size} users`);
  console.log(`- ${db.addresses.size} addresses`);
  console.log(`- ${db.orders.size} orders`);
  console.log(`- ${db.deliveryZones.size} delivery zones`);
  console.log(`- ${db.discountCodes.size} discount codes`);
}

function generateSampleOrders(): Order[] {
  const orders: Order[] = [];
  const statuses: Order["status"][] = ["pending", "confirmed", "processing", "out_for_delivery", "delivered", "cancelled"];
  const products = Array.from(db.products.values());
  const addresses = Array.from(db.addresses.values());

  // Generate orders for past 30 days
  for (let i = 0; i < 50; i++) {
    const daysAgo = Math.floor(Math.random() * 30);
    const orderDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const address = addresses[Math.floor(Math.random() * addresses.length)];
    const userId = address.userId;
    const user = db.users.get(userId)!;

    // Random items
    const numItems = Math.floor(Math.random() * 4) + 1;
    const items: OrderItem[] = [];
    let subtotal = 0;

    for (let j = 0; j < numItems; j++) {
      const product = products[Math.floor(Math.random() * products.length)];
      const quantity = Math.round((Math.random() * 2 + 0.5) * 100) / 100;
      const totalPrice = product.price * quantity;
      subtotal += totalPrice;

      items.push({
        id: `item_${i}_${j}`,
        productId: product.id,
        productName: product.name,
        productNameAr: product.nameAr,
        sku: product.sku,
        quantity,
        unitPrice: product.price,
        totalPrice,
      });
    }

    const vatRate = 0.05;
    const deliveryFee = 15;
    const vatAmount = subtotal * vatRate;
    const total = subtotal + vatAmount + deliveryFee;

    const order: Order = {
      id: `order_${1000 + i}`,
      orderNumber: `ORD-${String(1000 + i).padStart(6, "0")}`,
      userId,
      customerName: `${user.firstName} ${user.familyName}`,
      customerEmail: user.email,
      customerMobile: user.mobile,
      items,
      subtotal: Math.round(subtotal * 100) / 100,
      discount: 0,
      deliveryFee,
      vatAmount: Math.round(vatAmount * 100) / 100,
      vatRate,
      total: Math.round(total * 100) / 100,
      status,
      paymentStatus: status === "cancelled" ? "failed" : status === "delivered" ? "captured" : "pending",
      paymentMethod: Math.random() > 0.3 ? "card" : "cod",
      addressId: address.id,
      deliveryAddress: address,
      statusHistory: [
        {
          status: "pending",
          changedBy: "system",
          changedAt: orderDate.toISOString(),
        },
      ],
      source: "web",
      createdAt: orderDate.toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Add status history based on current status
    if (["confirmed", "processing", "out_for_delivery", "delivered"].includes(status)) {
      order.statusHistory.push({
        status: "confirmed",
        changedBy: "admin_1",
        changedAt: new Date(orderDate.getTime() + 30 * 60 * 1000).toISOString(),
      });
    }
    if (["processing", "out_for_delivery", "delivered"].includes(status)) {
      order.statusHistory.push({
        status: "processing",
        changedBy: "admin_1",
        changedAt: new Date(orderDate.getTime() + 60 * 60 * 1000).toISOString(),
      });
    }
    if (["out_for_delivery", "delivered"].includes(status)) {
      order.statusHistory.push({
        status: "out_for_delivery",
        changedBy: "driver_1",
        changedAt: new Date(orderDate.getTime() + 90 * 60 * 1000).toISOString(),
      });
    }
    if (status === "delivered") {
      order.statusHistory.push({
        status: "delivered",
        changedBy: "driver_1",
        changedAt: new Date(orderDate.getTime() + 120 * 60 * 1000).toISOString(),
      });
      order.actualDeliveryAt = new Date(orderDate.getTime() + 120 * 60 * 1000).toISOString();
    }

    orders.push(order);
  }

  return orders;
}

// Initialize database with seed data on module load
seedDatabase();
