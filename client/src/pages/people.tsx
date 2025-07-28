import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Users, 
  Search, 
  UserPlus, 
  Eye, 
  Edit, 
  Merge, 
  Trash2, 
  Filter,
  Grid,
  List,
  CheckSquare,
  Square,
  MoreHorizontal,
  Camera,
  Calendar,
  Tag,
  User,
  Sparkles,
  Image
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { FaceSuggestions } from "@/components/face-suggestions";

interface Person {
  id: string;
  name: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  faceCount?: number;
  photoCount?: number;
  coverPhoto?: string;
  selectedThumbnailFaceId?: string;
}

interface Face {
  id: string;
  photoId: string;
  personId?: string;
  boundingBox: [number, number, number, number]; // [x, y, width, height]
  confidence: number;
  embedding?: number[];
  createdAt: string;
  faceCropUrl?: string; // URL to cropped face image
  photo?: {
    filePath: string;
    mediaAsset: {
      originalFilename: string;
    };
  };
}

export default function PeoplePage() {
  const [viewMode, setViewMode] = useState<'people' | 'faces' | 'suggestions'>('people');
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
  const [selectedFaces, setSelectedFaces] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterUnassigned, setFilterUnassigned] = useState(false);
  const [isCreatePersonOpen, setIsCreatePersonOpen] = useState(false);
  const [isMergeFacesOpen, setIsMergeFacesOpen] = useState(false);
  const [isEditPersonOpen, setIsEditPersonOpen] = useState(false);
  const [isViewPhotosOpen, setIsViewPhotosOpen] = useState(false);
  const [isSelectThumbnailOpen, setIsSelectThumbnailOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonNotes, setNewPersonNotes] = useState('');

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: people = [], isLoading: peopleLoading } = useQuery<Person[]>({
    queryKey: ["/api/people"],
  });

  const { data: faces = [], isLoading: facesLoading } = useQuery<Face[]>({
    queryKey: ["/api/faces"],
  });

  const { data: personPhotos = [], isLoading: personPhotosLoading } = useQuery<any[]>({
    queryKey: ["/api/people", selectedPerson, "photos"],
    enabled: !!selectedPerson,
  });

  // Create person mutation
  const createPersonMutation = useMutation({
    mutationFn: async (personData: { name: string; notes?: string }) => {
      return await apiRequest('POST', '/api/people', personData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/people"] });
      setIsCreatePersonOpen(false);
      setNewPersonName('');
      setNewPersonNotes('');
      toast({ title: "Person created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create person", variant: "destructive" });
    }
  });

  // Update person mutation
  const updatePersonMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string; notes?: string } }) => {
      return await apiRequest('PUT', `/api/people/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/people"] });
      setIsEditPersonOpen(false);
      setEditingPerson(null);
      toast({ title: "Person updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update person", variant: "destructive" });
    }
  });

  // Delete person mutation
  const deletePersonMutation = useMutation({
    mutationFn: async (personId: string) => {
      return await apiRequest('DELETE', `/api/people/${personId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/people"] });
      toast({ title: "Person deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete person", variant: "destructive" });
    }
  });



  const assignFacesToPersonMutation = useMutation({
    mutationFn: async ({ faceIds, personId }: { faceIds: string[]; personId: string }) => {
      const response = await fetch(`/api/faces/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ faceIds, personId }),
      });
      if (!response.ok) throw new Error('Failed to assign faces');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/faces"] });
      queryClient.invalidateQueries({ queryKey: ["/api/people"] });
      setSelectedFaces([]);
      toast({ title: "Faces assigned successfully" });
    },
    onError: () => {
      toast({ title: "Failed to assign faces", variant: "destructive" });
    },
  });

  // Set thumbnail mutation
  const setThumbnailMutation = useMutation({
    mutationFn: async ({ personId, faceId }: { personId: string; faceId: string }) => {
      const response = await fetch(`/api/people/${personId}/thumbnail`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ faceId }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to update thumbnail');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/people"] });
      queryClient.invalidateQueries({ queryKey: ["/api/faces"] });
      toast({
        title: "Success",
        description: "Profile photo updated successfully",
      });
      // Close dialog and clear state
      setIsSelectThumbnailOpen(false);
      setSelectedPerson(null);
      setEditingPerson(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile photo",
        variant: "destructive",
      });
    },
  });

  const filteredPeople = people.filter(person => 
    person.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredFaces = faces.filter(face => {
    if (filterUnassigned && face.personId) return false;
    if (selectedPerson && face.personId !== selectedPerson) return false;
    return true;
  });

  const handleFaceSelection = (faceId: string) => {
    setSelectedFaces(prev => 
      prev.includes(faceId) 
        ? prev.filter(id => id !== faceId)
        : [...prev, faceId]
    );
  };

  const handleAssignFaces = (personId: string) => {
    if (selectedFaces.length > 0) {
      assignFacesToPersonMutation.mutate({ faceIds: selectedFaces, personId });
    }
  };

  const handleCreatePerson = () => {
    if (newPersonName.trim()) {
      createPersonMutation.mutate({
        name: newPersonName.trim(),
        notes: newPersonNotes.trim() || undefined
      });
    }
  };

  const handleEditPerson = () => {
    if (editingPerson && newPersonName.trim()) {
      updatePersonMutation.mutate({
        id: editingPerson.id,
        data: {
          name: newPersonName.trim(),
          notes: newPersonNotes.trim() || undefined
        }
      });
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-background dark:bg-gray-900">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-card-foreground dark:text-white mb-6">People</h1>
        
        {/* Header with view mode tabs */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <Button
              variant={viewMode === 'people' ? 'default' : 'outline'}
              onClick={() => setViewMode('people')}
              className="flex items-center space-x-2"
            >
              <Users className="w-4 h-4" />
              <span>People</span>
            </Button>
            <Button
              variant={viewMode === 'faces' ? 'default' : 'outline'}
              onClick={() => {
                setViewMode('faces');
                setSelectedPerson(null); // Clear person selection when viewing all faces
              }}
              className="flex items-center space-x-2"
            >
              <Image className="w-4 h-4" />
              <span>All Faces</span>
            </Button>
            <Button
              variant={viewMode === 'suggestions' ? 'default' : 'outline'}
              onClick={() => setViewMode('suggestions')}
              className="flex items-center space-x-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>Suggestions</span>
            </Button>
          </div>
          
          {viewMode === 'people' && (
            <Button onClick={() => setIsCreatePersonOpen(true)} className="flex items-center space-x-2">
              <UserPlus className="w-4 h-4" />
              <span>Add Person</span>
            </Button>
          )}
        </div>

        {/* Search and filters for people and faces views */}
        {(viewMode === 'people' || viewMode === 'faces') && (
          <div className="flex items-center space-x-4 mb-6">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={viewMode === 'people' ? "Search people..." : "Search faces..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            {viewMode === 'faces' && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="filter-unassigned"
                  checked={filterUnassigned}
                  onCheckedChange={(checked) => setFilterUnassigned(!!checked)}
                />
                <Label htmlFor="filter-unassigned">Show only unassigned faces</Label>
              </div>
            )}
          </div>
        )}

        {/* Face Suggestions View */}
        {viewMode === 'suggestions' && (
          <FaceSuggestions />
        )}

        {/* People View */}
        {viewMode === 'people' && (
          <div className="space-y-4">
            {peopleLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i} className="h-48 animate-pulse">
                    <CardContent className="p-4">
                      <div className="bg-muted h-24 rounded mb-4"></div>
                      <div className="bg-muted h-4 rounded mb-2"></div>
                      <div className="bg-muted h-3 rounded w-2/3"></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredPeople.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPeople.map((person) => (
                  <Card key={person.id} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-3 mb-3">
                        <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center overflow-hidden">
                          {person.coverPhoto ? (
                            <img
                              src={`/api/files/${person.coverPhoto}`}
                              alt={person.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.nextElementSibling?.classList.remove('hidden');
                              }}
                            />
                          ) : null}
                          <User className={`w-6 h-6 text-muted-foreground ${person.coverPhoto ? 'hidden' : ''}`} />
                        </div>
                        <div>
                          <h3 className="font-semibold text-card-foreground dark:text-white">{person.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {person.faceCount || 0} faces • {person.photoCount || 0} photos
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedPerson(person.id);
                              setIsViewPhotosOpen(true);
                            }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingPerson(person);
                              setNewPersonName(person.name);
                              setNewPersonNotes(person.notes || '');
                              setIsEditPersonOpen(true);
                            }}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingPerson(person);
                            setSelectedPerson(person.id);
                            setIsSelectThumbnailOpen(true);
                          }}
                        >
                          Set Photo
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-card-foreground dark:text-white mb-2">No people found</h3>
                  <p className="text-muted-foreground mb-4">
                    {searchQuery ? `No people match "${searchQuery}"` : 'Start by adding people to organize your photos'}
                  </p>
                  <Button onClick={() => setIsCreatePersonOpen(true)}>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add First Person
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Faces View */}
        {viewMode === 'faces' && (
          <div className="space-y-4">
            {facesLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {Array.from({ length: 24 }).map((_, i) => (
                  <div key={i} className="w-32 h-32 bg-muted rounded animate-pulse"></div>
                ))}
              </div>
            ) : filteredFaces.length > 0 ? (
              <>
                {selectedFaces.length > 0 && (
                  <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                    <span className="text-sm text-blue-700 dark:text-blue-300">
                      {selectedFaces.length} faces selected
                    </span>
                    <div className="flex space-x-2">
                      <Button size="sm" onClick={() => setSelectedFaces([])}>
                        Clear Selection
                      </Button>
                      <Button size="sm" onClick={() => setIsMergeFacesOpen(true)}>
                        <Merge className="w-4 h-4 mr-2" />
                        Assign to Person
                      </Button>
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {filteredFaces.map((face) => (
                    <div
                      key={face.id}
                      className={`relative group cursor-pointer ${
                        selectedFaces.includes(face.id) ? 'ring-2 ring-blue-500' : ''
                      }`}
                      onClick={() => handleFaceSelection(face.id)}
                    >
                      <div className="w-32 h-32 bg-muted rounded overflow-hidden">
                        {face.faceCropUrl ? (
                          <img
                            src={`/api/files/${face.faceCropUrl}`}
                            alt="Face crop"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              // Fallback to user icon if image fails to load
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                        ) : null}
                        <div className={`w-full h-full flex items-center justify-center ${face.faceCropUrl ? 'hidden' : ''}`}>
                          <User className="w-8 h-8 text-gray-400" />
                        </div>
                      </div>
                      
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all rounded"></div>
                      
                      {/* Selection indicator in top-right corner */}
                      <div className="absolute top-2 right-2">
                        {selectedFaces.includes(face.id) ? (
                          <CheckSquare className="w-5 h-5 text-blue-500 bg-white rounded shadow-sm" />
                        ) : (
                          <Square className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 bg-black bg-opacity-50 rounded" />
                        )}
                      </div>
                      
                      {face.personId && (
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <Image className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-card-foreground dark:text-white mb-2">No faces found</h3>
                  <p className="text-muted-foreground mb-4">
                    {filterUnassigned ? 'All faces have been assigned to people' : 'Upload photos with people to see detected faces'}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Create Person Dialog */}
      <Dialog open={isCreatePersonOpen} onOpenChange={setIsCreatePersonOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Person</DialogTitle>
            <DialogDescription>
              Create a new person to organize photos with their faces.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="person-name">Name</Label>
              <Input
                id="person-name"
                placeholder="Enter person's name"
                value={newPersonName}
                onChange={(e) => setNewPersonName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="person-notes">Notes (optional)</Label>
              <Textarea
                id="person-notes"
                placeholder="Add any notes about this person"
                value={newPersonNotes}
                onChange={(e) => setNewPersonNotes(e.target.value)}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsCreatePersonOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreatePerson}
                disabled={!newPersonName.trim() || createPersonMutation.isPending}
              >
                {createPersonMutation.isPending ? 'Creating...' : 'Create Person'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Select Thumbnail Dialog */}
      <Dialog open={isSelectThumbnailOpen} onOpenChange={setIsSelectThumbnailOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              Select Thumbnail for {people.find(p => p.id === selectedPerson)?.name || 'Person'}
            </DialogTitle>
            <DialogDescription>
              Choose which face photo to use as the thumbnail for this person.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-6 gap-4 max-h-96 overflow-y-auto">
            {selectedPerson && (() => {
              const personFaces = faces.filter(face => face.personId === selectedPerson);
              
              if (personFaces.length === 0) {
                return (
                  <div className="text-center text-muted-foreground col-span-6 py-8">
                    No face photos available for this person
                  </div>
                );
              }
              
              return personFaces.map((face) => (
                <div
                  key={face.id}
                  className="relative cursor-pointer group"
                  onClick={() => {
                    setThumbnailMutation.mutate({ 
                      personId: selectedPerson, 
                      faceId: face.id 
                    });
                  }}
                >
                  <div className="w-full aspect-square bg-muted rounded overflow-hidden border-2 border-transparent hover:border-blue-500 transition-colors">
                    {face.faceCropUrl ? (
                      <img
                        src={`/api/files/${face.faceCropUrl}`}
                        alt="Face option"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                    ) : null}
                    <div className={`w-full h-full flex items-center justify-center ${face.faceCropUrl ? 'hidden' : ''}`}>
                      <User className="w-8 h-8 text-muted-foreground" />
                    </div>
                  </div>
                  
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all rounded flex items-center justify-center">
                    <Button
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        setThumbnailMutation.mutate({ 
                          personId: selectedPerson, 
                          faceId: face.id 
                        });
                      }}
                    >
                      Select
                    </Button>
                  </div>
                  
                  <div className="mt-2 text-xs text-center text-muted-foreground">
                    {Math.round(face.confidence)}% confidence
                  </div>
                </div>
              ));
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Person Dialog */}
      <Dialog open={isEditPersonOpen} onOpenChange={setIsEditPersonOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Person</DialogTitle>
            <DialogDescription>
              Update the person's name and notes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-person-name">Name</Label>
              <Input
                id="edit-person-name"
                placeholder="Enter person's name"
                value={newPersonName}
                onChange={(e) => setNewPersonName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="edit-person-notes">Notes (optional)</Label>
              <Textarea
                id="edit-person-notes"
                placeholder="Add any notes about this person"
                value={newPersonNotes}
                onChange={(e) => setNewPersonNotes(e.target.value)}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsEditPersonOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleEditPerson}
                disabled={!newPersonName.trim() || updatePersonMutation.isPending}
              >
                {updatePersonMutation.isPending ? 'Updating...' : 'Update Person'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Photos Dialog */}
      <Dialog open={isViewPhotosOpen} onOpenChange={setIsViewPhotosOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              Photos of {people.find(p => p.id === selectedPerson)?.name || 'Person'}
            </DialogTitle>
            <DialogDescription>
              All photos containing this person's face.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 max-h-96 overflow-y-auto">
            {personPhotosLoading ? (
              Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="aspect-square bg-muted rounded animate-pulse"></div>
              ))
            ) : personPhotos.length > 0 ? (
              personPhotos.map((photo) => (
                <div key={photo.id} className="aspect-square bg-muted rounded overflow-hidden">
                  <img
                    src={`/api/files/${photo.filePath}`}
                    alt={photo.mediaAsset.originalFilename}
                    className="w-full h-full object-cover hover:scale-105 transition-transform cursor-pointer"
                    onClick={() => {
                      // Could open photo detail modal here
                      console.log('Open photo:', photo.id);
                    }}
                  />
                </div>
              ))
            ) : (
              <div className="col-span-full text-center text-muted-foreground py-8">
                No photos found for this person
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}