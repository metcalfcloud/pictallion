
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, Trash2, Eye, Download, Star, Clock, HardDrive } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';

interface DuplicateGroup {
  id: string;
  photos: Array<{
    id: string;
    filePath: string;
    tier: string;
    similarity: number;
    metadata?: any;
    mediaAsset: { originalFilename: string };
    createdAt: string;
    fileSize?: number;
    rating?: number;
  }>;
  suggestedKeep: string;
  averageSimilarity: number;
  groupType: 'identical' | 'very_similar' | 'similar';
}

interface DuplicateAnalysis {
  groups: DuplicateGroup[];
  totalDuplicates: number;
  potentialSpaceSavings: number;
  summary: {
    identicalGroups: number;
    verySimilarGroups: number;
    similarGroups: number;
  };
}

export default function DuplicatesPage() {
  const [analysis, setAnalysis] = useState<DuplicateAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [selectedActions, setSelectedActions] = useState<Map<string, { action: string; keepPhotoId?: string }>>(new Map());
  const [scanProgress, setScanProgress] = useState(0);

  useEffect(() => {
    scanForDuplicates();
  }, []);

  const scanForDuplicates = async (minSimilarity: number = 85) => {
    setLoading(true);
    setScanProgress(0);
    
    try {
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setScanProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const response = await fetch(`/api/duplicates/scan?minSimilarity=${minSimilarity}`);
      const data = await response.json();
      
      clearInterval(progressInterval);
      setScanProgress(100);
      
      setAnalysis(data);
      
      // Initialize default actions (keep suggested for all groups)
      const defaultActions = new Map();
      if (data && data.groups && Array.isArray(data.groups)) {
        data.groups.forEach((group: DuplicateGroup) => {
          defaultActions.set(group.id, { action: 'keep_suggested' });
        });
      }
      setSelectedActions(defaultActions);
      
    } catch (error) {
      console.error('Failed to scan for duplicates:', error);
      // Set empty analysis on error
      setAnalysis({
        groups: [],
        totalDuplicates: 0,
        potentialSpaceSavings: 0,
        summary: {
          identicalGroups: 0,
          verySimilarGroups: 0,
          similarGroups: 0
        }
      });
    } finally {
      setLoading(false);
      setTimeout(() => setScanProgress(0), 1000);
    }
  };

  const processDuplicates = async () => {
    if (!analysis || selectedActions.size === 0) return;
    
    setProcessing(true);
    try {
      const actions = Array.from(selectedActions.entries()).map(([groupId, action]) => ({
        groupId,
        ...action
      }));

      const response = await fetch('/api/duplicates/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actions })
      });

      const result = await response.json();
      
      if (result.errors?.length > 0) {
        console.error('Processing errors:', result.errors);
      }
      
      // Refresh the analysis
      await scanForDuplicates();
      
    } catch (error) {
      console.error('Failed to process duplicates:', error);
    } finally {
      setProcessing(false);
    }
  };

  const updateAction = (groupId: string, action: string, keepPhotoId?: string) => {
    const newActions = new Map(selectedActions);
    newActions.set(groupId, { action, keepPhotoId });
    setSelectedActions(newActions);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getTierBadgeColor = (tier: string) => {
    switch (tier) {
      case 'gold': return 'bg-yellow-500';
      case 'silver': return 'bg-gray-400';
      case 'bronze': return 'bg-amber-600';
      default: return 'bg-gray-500';
    }
  };

  const getGroupTypeColor = (type: string) => {
    switch (type) {
      case 'identical': return 'text-red-600';
      case 'very_similar': return 'text-orange-600';
      case 'similar': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  if (loading && !analysis) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Duplicate Detection</h2>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Scanning for Duplicates...</CardTitle>
            <CardDescription>Analyzing your photo collection for similar images</CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={scanProgress} className="w-full" />
            <p className="text-sm text-gray-500 mt-2">
              {scanProgress < 50 ? 'Reading photo hashes...' : 
               scanProgress < 80 ? 'Comparing similarities...' : 
               'Generating analysis...'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Duplicate Detection</h2>
          <p className="text-gray-600">Find and manage duplicate or similar photos</p>
        </div>
        <div className="space-x-2">
          <Button 
            variant="outline" 
            onClick={() => scanForDuplicates()}
            disabled={loading}
          >
            {loading ? 'Scanning...' : 'Rescan'}
          </Button>
          {analysis && analysis.groups.length > 0 && (
            <Button 
              onClick={processDuplicates}
              disabled={processing || selectedActions.size === 0}
            >
              {processing ? 'Processing...' : `Process ${selectedActions.size} Groups`}
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      {analysis && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 text-orange-500" />
                <div>
                  <p className="text-sm text-gray-600">Duplicate Groups</p>
                  <p className="text-2xl font-semibold">{analysis.groups.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Eye className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="text-sm text-gray-600">Total Duplicates</p>
                  <p className="text-2xl font-semibold">{analysis.totalDuplicates}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <HardDrive className="w-5 h-5 text-green-500" />
                <div>
                  <p className="text-sm text-gray-600">Space Savings</p>
                  <p className="text-2xl font-semibold">{formatFileSize(analysis.potentialSpaceSavings)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Clock className="w-5 h-5 text-purple-500" />
                <div>
                  <p className="text-sm text-gray-600">Last Scan</p>
                  <p className="text-sm font-semibold">Just now</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      {analysis ? (
        analysis.groups.length > 0 ? (
          <Tabs defaultValue="all" className="space-y-4">
            <TabsList>
              <TabsTrigger value="all">All Groups ({analysis.groups.length})</TabsTrigger>
              <TabsTrigger value="identical">Identical ({analysis.summary.identicalGroups})</TabsTrigger>
              <TabsTrigger value="very_similar">Very Similar ({analysis.summary.verySimilarGroups})</TabsTrigger>
              <TabsTrigger value="similar">Similar ({analysis.summary.similarGroups})</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-4">
              {analysis.groups.map(group => (
                <DuplicateGroupCard 
                  key={group.id} 
                  group={group} 
                  selectedAction={selectedActions.get(group.id)}
                  onActionChange={(action, keepPhotoId) => updateAction(group.id, action, keepPhotoId)}
                />
              ))}
            </TabsContent>

            <TabsContent value="identical" className="space-y-4">
              {analysis.groups.filter(g => g.groupType === 'identical').map(group => (
                <DuplicateGroupCard 
                  key={group.id} 
                  group={group} 
                  selectedAction={selectedActions.get(group.id)}
                  onActionChange={(action, keepPhotoId) => updateAction(group.id, action, keepPhotoId)}
                />
              ))}
            </TabsContent>

            <TabsContent value="very_similar" className="space-y-4">
              {analysis.groups.filter(g => g.groupType === 'very_similar').map(group => (
                <DuplicateGroupCard 
                  key={group.id} 
                  group={group} 
                  selectedAction={selectedActions.get(group.id)}
                  onActionChange={(action, keepPhotoId) => updateAction(group.id, action, keepPhotoId)}
                />
              ))}
            </TabsContent>

            <TabsContent value="similar" className="space-y-4">
              {analysis.groups.filter(g => g.groupType === 'similar').map(group => (
                <DuplicateGroupCard 
                  key={group.id} 
                  group={group} 
                  selectedAction={selectedActions.get(group.id)}
                  onActionChange={(action, keepPhotoId) => updateAction(group.id, action, keepPhotoId)}
                />
              ))}
            </TabsContent>
          </Tabs>
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <Eye className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Duplicates Found</h3>
              <p className="text-gray-600">Great! Your photo collection doesn't have any duplicate images.</p>
            </CardContent>
          </Card>
        )
      ) : null}
    </div>
  );
}

function DuplicateGroupCard({ 
  group, 
  selectedAction, 
  onActionChange 
}: {
  group: DuplicateGroup;
  selectedAction?: { action: string; keepPhotoId?: string };
  onActionChange: (action: string, keepPhotoId?: string) => void;
}) {
  const getTierBadgeColor = (tier: string) => {
    switch (tier) {
      case 'gold': return 'bg-yellow-500';
      case 'silver': return 'bg-gray-400';
      case 'bronze': return 'bg-amber-600';
      default: return 'bg-gray-500';
    }
  };

  const getGroupTypeColor = (type: string) => {
    switch (type) {
      case 'identical': return 'text-red-600';
      case 'very_similar': return 'text-orange-600';
      case 'similar': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <CardTitle className="text-lg">
              Duplicate Group ({group.photos.length} photos)
            </CardTitle>
            <Badge variant="outline" className={getGroupTypeColor(group.groupType)}>
              {group.groupType.replace('_', ' ')} - {group.averageSimilarity}%
            </Badge>
          </div>
          <div className="flex items-center space-x-2">
            <Button 
              variant={selectedAction?.action === 'keep_suggested' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onActionChange('keep_suggested')}
            >
              Keep Suggested
            </Button>
            <Button 
              variant={selectedAction?.action === 'keep_all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onActionChange('keep_all')}
            >
              Keep All
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {group.photos.map(photo => (
            <div 
              key={photo.id} 
              className={`relative border-2 rounded-lg p-2 ${
                photo.id === group.suggestedKeep 
                  ? 'border-green-500 bg-green-50' 
                  : selectedAction?.keepPhotoId === photo.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200'
              }`}
            >
              <div className="aspect-square bg-gray-100 rounded mb-2 overflow-hidden">
                <img 
                  src={`/api/files/${photo.filePath}`}
                  alt={photo.mediaAsset.originalFilename}
                  className="w-full h-full object-cover"
                />
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Badge className={`${getTierBadgeColor(photo.tier)} text-white text-xs`}>
                    {photo.tier}
                  </Badge>
                  <span className="text-xs text-gray-500">
                    {photo.similarity}% match
                  </span>
                </div>
                
                <p className="text-xs text-gray-600 truncate">
                  {photo.mediaAsset.originalFilename}
                </p>
                
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{formatFileSize(photo.fileSize || 0)}</span>
                  {photo.rating && (
                    <div className="flex items-center">
                      <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                      <span className="ml-1">{photo.rating}</span>
                    </div>
                  )}
                </div>
                
                {photo.id === group.suggestedKeep && (
                  <Badge variant="outline" className="text-xs bg-green-100 text-green-800">
                    Suggested Keep
                  </Badge>
                )}
                
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full text-xs"
                  onClick={() => onActionChange('keep_specific', photo.id)}
                >
                  Keep This One
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
