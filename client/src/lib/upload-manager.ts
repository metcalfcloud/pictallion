import { apiRequest } from '@/lib/queryClient';

export interface UploadFile {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error' | 'conflict' | 'skipped';
  progress: number;
  message?: string;
  conflicts?: any[];
}

export interface UploadProgress {
  totalFiles: number;
  completedFiles: number;
  currentFile?: string;
  overallProgress: number;
  isActive: boolean;
}

class UploadManager {
  private uploads: Map<string, UploadFile> = new Map();
  private activeXhr: XMLHttpRequest | null = null;
  private subscribers: Set<(progress: UploadProgress) => void> = new Set();
  private isProcessing = false;

  subscribe(callback: (progress: UploadProgress) => void) {
    this.subscribers.add(callback);
    // Immediately notify with current state
    callback(this.getProgress());

    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notify() {
    const progress = this.getProgress();
    this.subscribers.forEach((callback) => callback(progress));
  }

  private getProgress(): UploadProgress {
    const uploads = Array.from(this.uploads.values());
    const totalFiles = uploads.length;
    // Include 'conflict' status in completed files since they are processed, just waiting for user action
    const completedFiles = uploads.filter((f) =>
      ['success', 'error', 'skipped', 'conflict'].includes(f.status),
    ).length;
    const uploadingFile = uploads.find((f) => f.status === 'uploading');

    let overallProgress = 0;
    if (totalFiles > 0) {
      const completedProgress = (completedFiles / totalFiles) * 100;
      const currentFileProgress = uploadingFile
        ? uploadingFile.progress / totalFiles
        : 0;
      overallProgress = completedProgress + currentFileProgress;
    }

    return {
      totalFiles,
      completedFiles,
      currentFile: uploadingFile?.file.name,
      overallProgress: Math.min(overallProgress, 100),
      isActive: this.isProcessing || uploads.some((f) => f.status === 'uploading'),
    };
  }

  addFiles(files: File[]) {
    files.forEach((file) => {
      const id = Math.random().toString(36).substr(2, 9);
      this.uploads.set(id, {
        id,
        file,
        status: 'pending',
        progress: 0,
      });
    });

    this.notify();

    // Auto-start if not already processing
    if (!this.isProcessing) {
      this.startUploads();
    }
  }

  async startUploads() {
    if (this.isProcessing) return;

    const pendingFiles = Array.from(this.uploads.values()).filter(
      (f) => f.status === 'pending',
    );
    if (pendingFiles.length === 0) return;

    this.isProcessing = true;
    this.notify();

    try {
      const formData = new FormData();
      pendingFiles.forEach((file) => {
        formData.append('files', file.file);
        // Mark as uploading
        this.uploads.set(file.id, { ...file, status: 'uploading', progress: 0 });
      });

      this.notify();

      // Use XMLHttpRequest for progress tracking
      const xhr = new XMLHttpRequest();
      this.activeXhr = xhr;

      // Track upload progress
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);

          // Update progress for all uploading files
          pendingFiles.forEach((file) => {
            const current = this.uploads.get(file.id);
            if (current && current.status === 'uploading') {
              this.uploads.set(file.id, { ...current, progress: percentComplete });
            }
          });

          this.notify();
        }
      });

      // Handle completion
      const uploadPromise = new Promise<any>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText);
              resolve(data);
            } catch (e) {
              reject(new Error('Invalid response format'));
            }
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error('Upload failed'));
        xhr.ontimeout = () => reject(new Error('Upload timed out'));
      });

      // Send the request
      xhr.open('POST', '/api/upload');
      xhr.send(formData);

      const data = await uploadPromise;

      // Update upload files with results
      pendingFiles.forEach((uploadFile) => {
        const result = data.results.find(
          (r: any) => r.filename === uploadFile.file.name,
        );
        if (result) {
          this.uploads.set(uploadFile.id, {
            ...uploadFile,
            status: result.status as UploadFile['status'],
            message: result.message,
            progress: 100,
            conflicts: result.conflicts || [],
          });
        }
      });

      // Show notification if there are conflicts
      const conflictCount = data.results.filter(
        (r: any) => r.status === 'conflict',
      ).length;
      if (conflictCount > 0) {
        // Could emit a custom event here for conflict notifications
        console.log(`${conflictCount} files have potential duplicates`);
      }
    } catch (error) {
      // Mark failed uploads
      pendingFiles.forEach((file) => {
        const current = this.uploads.get(file.id);
        if (current && current.status === 'uploading') {
          this.uploads.set(file.id, {
            ...current,
            status: 'error',
            message: 'Upload failed',
            progress: 0,
          });
        }
      });
    } finally {
      this.activeXhr = null;
      this.isProcessing = false;
      this.notify();
    }
  }

  getUploads(): UploadFile[] {
    return Array.from(this.uploads.values());
  }

  removeFile(id: string) {
    this.uploads.delete(id);
    this.notify();
  }

  clearCompleted() {
    Array.from(this.uploads.entries()).forEach(([id, upload]) => {
      if (['success', 'error', 'skipped'].includes(upload.status)) {
        this.uploads.delete(id);
      }
    });
    this.notify();
  }

  // Clear conflicts after resolution
  clearResolvedConflicts() {
    Array.from(this.uploads.entries()).forEach(([id, upload]) => {
      if (upload.status === 'conflict') {
        this.uploads.delete(id);
      }
    });
    this.notify();
  }

  // Resolve a specific conflict
  resolveConflict(
    uploadId: string,
    action: 'keep_existing' | 'replace_with_new' | 'keep_both',
  ) {
    const upload = this.uploads.get(uploadId);
    if (upload && upload.status === 'conflict') {
      // Mark as resolved - this could trigger a backend call
      this.uploads.set(uploadId, {
        ...upload,
        status: 'success',
        message: `Resolved: ${action.replace('_', ' ')}`,
      });
      this.notify();
    }
  }

  clearAll() {
    // Cancel active upload if any
    if (this.activeXhr) {
      this.activeXhr.abort();
      this.activeXhr = null;
    }

    this.uploads.clear();
    this.isProcessing = false;
    this.notify();
  }

  // Get uploads with conflicts for resolution
  getConflicts(): UploadFile[] {
    return Array.from(this.uploads.values()).filter((f) => f.status === 'conflict');
  }
}

export const uploadManager = new UploadManager();
