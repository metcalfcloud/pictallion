import React, { useState, useEffect } from 'react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { uploadManager, UploadProgress, UploadFile } from '@/lib/upload-manager';
import {
  Upload,
  X,
  CheckCircle,
  AlertCircle,
  Minimize2,
  Maximize2,
  AlertTriangle,
} from 'lucide-react';

export function GlobalUploadProgress() {
  const [progress, setProgress] = useState<UploadProgress>({
    totalFiles: 0,
    completedFiles: 0,
    overallProgress: 0,
    isActive: false,
  });
  const [isMinimized, setIsMinimized] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [conflicts, setConflicts] = useState<UploadFile[]>([]);

  useEffect(() => {
    const unsubscribe = uploadManager.subscribe((newProgress) => {
      setProgress(newProgress);
      setIsVisible(newProgress.isActive || newProgress.totalFiles > 0);

      // Check for conflicts
      const newConflicts = uploadManager.getConflicts();
      if (newConflicts.length > 0 && newConflicts.length !== conflicts.length) {
        setConflicts(newConflicts);
        setShowConflictDialog(true);
      }
    });

    return unsubscribe;
  }, [conflicts.length]);

  if (!isVisible) {
    return null;
  }

  const getStatusColor = () => {
    if (progress.isActive) return 'bg-blue-500';
    if (progress.completedFiles === progress.totalFiles) return 'bg-green-500';
    return 'bg-gray-500';
  };

  const getStatusText = () => {
    const conflictCount = conflicts.length;
    if (conflictCount > 0) {
      return `${conflictCount} duplicates need review`;
    }
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

  const handleResolveConflicts = () => {
    setShowConflictDialog(true);
  };

  const handleConflictResolution = (
    uploadId: string,
    action: 'keep_existing' | 'replace_with_new' | 'keep_both',
  ) => {
    uploadManager.resolveConflict(uploadId, action);
    // Update local conflicts state
    setConflicts((current) => current.filter((c) => c.id !== uploadId));

    if (conflicts.length <= 1) {
      setShowConflictDialog(false);
    }
  };

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Card className="border-2 shadow-lg">
          <CardContent className="p-3">
            <div className="flex items-center space-x-3">
              <div
                className={`w-3 h-3 rounded-full ${getStatusColor()} ${progress.isActive ? 'animate-pulse' : ''}`}
              />
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

            <Progress value={progress.overallProgress} className="h-2" />

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

              {conflicts.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResolveConflicts}
                  className="h-6 px-2 text-xs bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100"
                >
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Review
                </Button>
              )}

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

            {conflicts.length > 0 && (
              <div className="mt-2 text-xs text-orange-600 bg-orange-50 dark:bg-orange-900/20 p-2 rounded">
                <AlertTriangle className="w-3 h-3 inline mr-1" />
                {conflicts.length} files have potential duplicates that need your review
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Conflict Resolution Dialog */}
      <Dialog open={showConflictDialog} onOpenChange={setShowConflictDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Resolve Duplicate Conflicts</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {conflicts.map((conflict) =>
              conflict.conflicts?.map((conflictData: any) => (
                <Card
                  key={conflictData.id}
                  className="border-orange-200 dark:border-orange-800"
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-orange-600" />
                        <span className="font-medium">
                          {conflictData.conflictType === 'identical_md5'
                            ? 'Identical File'
                            : conflictData.conflictType === 'visually_identical'
                              ? 'Visually Identical'
                              : 'Similar Metadata'}
                        </span>
                        <Badge variant="outline">
                          {Math.round(conflictData.similarity)}% match
                        </Badge>
                      </div>
                      <Badge variant="secondary">
                        {conflictData.suggestedAction === 'keep_existing'
                          ? 'Recommended: Keep Existing'
                          : conflictData.suggestedAction === 'replace_with_new'
                            ? 'Recommended: Replace'
                            : 'Recommended: Keep Both'}
                      </Badge>
                    </div>

                    <p className="text-sm text-muted-foreground mb-4">
                      {conflictData.reasoning}
                    </p>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                      <div className="space-y-2">
                        <h4 className="font-medium text-sm">Existing File</h4>
                        <div className="bg-muted p-3 rounded text-xs">
                          <p>
                            <strong>Name:</strong>{' '}
                            {conflictData.existingPhoto.mediaAsset.originalFilename}
                          </p>
                          <p>
                            <strong>Size:</strong>{' '}
                            {(
                              conflictData.existingPhoto.fileSize /
                              1024 /
                              1024
                            ).toFixed(2)}{' '}
                            MB
                          </p>
                          <p>
                            <strong>Created:</strong>{' '}
                            {new Date(
                              conflictData.existingPhoto.createdAt,
                            ).toLocaleDateString()}
                          </p>
                          <p>
                            <strong>Tier:</strong> {conflictData.existingPhoto.tier}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h4 className="font-medium text-sm">New File</h4>
                        <div className="bg-muted p-3 rounded text-xs">
                          <p>
                            <strong>Name:</strong>{' '}
                            {conflictData.newFile.originalFilename}
                          </p>
                          <p>
                            <strong>Size:</strong>{' '}
                            {(conflictData.newFile.fileSize / 1024 / 1024).toFixed(2)}{' '}
                            MB
                          </p>
                          <p>
                            <strong>Hash:</strong>{' '}
                            {conflictData.newFile.fileHash.substring(0, 16)}...
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          handleConflictResolution(conflict.id, 'keep_existing')
                        }
                        className="flex-1"
                      >
                        Keep Existing
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          handleConflictResolution(conflict.id, 'replace_with_new')
                        }
                        className="flex-1"
                      >
                        Replace with New
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          handleConflictResolution(conflict.id, 'keep_both')
                        }
                        className="flex-1"
                      >
                        Keep Both
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )),
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
