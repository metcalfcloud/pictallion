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
  Heart
} from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import UploadModal from "@/components/upload-modal";
import PhotoDetailModal from "@/components/photo-detail-modal";

interface Stats {
  totalPhotos: number;
  bronzeCount: number;
  silverCount: number;
  goldCount: number;
  aiProcessedCount: number;
  pendingReviewCount: number;
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
        return <CheckCircle className="text-gray-600" size={16} />;
    }
  };

  const getTierBadgeClass = (tier: string) => {
    switch (tier) {
      case 'bronze':
        return 'bg-orange-500 text-white';
      case 'silver':
        return 'bg-gray-500 text-white';
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
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Dashboard</h2>
            <p className="text-sm text-gray-500">Welcome to Pictallion - Overview of your photo collection</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="relative">
              <input 
                type="text" 
                placeholder="Search photos..." 
                className="w-80 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <i className="fas fa-search absolute left-3 top-3 text-gray-400"></i>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm">
                <i className="fas fa-bell"></i>
              </Button>
              <div className="w-8 h-8 bg-gray-300 rounded-full"></div>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 p-6 overflow-y-auto">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Photos</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {statsLoading ? "..." : stats?.totalPhotos || 0}
                  </p>
                  <p className="text-sm text-green-600 mt-1">
                    <TrendingUp className="inline w-4 h-4" /> Collection growing
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Images className="text-blue-600 text-xl" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">AI Processed</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {statsLoading ? "..." : stats?.aiProcessedCount || 0}
                  </p>
                  <p className="text-sm text-green-600 mt-1">
                    <Bot className="inline w-4 h-4" /> Processing active
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Bot className="text-green-600 text-xl" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Pending Review</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {statsLoading ? "..." : stats?.pendingReviewCount || 0}
                  </p>
                  <p className="text-sm text-yellow-600 mt-1">
                    <Clock className="inline w-4 h-4" /> Needs attention
                  </p>
                </div>
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <Eye className="text-yellow-600 text-xl" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Gold Tier</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {statsLoading ? "..." : stats?.goldCount || 0}
                  </p>
                  <p className="text-sm text-green-600 mt-1">
                    <CheckCircle className="inline w-4 h-4" /> Curated
                  </p>
                </div>
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <Star className="text-yellow-500 text-xl" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Processing Pipeline */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Processing Pipeline</h3>
            <div className="flex items-center justify-between">
              {/* Bronze Tier */}
              <div className="flex-1 text-center">
                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <i className="fas fa-inbox text-orange-600 text-2xl"></i>
                </div>
                <h4 className="font-medium text-gray-900">Bronze Tier</h4>
                <p className="text-2xl font-bold text-orange-600 mt-1">
                  {statsLoading ? "..." : stats?.bronzeCount || 0}
                </p>
                <p className="text-sm text-gray-500">Raw uploads</p>
              </div>

              {/* Arrow */}
              <div className="px-4">
                <ArrowRight className="text-gray-300 text-xl" />
              </div>

              {/* Silver Tier */}
              <div className="flex-1 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <WandSparkles className="text-gray-600 text-2xl" />
                </div>
                <h4 className="font-medium text-gray-900">Silver Tier</h4>
                <p className="text-2xl font-bold text-gray-600 mt-1">
                  {statsLoading ? "..." : stats?.silverCount || 0}
                </p>
                <p className="text-sm text-gray-500">AI processed</p>
              </div>

              {/* Arrow */}
              <div className="px-4">
                <ArrowRight className="text-gray-300 text-xl" />
              </div>

              {/* Gold Tier */}
              <div className="flex-1 text-center">
                <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Star className="text-yellow-600 text-2xl" />
                </div>
                <h4 className="font-medium text-gray-900">Gold Tier</h4>
                <p className="text-2xl font-bold text-yellow-600 mt-1">
                  {statsLoading ? "..." : stats?.goldCount || 0}
                </p>
                <p className="text-sm text-gray-500">Curated</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity & Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Recent Activity */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
                <Button variant="ghost" size="sm">
                  View all
                </Button>
              </div>
              <div className="space-y-4">
                {activityLoading ? (
                  <div className="text-center text-gray-500">Loading...</div>
                ) : activity && activity.length > 0 ? (
                  activity.slice(0, 5).map((item) => (
                    <div key={item.id} className="flex items-start space-x-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                        {getActivityIcon(item.action)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900">{item.details}</p>
                        <p className="text-xs text-gray-500">{formatTimeAgo(item.timestamp)}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-gray-500">No recent activity</div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  className="flex flex-col items-center justify-center p-4 h-auto border-2 border-dashed hover:border-primary hover:bg-primary/5"
                  onClick={() => setIsUploadModalOpen(true)}
                >
                  <UploadIcon className="h-6 w-6 mb-2 text-gray-400" />
                  <span className="text-sm font-medium">Upload Photos</span>
                </Button>

                <Button
                  variant="outline"
                  className="flex flex-col items-center justify-center p-4 h-auto border-2 border-dashed hover:border-green-500 hover:bg-green-50"
                  asChild
                >
                  <Link href="/gallery?tier=bronze">
                    <WandSparkles className="h-6 w-6 mb-2 text-gray-400" />
                    <span className="text-sm font-medium">Process Batch</span>
                  </Link>
                </Button>

                <Button
                  variant="outline"
                  className="flex flex-col items-center justify-center p-4 h-auto border-2 border-dashed hover:border-yellow-500 hover:bg-yellow-50"
                  asChild
                >
                  <Link href="/gallery?tier=silver">
                    <Eye className="h-6 w-6 mb-2 text-gray-400" />
                    <span className="text-sm font-medium">Review Queue</span>
                  </Link>
                </Button>

                <Button
                  variant="outline"
                  className="flex flex-col items-center justify-center p-4 h-auto border-2 border-dashed hover:border-purple-500 hover:bg-purple-50"
                >
                  <BarChart3 className="h-6 w-6 mb-2 text-gray-400" />
                  <span className="text-sm font-medium">Analytics</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Photo Gallery Preview */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Recent Photos</h3>
              <div className="flex items-center space-x-2">
                <select className="text-sm border border-gray-300 rounded-lg px-3 py-1 focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="all">All Tiers</option>
                  <option value="bronze">Bronze</option>
                  <option value="silver">Silver</option>
                  <option value="gold">Gold</option>
                </select>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/gallery">View all</Link>
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {photosLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="w-full h-32 bg-gray-200 rounded-lg animate-pulse" />
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
                <div className="col-span-full text-center text-gray-500 py-8">
                  No photos uploaded yet. <Button variant="link" onClick={() => setIsUploadModalOpen(true)}>Upload your first photos</Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <UploadModal 
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