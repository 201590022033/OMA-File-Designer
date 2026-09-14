import { useMutation } from "@tanstack/react-query";
import { useCreateLens } from "@/hooks/use-lenses";

export function useCreateUpload() {
  const createLens = useCreateLens();
  return useMutation({
    mutationFn: async (formData: FormData) => {
      const file = formData.get("file");
      if (!(file instanceof File)) throw new Error("No OMA file selected");
      return createLens.mutateAsync({ name: file.name, omaContent: await file.text() });
    },
  });
}

export function useProcessUpload(_id: number) {
  return useMutation({
    mutationFn: async (_data: { bevelType: string; thickness: number }): Promise<any> => undefined,
  });
}
