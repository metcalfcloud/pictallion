import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FolderOpen, Settings } from "lucide-react";
import { UnifiedUpload } from "@/components/unified-upload";
import { TestDropzone } from "@/components/test-dropzone";

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

      <TestDropzone />
      
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