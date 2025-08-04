import React, { useState, useCallback, useRef, DragEvent, ChangeEvent } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, Plus } from 'lucide-react';
import { uploadManager } from '@/lib/upload-manager';
import { useToast } from '@/hooks/use-toast';

interface CompactDropzoneProps {
  isDragActive?: boolean;
  onDragActiveChange?: (active: boolean) => void;
}

export function CompactDropzone({
  isDragActive = false,
  onDragActiveChange,
}: CompactDropzoneProps) {
  const [internalDragActive, setInternalDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const isActive = isDragActive || internalDragActive;

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setInternalDragActive(true);
    onDragActiveChange?.(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setInternalDragActive(false);
    onDragActiveChange?.(false);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setInternalDragActive(false);
    onDragActiveChange?.(false);

    const files = Array.from(e.dataTransfer.files).filter(
      (file) => file.type.startsWith('image/') || file.type.startsWith('video/'),
    );

    if (files.length > 0) {
      uploadManager.addFiles(files);
      toast({
        title: 'Files Added',
        description: `${files.length} files added to upload queue and will continue in background.`,
      });
    }
  };

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      uploadManager.addFiles(files);
      toast({
        title: 'Files Added',
        description: `${files.length} files added to upload queue and will continue in background.`,
      });
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <Card className="h-full">
      <CardContent className="p-6 flex flex-col h-full">
        <h3 className="text-lg font-semibold text-card-foreground mb-4">
          Quick Upload
        </h3>
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors flex-1 flex flex-col justify-center ${
            isActive
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary hover:bg-primary/5'
          }`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={handleClick}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*"
            onChange={handleFileInput}
            style={{ display: 'none' }}
          />

          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
              <Upload className="text-blue-600 dark:text-blue-400 text-xl" />
            </div>

            <div className="space-y-2">
              <h4 className="font-medium text-card-foreground">
                {isActive ? 'Drop photos here' : 'Drop or Select'}
              </h4>
              <p className="text-sm text-muted-foreground">
                Drag photos here or click to browse
              </p>
            </div>

            <Button size="sm" variant="outline" className="mt-2">
              <Plus className="w-4 h-4 mr-1" />
              Choose Files
            </Button>

            <p className="text-xs text-muted-foreground">
              JPEG, PNG, TIFF, MP4, MOV up to 50MB
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
