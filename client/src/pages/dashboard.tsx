import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Upload as UploadIcon, 
  Images, 
  Bot, 
  Eye, 
  Star,
  ChartLine,
  WandSparkles,
  BarChart3,
  Camera,
  TrendingUp,
  Clock,
  CheckCircle,
  ArrowRight,
  Heart,
  Sparkles
} from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { UnifiedUpload } from "@/components/unified-upload";
import { CompactDropzone } from "@/components/compact-dropzone";
import PhotoDetailModal from "@/components/photo-detail-modal";
import { ProcessingStateBadge, getProcessingState } from "@/components/ui/processing-state-badge";

interface Stats {
  totalPhotos: number;
  silverCount: number;
  goldCount: number;
}

interface Activity {
  id: string;
  action: string;
  details: string;
  timestamp: string;
}

interface Photo {
  id: string;
  tier: 'bronze' | 'silver' | 'gold';
  filePath: string;
  mimeType: string;
  fileSize: number;
  metadata: any;
  isReviewed: boolean;
  rating?: number;
  keywords?: string[];
  location?: string;
  eventType?: string;
  eventName?: string;
  perceptualHash?: string;
  createdAt: string;
  mediaAsset: {
    id: string;
    originalFilename: string;
  };
}

export default function Dashboard() {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);

  const { data: stats, isLoading: statsLoading } = useQuery<Stats>({
    queryKey: ["/api/stats"],
  });

  const { data: activity, isLoading: activityLoading } = useQuery<Activity[]>({
    queryKey: ["/api/activity"],
  });

  const { data: recentPhotos, isLoading: photosLoading } = useQuery<Photo[]>({
    queryKey: ["/api/photos/recent"],
  });

  const getActivityIcon = (action: string) => {
    switch (action) {
      case 'INGESTED':
        return <UploadIcon className="text-green-600" size={16} />;
      case 'PROMOTED':
        return <Bot className="text-blue-600" size={16} />;
      case 'METADATA_EDITED':
        return <Eye className="text-yellow-600" size={16} />;
      default:
        return <CheckCircle className="text-muted-foreground" size={16} />;
    }
  };

  const getTierBadgeClass = (tier: string) => {
    switch (tier) {
      case 'silver':
        return 'bg-blue-500 text-white';
      case 'gold':
        return 'bg-yellow-500 text-white';
      default:
        return 'bg-gray-300 text-gray-700';
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInSeconds = Math.floor((now.getTime() - time.getTime()) / 1000);

    if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    return `${Math.floor(diffInSeconds / 86400)} days ago`;
  };

  return (
    <>
      {/* Header */}
      <header className="bg-card border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-card-foreground">Your Photo Collection</h2>
            <p className="text-muted-foreground mt-1">Organize, process, and discover your memories</p>
          </div>
          <div className="flex items-center space-x-3">
            <Button 
              onClick={() => setIsUploadModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <UploadIcon className="w-4 h-4 mr-2" />
              Add Photos
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 p-6 overflow-y-auto bg-background">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Photos</p>
                  <p className="text-3xl font-bold text-card-foreground mt-1">
                    {statsLoading ? "..." : stats?.totalPhotos || 0}
                  </p>
                  <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                    <TrendingUp className="inline w-4 h-4" /> Unique assets
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                  <Images className="text-blue-600 dark:text-blue-400 text-xl" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Silver Tier</p>
                  <p className="text-3xl font-bold text-card-foreground mt-1">
                    {statsLoading ? "..." : stats?.silverCount || 0}
                  </p>
                  <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                    <Sparkles className="inline w-4 h-4" /> AI processed
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                  <Sparkles className="text-green-600 dark:text-green-400 text-xl" />
                </div>
              </div>
            </CardContent>
          </Card>



          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Gold Tier</p>
                  <p className="text-3xl font-bold text-card-foreground mt-1">
                    {statsLoading ? "..." : stats?.goldCount || 0}
                  </p>
                  <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                    <CheckCircle className="inline w-4 h-4" /> Curated
                  </p>
                </div>
                <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg flex items-center justify-center">
                  <Star className="text-yellow-500 dark:text-yellow-400 text-xl" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Processing Pipeline & Upload Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Processing Pipeline */}
          <div className="lg:col-span-2">
            <Card className="h-full">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-card-foreground mb-4">Processing Pipeline</h3>
                <div className="flex items-center justify-between">
                  {/* Upload Staging */}
                  <div className="flex-1 text-center">
                    <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Camera className="text-orange-600 dark:text-orange-400 text-2xl" />
                    </div>
                    <h4 className="font-medium text-card-foreground">Upload Staging</h4>
                    <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">
                      Temporary
                    </p>
                    <p className="text-sm text-muted-foreground">Processing to Silver</p>
                  </div>

                  {/* Arrow */}
                  <div className="px-4">
                    <ArrowRight className="text-muted-foreground text-xl" />
                  </div>

                  {/* Silver Tier */}
                  <div className="flex-1 text-center">
                    <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-3">
                      <WandSparkles className="text-muted-foreground dark:text-gray-300 text-2xl" />
                    </div>
                    <h4 className="font-medium text-card-foreground">Silver Tier</h4>
                    <p className="text-2xl font-bold text-muted-foreground dark:text-gray-300 mt-1">
                      {statsLoading ? "..." : stats?.silverCount || 0}
                    </p>
                    <p className="text-sm text-muted-foreground">AI processed</p>
                  </div>

                  {/* Arrow */}
                  <div className="px-4">
                    <ArrowRight className="text-muted-foreground text-xl" />
                  </div>

                  {/* Gold Tier */}
                  <div className="flex-1 text-center">
                    <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/20 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Star className="text-yellow-600 dark:text-yellow-400 text-2xl" />
                    </div>
                    <h4 className="font-medium text-card-foreground">Gold Tier</h4>
                    <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mt-1">
                      {statsLoading ? "..." : stats?.goldCount || 0}
                    </p>
                    <p className="text-sm text-muted-foreground">Curated</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Compact Dropzone */}
          <div className="lg:col-span-1">
            <CompactDropzone 
              onFilesSelected={(files) => {
                // Convert files to the format expected by UnifiedUpload and open modal
                setIsUploadModalOpen(true);
              }}
            />
          </div>
        </div>

        {/* Recent Activity & Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Recent Activity */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-card-foreground">Recent Activity</h3>
                <Button variant="ghost" size="sm">
                  View all
                </Button>
              </div>
              <div className="space-y-4">
                {activityLoading ? (
                  <div className="text-center text-muted-foreground">Loading...</div>
                ) : activity && activity.length > 0 ? (
                  activity.slice(0, 5).map((item) => (
                    <div key={item.id} className="flex items-start space-x-3">
                      <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center flex-shrink-0">
                        {getActivityIcon(item.action)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-card-foreground">{item.details}</p>
                        <p className="text-xs text-muted-foreground">{formatTimeAgo(item.timestamp)}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-muted-foreground">No recent activity</div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-card-foreground mb-4">Quick Actions</h3>
              <div className="grid grid-cols-1 gap-3">
                {(stats?.silverCount ?? 0) > 0 && (
                  <Button
                    variant="outline"
                    className="flex items-center justify-between p-4 h-auto border border-green-200 dark:border-green-800 hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-950"
                    asChild
                  >
                    <Link href="/gallery?tier=silver">
                      <div className="flex items-center">
                        <WandSparkles className="h-5 w-5 mr-3 text-green-600" />
                        <div className="text-left">
                          <div className="font-medium">Review {(stats?.silverCount ?? 0)} Silver photos</div>
                          <div className="text-sm text-muted-foreground">Add AI tags and descriptions</div>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  </Button>
                )}



                <Button
                  variant="outline"
                  className="flex items-center justify-between p-4 h-auto border border-blue-200 dark:border-blue-800 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950"
                  asChild
                >
                  <Link href="/gallery">
                    <div className="flex items-center">
                      <Images className="h-5 w-5 mr-3 text-blue-600" />
                      <div className="text-left">
                        <div className="font-medium">Browse all photos</div>
                        <div className="text-sm text-muted-foreground">View your complete collection</div>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Photo Gallery Preview */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-card-foreground">Recent Photos</h3>
              <div className="flex items-center space-x-2">
                <select className="text-sm border border-border bg-background text-foreground rounded-lg px-3 py-1 focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="all">All Tiers</option>
                  <option value="silver">Silver</option>
                  <option value="gold">Gold</option>
                </select>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/gallery">View all</Link>
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {photosLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="w-full h-32 bg-muted rounded-lg animate-pulse" />
                ))
              ) : recentPhotos && recentPhotos.length > 0 ? (
                recentPhotos.map((photo) => (
                  <div 
                    key={photo.id} 
                    className="relative group cursor-pointer"
                    onClick={() => setSelectedPhoto(photo)}
                  >
                    <img 
                      src={`/api/files/${photo.filePath}`} 
                      alt={photo.mediaAsset.originalFilename}
                      className="w-full h-32 object-cover rounded-lg"
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity rounded-lg"></div>
                    <div className="absolute top-2 left-2">
                      <span className={`text-white text-xs px-2 py-1 rounded-full capitalize ${getTierBadgeClass(photo.tier)}`}>
                        {photo.tier}
                      </span>
                    </div>
                    <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="w-6 h-6 p-0 rounded-full"
                      >
                        <Heart className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full text-center text-muted-foreground py-8">
                  No photos uploaded yet. <Button variant="link" onClick={() => setIsUploadModalOpen(true)}>Upload your first photos</Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <UnifiedUpload 
        open={isUploadModalOpen} 
        onOpenChange={setIsUploadModalOpen} 
      />

      {selectedPhoto && (
        <PhotoDetailModal 
          photo={selectedPhoto}
          open={!!selectedPhoto}
          onOpenChange={(open) => !open && setSelectedPhoto(null)}
        />
      )}
    </>
  );
}