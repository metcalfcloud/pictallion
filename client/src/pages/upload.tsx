import { Card, CardContent } from "@/components/ui/card";
import { UnifiedUpload } from "@/components/unified-upload";

export default function Upload() {
  return (
    <>
      {/* Header */}
      <header className="bg-card border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-card-foreground">Upload Photos</h2>
            <p className="text-sm text-muted-foreground">Add new photos to your collection</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          <UnifiedUpload 
            open={true} 
            onOpenChange={() => {}} 
            mode="fullscreen"
          />

          {/* Upload Instructions */}
          <Card className="mt-6">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-card-foreground mb-4">Upload Instructions</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-card-foreground mb-2">Supported Formats</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Images: JPEG, PNG, TIFF</li>
                    <li>• Videos: MP4, MOV, AVI</li>
                    <li>• Maximum size: 50MB per file</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-card-foreground mb-2">What Happens Next</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Files are uploaded to Bronze tier</li>
                    <li>• Duplicates are automatically detected</li>
                    <li>• Basic metadata is extracted</li>
                    <li>• Ready for AI processing</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}