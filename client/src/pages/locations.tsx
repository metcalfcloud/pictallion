import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import {
  MapPin,
  Plus,
  Clock,
  TrendingUp,
  Camera,
  Map,
  Edit2,
  Trash2,
  MoreVertical,
} from 'lucide-react';
import LocationMap from '@/components/LocationMap';
import LocationTimeline from '@/components/LocationTimeline';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Location } from '@shared/schema';

interface LocationHotspot {
  latitude: number;
  longitude: number;
  photoCount: number;
  photos: any[];
  suggestedName?: string;
}

interface LocationStats {
  totalLocations: number;
  totalPhotosWithLocation: number;
  topLocations: Location[];
  recentLocations: Location[];
  hotspots: LocationHotspot[];
}

// Form schemas
const editLocationSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
});

type EditLocationFormData = z.infer<typeof editLocationSchema>;

export default function Locations() {
  const { toast } = useToast();
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [newLocationName, setNewLocationName] = useState('');
  const [newLocationDescription, setNewLocationDescription] = useState('');
  const [selectedHotspot, setSelectedHotspot] = useState<LocationHotspot | null>(null);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [deletingLocation, setDeletingLocation] = useState<Location | null>(null);

  // Form for editing locations
  const editForm = useForm<EditLocationFormData>({
    resolver: zodResolver(editLocationSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  // Update form when editing location changes
  useEffect(() => {
    if (editingLocation) {
      editForm.reset({
        name: editingLocation.name,
        description: editingLocation.description || '',
      });
    }
  }, [editingLocation, editForm]);

  // Fetch location statistics and hotspots
  const { data: locationStats, isLoading } = useQuery<LocationStats>({
    queryKey: ['/api/locations/stats'],
  });

  // Fetch all locations
  const { data: locations = [] } = useQuery<Location[]>({
    queryKey: ['/api/locations'],
  });

  // Create location mutation
  const createLocationMutation = useMutation({
    mutationFn: (locationData: any) => {
      return fetch('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(locationData),
      }).then((res) => res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/locations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/locations/stats'] });
      toast({
        title: 'Location Created',
        description: 'New location has been added successfully.',
      });
      setNewLocationName('');
      setNewLocationDescription('');
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Edit location mutation
  const editLocationMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Partial<Location> }) => {
      const response = await fetch(`/api/locations/${data.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data.updates),
      });
      if (!response.ok) throw new Error('Failed to update location');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/locations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/locations/stats'] });
      setEditingLocation(null);
      toast({
        title: 'Success',
        description: 'Location updated successfully',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update location',
        variant: 'destructive',
      });
    },
  });

  // Delete location mutation
  const deleteLocationMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/locations/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete location');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/locations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/locations/stats'] });
      setDeletingLocation(null);
      toast({
        title: 'Success',
        description: 'Location deleted successfully',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete location',
        variant: 'destructive',
      });
    },
  });

  const handleEditLocation = (data: EditLocationFormData) => {
    if (!editingLocation) return;
    editLocationMutation.mutate({
      id: editingLocation.id,
      updates: data,
    });
  };

  const handleDeleteLocation = () => {
    if (!deletingLocation) return;
    deleteLocationMutation.mutate(deletingLocation.id);
  };

  // Create location from hotspot
  const createFromHotspot = (hotspot: LocationHotspot) => {
    if (!newLocationName.trim()) {
      toast({
        title: 'Name Required',
        description: 'Please enter a name for this location.',
        variant: 'destructive',
      });
      return;
    }

    createLocationMutation.mutate({
      name: newLocationName,
      description: newLocationDescription,
      latitude: hotspot.latitude.toString(),
      longitude: hotspot.longitude.toString(),
      isUserDefined: true,
      photoCount: hotspot.photoCount,
    });
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Locations</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-muted rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-muted rounded"></div>
                  <div className="h-3 bg-muted rounded w-3/4"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Locations</h1>
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Location
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Location</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Location Name</Label>
                <Input
                  id="name"
                  value={newLocationName}
                  onChange={(e) => setNewLocationName(e.target.value)}
                  placeholder="Home, Work, Grandma's House..."
                />
              </div>
              <div>
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  value={newLocationDescription}
                  onChange={(e) => setNewLocationDescription(e.target.value)}
                  placeholder="Additional details about this location..."
                />
              </div>
              <Button
                onClick={() => {
                  // For manual entry, we'd need coordinate inputs too
                  // For now, focus on hotspot conversion
                }}
                disabled={!newLocationName.trim()}
              >
                Create Location
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Location Stats Cards */}
      {locationStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <MapPin className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Locations</p>
                  <p className="text-2xl font-bold">{locationStats.totalLocations}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Camera className="w-5 h-5 text-green-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Photos with Location</p>
                  <p className="text-2xl font-bold">
                    {locationStats.totalPhotosWithLocation}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-5 h-5 text-orange-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Hotspots Found</p>
                  <p className="text-2xl font-bold">
                    {locationStats.hotspots?.length || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Map className="w-5 h-5 text-purple-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Coverage</p>
                  <p className="text-2xl font-bold">
                    {locationStats.totalPhotosWithLocation > 0
                      ? Math.round(
                          (locationStats.totalPhotosWithLocation /
                            (locationStats.totalPhotosWithLocation + 100)) *
                            100,
                        )
                      : 0}
                    %
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="locations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="locations">Named Locations</TabsTrigger>
          <TabsTrigger value="hotspots">Photo Hotspots</TabsTrigger>
          <TabsTrigger value="map">Map View</TabsTrigger>
          <TabsTrigger value="timeline">Location Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="locations">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {locations.map((location) => (
              <Card key={location.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center space-x-2">
                      <MapPin className="w-4 h-4" />
                      <span>{location.name}</span>
                    </span>
                    <div className="flex items-center space-x-2">
                      <Badge variant={location.isUserDefined ? 'default' : 'secondary'}>
                        {location.isUserDefined ? 'Custom' : 'Auto'}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => setEditingLocation(location)}
                          >
                            <Edit2 className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeletingLocation(location)}
                            className="text-red-600"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {location.description && (
                    <p className="text-sm text-muted-foreground mb-2">
                      {location.description}
                    </p>
                  )}
                  {location.placeName && (
                    <p className="text-sm text-blue-600 dark:text-blue-400 mb-2">
                      {location.placeName}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {location.latitude}, {location.longitude}
                    </span>
                    <Badge variant="outline">{location.photoCount} photos</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="hotspots">
          <Card>
            <CardHeader>
              <CardTitle>Photo Hotspots</CardTitle>
              <p className="text-sm text-muted-foreground">
                Locations with multiple photos that could be given friendly names
              </p>
            </CardHeader>
            <CardContent>
              {locationStats?.hotspots?.length ? (
                <div className="space-y-4">
                  {locationStats.hotspots.map((hotspot, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <MapPin className="w-4 h-4 text-orange-500" />
                          <span className="font-medium">Hotspot {index + 1}</span>
                          <Badge>{hotspot.photoCount} photos</Badge>
                        </div>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="outline">
                              Name This Location
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Name This Location</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label>Coordinates</Label>
                                <p className="text-sm text-muted-foreground">
                                  {hotspot.latitude.toFixed(6)},{' '}
                                  {hotspot.longitude.toFixed(6)}
                                </p>
                              </div>
                              <div>
                                <Label>Photos at this location</Label>
                                <p className="text-sm text-muted-foreground">
                                  {hotspot.photoCount} photos
                                </p>
                              </div>
                              <div>
                                <Label htmlFor="hotspot-name">Location Name</Label>
                                <Input
                                  id="hotspot-name"
                                  value={newLocationName}
                                  onChange={(e) => setNewLocationName(e.target.value)}
                                  placeholder="Home, Work, Grandma's House..."
                                />
                              </div>
                              <div>
                                <Label htmlFor="hotspot-description">
                                  Description (Optional)
                                </Label>
                                <Textarea
                                  id="hotspot-description"
                                  value={newLocationDescription}
                                  onChange={(e) =>
                                    setNewLocationDescription(e.target.value)
                                  }
                                  placeholder="Additional details..."
                                />
                              </div>
                              <Button
                                onClick={() => createFromHotspot(hotspot)}
                                disabled={
                                  !newLocationName.trim() ||
                                  createLocationMutation.isPending
                                }
                              >
                                Create Location
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {hotspot.latitude.toFixed(6)}, {hotspot.longitude.toFixed(6)}
                      </p>
                      {hotspot.suggestedName && (
                        <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                          Suggested: {hotspot.suggestedName}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <MapPin className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Hotspots Found</h3>
                  <p className="text-muted-foreground">
                    No location clusters found. Upload more photos with GPS data to
                    discover patterns.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="map">
          <Card>
            <CardHeader>
              <CardTitle>Map View</CardTitle>
              <p className="text-sm text-muted-foreground">
                Interactive map showing all your photo locations
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-96 bg-muted rounded-lg overflow-hidden">
                <LocationMap
                  locations={locations}
                  hotspots={locationStats?.hotspots || []}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <CardTitle>Location Timeline</CardTitle>
              <p className="text-sm text-muted-foreground">
                See how your location visits change over time
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-96">
                <LocationTimeline locations={locations} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Location Dialog */}
      <Dialog open={!!editingLocation} onOpenChange={() => setEditingLocation(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Location</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form
              onSubmit={editForm.handleSubmit(handleEditLocation)}
              className="space-y-4"
            >
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter location name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Enter description" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingLocation(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={editLocationMutation.isPending}>
                  {editLocationMutation.isPending ? 'Updating...' : 'Update Location'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Location Dialog */}
      <Dialog open={!!deletingLocation} onOpenChange={() => setDeletingLocation(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Location</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-4">
            Are you sure you want to delete "{deletingLocation?.name}"? This action
            cannot be undone. The photos will remain but will no longer be associated
            with this location.
          </p>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setDeletingLocation(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteLocation}
              disabled={deleteLocationMutation.isPending}
            >
              {deleteLocationMutation.isPending ? 'Deleting...' : 'Delete Location'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
