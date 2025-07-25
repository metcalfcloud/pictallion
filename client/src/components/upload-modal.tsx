import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, File, CheckCircle, X, AlertCircle } from "lucide-react";
import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface UploadFile {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error' | 'duplicate';
  message?: string;
}

interface UploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function UploadModal({ open, onOpenChange }: UploadModalProps) {
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file);
      });

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      return response.json();
    },
    onSuccess: (data) => {
      setUploadFiles(current => 
        current.map(uploadFile => {
          const result = data.results.find((r: any) => r.filename === uploadFile.file.name);
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
      
      const successCount = data.results.filter((r: any) => r.status === 'success').length;
      
      if (successCount > 0) {
        toast({
          title: "Upload Complete",
          description: `${successCount} photos uploaded successfully`,
        });
      }
    },
    onError: (error) => {
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
        variant: "destructive"
      });
    },
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: UploadFile[] = acceptedFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      progress: 0,
      status: 'pending',
    }));

    setUploadFiles(current => [...current, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.tiff'],
      'video/*': ['.mp4', '.mov', '.avi']
    },
    maxSize: 50 * 1024 * 1024, // 50MB
  });

  const handleUpload = () => {
    if (uploadFiles.length === 0) return;

    setUploadFiles(current => 
      current.map(file => ({ ...file, status: 'uploading' as const, progress: 0 }))
    );

    const progressInterval = setInterval(() => {
      setUploadFiles(current => 
        current.map(file => 
          file.status === 'uploading' 
            ? { ...file, progress: Math.min(file.progress + Math.random() * 30, 90) }
            : file
        )
      );
    }, 500);

    uploadMutation.mutate(uploadFiles.map(f => f.file));

    setTimeout(() => {
      clearInterval(progressInterval);
    }, 3000);
  };

  const removeFile = (id: string) => {
    setUploadFiles(current => current.filter(file => file.id !== id));
  };

  const closeModal = () => {
    setUploadFiles([]);
    onOpenChange(false);
  };

  const getStatusIcon = (status: UploadFile['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'duplicate':
        return <AlertCircle className="w-4 h-4 text-yellow-600" />;
      case 'uploading':
        return <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />;
      default:
        return <File className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload Photos</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Drag and Drop Area */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
              isDragActive 
                ? 'border-primary bg-primary/5' 
                : 'border-gray-300 hover:border-primary hover:bg-primary/5'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">
              {isDragActive ? 'Drop photos here' : 'Drag and drop your photos here'}
            </h4>
            <p className="text-gray-500 mb-4">or click to browse your files</p>
            <Button type="button">Choose Files</Button>
            <p className="text-xs text-gray-400 mt-4">
              Supports JPEG, PNG, TIFF, MP4, MOV, AVI files up to 50MB each
            </p>
          </div>

          {/* Upload Progress */}
          {uploadFiles.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Upload Queue ({uploadFiles.length} files)</h4>
                <Button variant="outline" size="sm" onClick={() => setUploadFiles([])}>
                  Clear All
                </Button>
              </div>
              
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {uploadFiles.map((uploadFile) => (
                  <div key={uploadFile.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    {getStatusIcon(uploadFile.status)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {uploadFile.file.name}
                      </p>
                      {uploadFile.status === 'uploading' && (
                        <Progress value={uploadFile.progress} className="h-2 mt-1" />
                      )}
                      {uploadFile.message && (
                        <p className="text-xs text-gray-500 mt-1">{uploadFile.message}</p>
                      )}
                    </div>
                    <span className="text-sm text-gray-500">
                      {uploadFile.status === 'uploading' 
                        ? `${Math.round(uploadFile.progress)}%`
                        : uploadFile.status === 'success' 
                        ? 'Done'
                        : uploadFile.status === 'error'
                        ? 'Failed'
                        : uploadFile.status === 'duplicate'
                        ? 'Duplicate'
                        : 'Ready'
                      }
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(uploadFile.id)}
                      disabled={uploadFile.status === 'uploading'}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button variant="outline" onClick={closeModal}>
            {uploadFiles.some(f => f.status === 'success') ? 'Done' : 'Cancel'}
          </Button>
          {uploadFiles.length > 0 && uploadFiles.some(f => f.status === 'pending') && (
            <Button 
              onClick={handleUpload}
              disabled={uploadMutation.isPending}
            >
              {uploadMutation.isPending ? 'Uploading...' : 'Start Upload'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
