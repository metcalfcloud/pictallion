import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SimpleUpload } from "@/components/simple-upload";
import { useState } from "react";



export default function Upload() {
  const [showSimpleUpload, setShowSimpleUpload] = useState(false);



  return (
    <>
      {/* Header */}
      <header className="bg-card border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-card-foreground">Upload Photos</h2>
            <p className="text-sm text-muted-foreground">Testing new upload system</p>
          </div>
          <Button onClick={() => setShowSimpleUpload(true)}>
            Test Simple Upload
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">Upload System Test</h3>
              <p className="text-muted-foreground mb-4">
                The original upload system had issues. Click "Test Simple Upload" to try a completely rebuilt version that should work correctly.
              </p>
              <Button onClick={() => setShowSimpleUpload(true)} size="lg">
                Open Simple Upload Dialog
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <SimpleUpload 
        open={showSimpleUpload} 
        onOpenChange={setShowSimpleUpload} 
      />
    </>
  );
}