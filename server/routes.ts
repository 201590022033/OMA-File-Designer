
import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { parseOmaFile } from "@shared/oma";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  app.get(api.lenses.list.path, async (req, res) => {
    const lenses = await storage.getLenses();
    res.json(lenses);
  });

  app.get(api.lenses.get.path, async (req, res) => {
    const lens = await storage.getLens(Number(req.params.id));
    if (!lens) {
      return res.status(404).json({ message: 'Lens not found' });
    }
    res.json(lens);
  });

  app.post(api.lenses.create.path, async (req, res) => {
    try {
      const input = api.lenses.create.input.parse(req.body);
      
      // Basic validation of OMA content
      try {
        const parsed = parseOmaFile(input.omaContent);
        if (!parsed.traces || parsed.traces.length === 0) {
           throw new Error("No traces found in OMA file");
        }
        // Enforce parsing metadata if missing?
        // For now, just validation is enough.
        // We could populate input.parsedMetadata here if we wanted.
      const lensInput = { ...input, parsedMetadata: parsed };
      const lens = await storage.createLens(lensInput);
      res.status(201).json(lens);

      } catch (e) {
         return res.status(400).json({ 
           message: "Invalid OMA file content: " + (e as Error).message,
           field: "omaContent"
         });
      }

    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.delete(api.lenses.delete.path, async (req, res) => {
    const id = Number(req.params.id);
    const existing = await storage.getLens(id);
    if (!existing) {
      return res.status(404).json({ message: 'Lens not found' });
    }
    await storage.deleteLens(id);
    res.status(204).send();
  });

  return httpServer;
}
