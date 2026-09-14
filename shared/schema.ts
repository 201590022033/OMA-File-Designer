
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const lenses = sqliteTable("lenses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  omaContent: text("oma_content").notNull(),
  parsedMetadata: text("parsed_metadata", { mode: "json" }), // Store parsed OMA metadata
  createdAt: integer("created_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()),
});

export const insertLensSchema = createInsertSchema(lenses).omit({ 
  id: true, 
  createdAt: true,
  parsedMetadata: true 
});

export type Lens = typeof lenses.$inferSelect;
export type InsertLens = z.infer<typeof insertLensSchema>;

export type CreateLensRequest = InsertLens;
export type LensResponse = Lens;
