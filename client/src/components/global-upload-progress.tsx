import React, { useState, useEffect } from 'react';
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { uploadManager, UploadProgress } from "@/lib/upload-manager";
import { Upload, X, CheckCircle, AlertCircle, Minimize2, Maximize2 } from "lucide-react";

export function GlobalUploadProgress() {
  const [progress, setProgress] = useState<UploadProgress>({
    totalFiles: 0,
    completedFiles: 0,
    overallProgress: 0,
    isActive: false
  });
  const [isMinimized, setIsMinimized] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const unsubscribe = uploadManager.subscribe((newProgress) => {
      setProgress(newProgress);
      setIsVisible(newProgress.isActive || newProgress.totalFiles > 0);
    });

    return unsubscribe;
  }, []);

  if (!isVisible) {
    return null;
  }

  const getStatusColor = () => {
    if (progress.isActive) return "bg-blue-500";
    if (progress.completedFiles === progress.totalFiles) return "bg-green-500";
    return "bg-gray-500";
  };

  const getStatusText = () => {
    if (progress.isActive) {
      return progress.currentFile 
        ? `Uploading ${progress.currentFile}...`
        : `Uploading ${progress.completedFiles + 1} of ${progress.totalFiles}...`;
    }
    if (progress.completedFiles === progress.totalFiles) {
      return `${progress.totalFiles} files uploaded successfully`;
    }
    return `${progress.completedFiles} of ${progress.totalFiles} files completed`;
  };

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Card className="border-2 shadow-lg">
          <CardContent className="p-3">
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${getStatusColor()} ${progress.isActive ? 'animate-pulse' : ''}`} />
              <span className="text-sm font-medium">
                {progress.completedFiles}/{progress.totalFiles}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMinimized(false)}
                className="p-1 h-6 w-6"
              >
                <Maximize2 className="w-3 h-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80">
      <Card className="border-2 shadow-lg">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <Upload className="w-4 h-4 text-blue-600" />
              <h4 className="font-medium text-sm">Upload Progress</h4>
            </div>
            <div className="flex items-center space-x-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMinimized(true)}
                className="p-1 h-6 w-6"
              >
                <Minimize2 className="w-3 h-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  uploadManager.clearCompleted();
                  if (!progress.isActive) setIsVisible(false);
                }}
                className="p-1 h-6 w-6"
                disabled={progress.isActive}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{getStatusText()}</span>
              <span>{Math.round(progress.overallProgress)}%</span>
            </div>

            <Progress 
              value={progress.overallProgress} 
              className="h-2"
            />

            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center space-x-4">
                <span className="flex items-center space-x-1">
                  <CheckCircle className="w-3 h-3 text-green-600" />
                  <span>{progress.completedFiles}</span>
                </span>
                <span className="text-muted-foreground">
                  Total: {progress.totalFiles}
                </span>
              </div>
              
              {progress.isActive && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => uploadManager.clearAll()}
                  className="h-6 px-2 text-xs"
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}