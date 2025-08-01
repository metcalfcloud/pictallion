import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { 
  Plus, 
  Wand2, 
  Users, 
  Calendar, 
  MapPin, 
  Camera, 
  Heart, 
  Baby, 
  GraduationCap,
  Home,
  Car,
  TreePine,
  Sunset,
  PartyPopper,
  Settings,
  RefreshCw,
  Eye,
  Trash2
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { toast } from '@/hooks/use-toast';

interface SmartCollection {
  id: string;
  name: string;
  description: string;
  type: 'auto' | 'manual';
  rules: CollectionRule[];
  photoCount: number;
  isActive: boolean;
  lastUpdated: string;
  icon: string;
  color: string;
}

interface CollectionRule {
  id: string;
  field: string;
  operator: string;
  value: string;
  weight: number;
}

interface Photo {
  id: string;
  filePath: string;
  metadata: any;
  aiTags: string[];
  eventType?: string;
  location?: string;
  createdAt: string;
}

const COLLECTION_ICONS = {
  Users: Users,
  Calendar: Calendar,
  MapPin: MapPin,
  Camera: Camera,
  Heart: Heart,
  Baby: Baby,
  GraduationCap: GraduationCap,
  Home: Home,
  Car: Car,
  TreePine: TreePine,
  Sunset: Sunset,
  PartyPopper: PartyPopper
};

const PREDEFINED_COLLECTIONS = [
  {
    name: "Family Portraits",
    description: "Photos featuring family members and group shots",
    icon: "Users",
    color: "blue",
    rules: [
      { field: "aiTags", operator: "contains", value: "family", weight: 3 },
      { field: "aiTags", operator: "contains", value: "people", weight: 2 },
      { field: "aiTags", operator: "contains", value: "portrait", weight: 2 },
      { field: "faceCount", operator: ">=", value: "2", weight: 2 }
    ]
  },
  {
    name: "Children & Kids",
    description: "Photos featuring children and childhood moments",
    icon: "Baby",
    color: "pink",
    rules: [
      { field: "aiTags", operator: "contains", value: "children", weight: 3 },
      { field: "aiTags", operator: "contains", value: "kids", weight: 3 },
      { field: "aiTags", operator: "contains", value: "baby", weight: 3 },
      { field: "personAge", operator: "<=", value: "12", weight: 2 }
    ]
  },
  {
    name: "Outdoor Adventures",
    description: "Nature, landscapes, and outdoor activities",
    icon: "TreePine",
    color: "green",
    rules: [
      { field: "aiTags", operator: "contains", value: "outdoor", weight: 3 },
      { field: "aiTags", operator: "contains", value: "nature", weight: 2 },
      { field: "aiTags", operator: "contains", value: "landscape", weight: 2 },
      { field: "aiTags", operator: "contains", value: "hiking", weight: 2 }
    ]
  },
  {
    name: "Special Events",
    description: "Birthdays, holidays, and celebrations",
    icon: "PartyPopper",
    color: "purple",
    rules: [
      { field: "eventType", operator: "equals", value: "birthday", weight: 3 },
      { field: "eventType", operator: "equals", value: "holiday", weight: 3 },
      { field: "aiTags", operator: "contains", value: "celebration", weight: 2 },
      { field: "aiTags", operator: "contains", value: "party", weight: 2 }
    ]
  },
  {
    name: "Home Life",
    description: "Daily life, home moments, and candid shots",
    icon: "Home",
    color: "orange",
    rules: [
      { field: "aiTags", operator: "contains", value: "home", weight: 2 },
      { field: "aiTags", operator: "contains", value: "indoor", weight: 1 },
      { field: "aiTags", operator: "contains", value: "family-time", weight: 2 },
      { field: "location", operator: "contains", value: "home", weight: 1 }
    ]
  },
  {
    name: "Golden Hour",
    description: "Beautiful lighting and sunset/sunrise photos",
    icon: "Sunset",
    color: "yellow",
    rules: [
      { field: "aiTags", operator: "contains", value: "sunset", weight: 3 },
      { field: "aiTags", operator: "contains", value: "sunrise", weight: 3 },
      { field: "aiTags", operator: "contains", value: "golden", weight: 2 },
      { field: "metadata.time", operator: "time_range", value: "17:00-19:00,06:00-08:00", weight: 1 }
    ]
  }
];

export function SmartCollections() {
  const [collections, setCollections] = useState<SmartCollection[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [newCollection, setNewCollection] = useState({
    name: '',
    description: '',
    icon: 'Camera',
    color: 'blue',
    rules: [] as CollectionRule[]
  });
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadCollections();
  }, []);

  const loadCollections = async () => {
    try {
      const response = await fetch('/api/smart-collections');
      if (response.ok) {
        const data = await response.json();
        setCollections(data);
      }
    } catch (error) {
      console.error('Failed to load collections:', error);
    }
  };

  const createPredefinedCollections = async () => {
    setIsProcessing(true);
    try {
      for (const template of PREDEFINED_COLLECTIONS) {
        await fetch('/api/smart-collections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: template.name,
            description: template.description,
            type: 'auto',
            icon: template.icon,
            color: template.color,
            rules: template.rules.map((rule, index) => ({
              id: `rule_${index}`,
              ...rule
            }))
          })
        });
      }

      await loadCollections();
      toast({
        title: "Collections Created",
        description: "Smart collections have been set up successfully!"
      });
    } catch (error) {
      console.error('Failed to create collections:', error);
      toast({
        title: "Error",
        description: "Failed to create smart collections.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const organizePhotos = async () => {
    setIsProcessing(true);
    try {
      const response = await fetch('/api/smart-collections/organize', {
        method: 'POST'
      });

      if (response.ok) {
        const result = await response.json();
        await loadCollections();
        toast({
          title: "Photos Organized",
          description: `${result.organized} photos have been organized into smart collections!`
        });
      }
    } catch (error) {
      console.error('Failed to organize photos:', error);
      toast({
        title: "Error",
        description: "Failed to organize photos.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleCollection = async (collectionId: string, isActive: boolean) => {
    try {
      await fetch(`/api/smart-collections/${collectionId}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive })
      });

      setCollections(prev => prev.map(col => 
        col.id === collectionId ? { ...col, isActive } : col
      ));
    } catch (error) {
      console.error('Failed to toggle collection:', error);
    }
  };

  const addRule = () => {
    const newRule: CollectionRule = {
      id: `rule_${Date.now()}`,
      field: 'aiTags',
      operator: 'contains',
      value: '',
      weight: 1
    };
    setNewCollection(prev => ({
      ...prev,
      rules: [...prev.rules, newRule]
    }));
  };

  const updateRule = (ruleId: string, field: string, value: any) => {
    setNewCollection(prev => ({
      ...prev,
      rules: prev.rules.map(rule =>
        rule.id === ruleId ? { ...rule, [field]: value } : rule
      )
    }));
  };

  const removeRule = (ruleId: string) => {
    setNewCollection(prev => ({
      ...prev,
      rules: prev.rules.filter(rule => rule.id !== ruleId)
    }));
  };

  const createCollection = async () => {
    if (!newCollection.name.trim()) {
      toast({
        title: "Error",
        description: "Collection name is required.",
        variant: "destructive"
      });
      return;
    }

    try {
      const response = await fetch('/api/smart-collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newCollection,
          type: 'auto'
        })
      });

      if (response.ok) {
        await loadCollections();
        setIsCreating(false);
        setNewCollection({
          name: '',
          description: '',
          icon: 'Camera',
          color: 'blue',
          rules: []
        });
        toast({
          title: "Collection Created",
          description: "Smart collection has been created successfully!"
        });
      }
    } catch (error) {
      console.error('Failed to create collection:', error);
      toast({
        title: "Error",
        description: "Failed to create collection.",
        variant: "destructive"
      });
    }
  };

  const IconComponent = ({ iconName }: { iconName: string }) => {
    const Icon = COLLECTION_ICONS[iconName as keyof typeof COLLECTION_ICONS] || Camera;
    return <Icon className="h-4 w-4" />;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Smart Collections</h1>
          <p className="text-muted-foreground">Automatically organize your photos with AI-powered collections</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={organizePhotos} 
            disabled={isProcessing}
            variant="outline"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isProcessing ? 'animate-spin' : ''}`} />
            Reorganize Photos
          </Button>
          <Dialog open={isCreating} onOpenChange={setIsCreating}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Collection
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Smart Collection</DialogTitle>
                <DialogDescription>
                  Define rules to automatically organize photos into this collection
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Collection Name</Label>
                    <Input
                      id="name"
                      value={newCollection.name}
                      onChange={(e) => setNewCollection(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Enter collection name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="icon">Icon</Label>
                    <Select value={newCollection.icon} onValueChange={(value) => setNewCollection(prev => ({ ...prev, icon: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.keys(COLLECTION_ICONS).map(iconName => (
                          <SelectItem key={iconName} value={iconName}>
                            <div className="flex items-center gap-2">
                              <IconComponent iconName={iconName} />
                              {iconName}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={newCollection.description}
                    onChange={(e) => setNewCollection(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe what photos should be included"
                  />
                </div>

                <div>
                  <Label>Collection Rules</Label>
                  <div className="space-y-2 mt-2">
                    {newCollection.rules.map((rule) => (
                      <div key={rule.id} className="flex items-center gap-2 p-2 border rounded">
                        <Select value={rule.field} onValueChange={(value) => updateRule(rule.id, 'field', value)}>
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="aiTags">AI Tags</SelectItem>
                            <SelectItem value="eventType">Event Type</SelectItem>
                            <SelectItem value="location">Location</SelectItem>
                            <SelectItem value="faceCount">Face Count</SelectItem>
                            <SelectItem value="personAge">Person Age</SelectItem>
                          </SelectContent>
                        </Select>

                        <Select value={rule.operator} onValueChange={(value) => updateRule(rule.id, 'operator', value)}>
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="contains">Contains</SelectItem>
                            <SelectItem value="equals">Equals</SelectItem>
                            <SelectItem value=">=">Greater or Equal</SelectItem>
                            <SelectItem value="<=">Less or Equal</SelectItem>
                            <SelectItem value="time_range">Time Range</SelectItem>
                          </SelectContent>
                        </Select>

                        <Input
                          value={rule.value}
                          onChange={(e) => updateRule(rule.id, 'value', e.target.value)}
                          placeholder="Value"
                          className="flex-1"
                        />

                        <Input
                          type="number"
                          min="1"
                          max="5"
                          value={rule.weight}
                          onChange={(e) => updateRule(rule.id, 'weight', parseInt(e.target.value))}
                          className="w-16"
                          title="Weight (1-5)"
                        />

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeRule(rule.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}

                    <Button variant="outline" onClick={addRule} className="w-full">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Rule
                    </Button>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsCreating(false)}>
                    Cancel
                  </Button>
                  <Button onClick={createCollection}>
                    Create Collection
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="setup">Quick Setup</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {collections.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Wand2 className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Smart Collections Yet</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Create smart collections to automatically organize your photos based on AI analysis
                </p>
                <Button onClick={() => setActiveTab('setup')}>
                  Get Started
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {collections.map((collection) => (
                <Card key={collection.id} className="relative">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-lg bg-${collection.color}-100 text-${collection.color}-600`}>
                          <IconComponent iconName={collection.icon} />
                        </div>
                        <div>
                          <CardTitle className="text-sm">{collection.name}</CardTitle>
                          <Badge variant="secondary" className="text-xs">
                            {collection.photoCount} photos
                          </Badge>
                        </div>
                      </div>
                      <Switch
                        checked={collection.isActive}
                        onCheckedChange={(checked) => toggleCollection(collection.id, checked)}
                      />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-3">
                      {collection.description}
                    </p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Updated {new Date(collection.lastUpdated).toLocaleDateString()}</span>
                      <Button variant="ghost" size="sm">
                        <Eye className="h-3 w-3 mr-1" />
                        View
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="setup" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Quick Setup</CardTitle>
              <CardDescription>
                Start with our predefined smart collections, perfect for family photo organization
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {PREDEFINED_COLLECTIONS.map((template, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
                    <div className={`p-2 rounded-lg bg-${template.color}-100 text-${template.color}-600`}>
                      <IconComponent iconName={template.icon} />
                    </div>
                    <div>
                      <h4 className="font-medium">{template.name}</h4>
                      <p className="text-sm text-muted-foreground">{template.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              <Button 
                onClick={createPredefinedCollections}
                disabled={isProcessing}
                className="w-full"
              >
                <Wand2 className={`h-4 w-4 mr-2 ${isProcessing ? 'animate-spin' : ''}`} />
                {isProcessing ? 'Creating Collections...' : 'Create All Smart Collections'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Auto-Organization Settings</CardTitle>
              <CardDescription>
                Configure how smart collections automatically organize your photos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="auto-organize">Automatic Organization</Label>
                <Switch id="auto-organize" defaultChecked />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="real-time">Real-time Processing</Label>
                <Switch id="real-time" defaultChecked />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="confidence-threshold">Minimum Confidence Threshold</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">70%</span>
                  <Progress value={70} className="w-24" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default SmartCollections;