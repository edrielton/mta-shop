import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const mods = pgTable("mods", {
  id: serial("id").primaryKey(),
  originalName: text("original_name").notNull(),
  filename: text("filename").notNull(),
  size: integer("size").notNull(),
  category: text("category").notNull().default("outro"),
  active: boolean("active").notNull().default(true),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
});
