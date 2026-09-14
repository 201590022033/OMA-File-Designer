import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type InsertLens } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

export function useLenses() {
  return useQuery({
    queryKey: [api.lenses.list.path],
    queryFn: async () => {
      const res = await fetch(api.lenses.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch lenses");
      return api.lenses.list.responses[200].parse(await res.json());
    },
  });
}

export function useLens(id: number) {
  return useQuery({
    queryKey: [api.lenses.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.lenses.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch lens");
      return api.lenses.get.responses[200].parse(await res.json());
    },
    enabled: !!id && !isNaN(id),
  });
}

export function useCreateLens() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertLens) => {
      const validated = api.lenses.create.input.parse(data);
      const res = await fetch(api.lenses.create.path, {
        method: api.lenses.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 400) {
          const error = api.lenses.create.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error("Failed to create lens");
      }
      return api.lenses.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.lenses.list.path] });
      toast({
        title: "Success",
        description: "OMA shape job imported successfully",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });
}

export function useDeleteLens() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.lenses.delete.path, { id });
      const res = await fetch(url, {
        method: api.lenses.delete.method,
        credentials: "include",
      });

      if (!res.ok && res.status !== 404) {
        throw new Error("Failed to delete lens");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.lenses.list.path] });
      toast({
        title: "Deleted",
        description: "OMA shape job removed from library",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });
}
