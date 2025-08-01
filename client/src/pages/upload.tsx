import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FolderOpen, Settings } from "lucide-react";
import { UnifiedUpload } from "@/components/unified-upload";

// Helper function to extract photo date from metadata or filename
const extractPhotoDate = (photo: any): Date | null => {
  try {
    // First try EXIF datetime fields with various formats
    if (photo.metadata?.exif) {
      const exif = photo.metadata.exif;
      
      // Try DateTimeOriginal first (most accurate)
      if (exif.dateTimeOriginal) {
        const date = new Date(exif.dateTimeOriginal);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
      
      // Try CreateDate
      if (exif.createDate) {
        const date = new Date(exif.createDate);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
      
      // Try DateTime
      if (exif.dateTime) {
        const date = new Date(exif.dateTime);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }

    // Try to extract from filename if it has timestamp format (YYYYMMDD_HHMMSS)
    const filename = photo.mediaAsset?.originalFilename || '';
    const timestampMatch = filename.match(/^(\d{8})_(\d{6})/);
    if (timestampMatch) {
      const dateStr = timestampMatch[1]; // YYYYMMDD
      const timeStr = timestampMatch[2]; // HHMMSS
      const year = parseInt(dateStr.substring(0, 4));
      const month = parseInt(dateStr.substring(4, 6)) - 1; // Month is 0-indexed
      const day = parseInt(dateStr.substring(6, 8));
      const hour = parseInt(timeStr.substring(0, 2));
      const minute = parseInt(timeStr.substring(2, 4));
      const second = parseInt(timeStr.substring(4, 6));

      const extractedDate = new Date(year, month, day, hour, minute, second);
      if (!isNaN(extractedDate.getTime())) {
        return extractedDate;
      }
    }

    // Fall back to file creation time
    if (photo.createdAt) {
      const date = new Date(photo.createdAt);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    return null;
  } catch (error) {
    // Removed console.error('Error extracting photo date:', error);
    return null;
  }
};

export default function Upload() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Upload Photos</h2>
          <p className="text-muted-foreground">
            Add photos and videos to your collection with intelligent duplicate detection
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm">
            <FolderOpen className="w-4 h-4 mr-2" />
            Bulk Import
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload Photos & Videos</CardTitle>
        </CardHeader>
        <CardContent>
          <UnifiedUpload mode="fullscreen" />
        </CardContent>
      </Card>
    </div>
  );
}