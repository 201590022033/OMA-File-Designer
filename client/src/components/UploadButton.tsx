import { useRef, useState } from "react";
import { Upload as UploadIcon, Loader2, FileUp } from "lucide-react";
import { useCreateUpload } from "@/hooks/use-uploads";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

export function UploadButton() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { mutate: uploadFile, isPending } = useCreateUpload();
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Simple client-side check, backend should also validate
    if (!file.name.toLowerCase().endsWith(".oma")) {
      toast({
        title: "Invalid file type",
        description: "Please upload an .oma file",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    uploadFile(formData, {
      onSuccess: () => {
        toast({
          title: "File uploaded successfully",
          description: `${file.name} has been processed.`,
        });
        if (fileInputRef.current) fileInputRef.current.value = "";
      },
      onError: (error: Error) => {
        toast({
          title: "Upload failed",
          description: error.message,
          variant: "destructive",
        });
      },
    });
  };

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".oma"
        onChange={handleFileChange}
      />
      <Button
        onClick={() => fileInputRef.current?.click()}
        disabled={isPending}
        className="gap-2 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 shadow-lg shadow-primary/20 transition-all duration-300"
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileUp className="h-4 w-4" />
        )}
        Import OMA File
      </Button>
    </>
  );
}
