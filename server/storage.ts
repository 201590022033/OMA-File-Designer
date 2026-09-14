
import { lenses, type Lens, type InsertLens } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  getLenses(): Promise<Lens[]>;
  getLens(id: number): Promise<Lens | undefined>;
  createLens(lens: InsertLens): Promise<Lens>;
  deleteLens(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getLenses(): Promise<Lens[]> {
    return await db.select().from(lenses).orderBy(lenses.createdAt);
  }

  async getLens(id: number): Promise<Lens | undefined> {
    const [lens] = await db.select().from(lenses).where(eq(lenses.id, id));
    return lens;
  }

  async createLens(insertLens: InsertLens): Promise<Lens> {
    const [lens] = await db.insert(lenses).values(insertLens).returning();
    return lens;
  }

  async deleteLens(id: number): Promise<void> {
    await db.delete(lenses).where(eq(lenses.id, id));
  }
}

export const storage = new DatabaseStorage();
