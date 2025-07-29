import React, { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SimpleDropzoneProps {
  onFilesSelected: (files: File[]) => void;
}

export function SimpleDropzone({ onFilesSelected }: SimpleDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter(file => 
      file.type.startsWith('image/') || file.type.startsWith('video/')
    );
    
    if (imageFiles.length > 0) {
      onFilesSelected(imageFiles);
    }
  };

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      onFilesSelected(files);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
        isDragging 
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
      <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
      <h4 className="text-lg font-medium text-card-foreground mb-2">
        {isDragging ? 'Drop photos here' : 'Drag and drop your photos here'}
      </h4>
      <p className="text-muted-foreground mb-4">or click to browse your files</p>
      <Button type="button">Choose Files</Button>
      <p className="text-xs text-muted-foreground mt-4">
        Supports JPEG, PNG, TIFF, MP4, MOV, AVI files up to 50MB each
      </p>
    </div>
  );
}