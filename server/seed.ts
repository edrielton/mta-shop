import { db } from "./db";
import { users, products, mtaSettings } from "@shared/schema";
import bcrypt from "bcrypt";
import { sql } from "drizzle-orm";

async function seed() {
  console.log("Seeding database...");

  // Check if admin exists
  const existingAdmin = await db.select().from(users).where(sql`username = 'admin'`);
  
  if (existingAdmin.length === 0) {
    // Create admin user
    const hashedPassword = await bcrypt.hash("admin123", 10);
    await db.insert(users).values({
      username: "admin",
      email: "admin@mtastore.com",
      password: hashedPassword,
      isAdmin: true,
      isVip: true,
      coinBalance: 10000,
    });
    console.log("Created admin user (admin / admin123)");
  } else {
    console.log("Admin user already exists");
  }

  // Check if products exist
  const existingProducts = await db.select().from(products);
  
  if (existingProducts.length === 0) {
    // Create sample products
    const sampleProducts = [
      {
        name: "VIP 30 Dias",
        description: "Acesso VIP por 30 dias. Inclui veículos exclusivos, bônus de moedas diário e prioridade no suporte.",
        sku: "VIP30",
        price: "29.90",
        currency: "BRL",
        category: "vip",
        mtaCommand: "giveVip",
        mtaParams: { days: 30 },
        isActive: true,
      },
      {
        name: "VIP 7 Dias",
        description: "Acesso VIP por 7 dias. Experimente os benefícios exclusivos por uma semana.",
        sku: "VIP7",
        price: "9.90",
        currency: "BRL",
        category: "vip",
        mtaCommand: "giveVip",
        mtaParams: { days: 7 },
        isActive: true,
      },
      {
        name: "VIP Permanente",
        description: "Acesso VIP vitalício. Nunca mais se preocupe com renovação!",
        sku: "VIPPERM",
        price: "99.90",
        currency: "BRL",
        category: "vip",
        mtaCommand: "giveVip",
        mtaParams: { days: 9999 },
        isActive: true,
      },
      {
        name: "Super Carro Esportivo",
        description: "Veículo esportivo exclusivo com velocidade máxima aprimorada. O carro mais rápido do servidor!",
        sku: "CAR001",
        price: "49.90",
        currency: "BRL",
        category: "vehicle",
        mtaCommand: "giveCar",
        mtaParams: { carId: 411, tuning: true },
        isActive: true,
      },
      {
        name: "Helicóptero de Combate",
        description: "Helicóptero militar com metralhadoras e mísseis. Domine os céus!",
        sku: "HELI001",
        price: "79.90",
        currency: "BRL",
        category: "vehicle",
        mtaCommand: "giveVehicle",
        mtaParams: { vehicleId: 425, weapons: true },
        isActive: true,
      },
      {
        name: "Moto Ninja",
        description: "Moto esportiva de alta velocidade. Perfeita para fugas rápidas!",
        sku: "MOTO001",
        price: "24.90",
        currency: "BRL",
        category: "vehicle",
        mtaCommand: "giveVehicle",
        mtaParams: { vehicleId: 522 },
        isActive: true,
      },
      {
        name: "10.000 Moedas",
        description: "Pacote de 10.000 moedas para usar na loja do servidor.",
        sku: "COINS10K",
        price: "19.90",
        currency: "BRL",
        category: "coins",
        mtaCommand: "giveCoins",
        mtaParams: { amount: 10000 },
        isActive: true,
      },
      {
        name: "50.000 Moedas",
        description: "Pacote de 50.000 moedas. Melhor custo-benefício!",
        sku: "COINS50K",
        price: "79.90",
        currency: "BRL",
        category: "coins",
        mtaCommand: "giveCoins",
        mtaParams: { amount: 50000 },
        isActive: true,
      },
      {
        name: "100.000 Moedas",
        description: "Mega pacote de 100.000 moedas. Economize 20%!",
        sku: "COINS100K",
        price: "139.90",
        currency: "BRL",
        category: "coins",
        mtaCommand: "giveCoins",
        mtaParams: { amount: 100000 },
        isActive: true,
      },
      {
        name: "Skin Militar Elite",
        description: "Skin exclusiva de soldado de elite com camuflagem personalizada.",
        sku: "SKIN001",
        price: "14.90",
        currency: "BRL",
        category: "item",
        mtaCommand: "giveSkin",
        mtaParams: { skinId: 285 },
        isActive: true,
      },
      {
        name: "Kit Armas Premium",
        description: "Conjunto completo de armas de combate: M4, Sniper, RPG e granadas.",
        sku: "WEAPONS001",
        price: "34.90",
        currency: "BRL",
        category: "item",
        mtaCommand: "giveWeaponKit",
        mtaParams: { kit: "premium" },
        isActive: true,
      },
      {
        name: "Casa de Praia",
        description: "Propriedade exclusiva na praia com garagem para 5 veículos.",
        sku: "HOUSE001",
        price: "199.90",
        currency: "BRL",
        category: "item",
        mtaCommand: "giveProperty",
        mtaParams: { propertyId: 1 },
        isActive: true,
      },
    ];

    for (const product of sampleProducts) {
      await db.insert(products).values(product);
    }
    console.log(`Created ${sampleProducts.length} sample products`);
  } else {
    console.log(`${existingProducts.length} products already exist`);
  }

  // Create default MTA settings if not exists
  const existingSettings = await db.select().from(mtaSettings);
  if (existingSettings.length === 0) {
    await db.insert(mtaSettings).values({
      serverUrl: "http://135.148.164.122",
      serverPort: 27548,
      apiToken: "988CBCDD5B9CE9C19EBBE1268A151294",
      isActive: true,
    });
    console.log("Created default MTA settings");
  }

  console.log("Seeding complete!");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seeding failed:", err);
    process.exit(1);
  });
