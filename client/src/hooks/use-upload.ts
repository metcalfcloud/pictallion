import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "./use-toast";

export interface UploadFile {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error' | 'duplicate';
  message?: string;
}

export function useUpload() {
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const uploadMutation = useMutation({
    mutationFn: (files: File[]) => api.uploadFiles(files),
    onMutate: () => {
      // Set uploading status and start progress simulation
      setUploadFiles(current => 
        current.map(file => ({ ...file, status: 'uploading' as const, progress: 0 }))
      );

      const progressInterval = setInterval(() => {
        setUploadFiles(current => 
          current.map(file => 
            file.status === 'uploading' 
              ? { ...file, progress: Math.min(file.progress + Math.random() * 25, 90) }
              : file
          )
        );
      }, 500);

      // Clear interval after 5 seconds
      setTimeout(() => clearInterval(progressInterval), 5000);
    },
    onSuccess: (data) => {
      // Update file statuses based on server response
      setUploadFiles(current => 
        current.map(uploadFile => {
          const result = data.results.find(r => r.filename === uploadFile.file.name);
          if (result) {
            return {
              ...uploadFile,
              status: result.status as UploadFile['status'],
              message: result.message,
              progress: 100,
            };
          }
          return uploadFile;
        })
      );

      queryClient.invalidateQueries({ queryKey: ["/api/photos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      
      const successCount = data.results.filter(r => r.status === 'success').length;
      const duplicateCount = data.results.filter(r => r.status === 'duplicate').length;
      
      if (successCount > 0) {
        toast({
          title: "Upload Complete",
          description: `${successCount} photos uploaded successfully${duplicateCount > 0 ? `, ${duplicateCount} duplicates skipped` : ''}`,
        });
      }
    },
    onError: (error: Error) => {
      setUploadFiles(current => 
        current.map(file => ({
          ...file,
          status: 'error',
          message: 'Upload failed',
          progress: 0,
        }))
      );
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const addFiles = useCallback((files: File[]) => {
    const newFiles: UploadFile[] = files.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      progress: 0,
      status: 'pending',
    }));

    setUploadFiles(current => [...current, ...newFiles]);
  }, []);

  const removeFile = useCallback((id: string) => {
    setUploadFiles(current => current.filter(file => file.id !== id));
  }, []);

  const clearFiles = useCallback(() => {
    setUploadFiles([]);
  }, []);

  const startUpload = useCallback(() => {
    if (uploadFiles.length === 0) return;
    uploadMutation.mutate(uploadFiles.map(f => f.file));
  }, [uploadFiles, uploadMutation]);

  return {
    uploadFiles,
    addFiles,
    removeFile,
    clearFiles,
    startUpload,
    isUploading: uploadMutation.isPending,
    uploadError: uploadMutation.error,
  };
}
