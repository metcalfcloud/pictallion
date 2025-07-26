import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
  Sparkles
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

  return (
    <>
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">People & Faces</h2>
            <p className="text-sm text-gray-500">Manage face detection and organize photos by people</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
              <Button
                variant={viewMode === 'people' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('people')}
              >
                <Users className="w-4 h-4 mr-2" />
                People
              </Button>
              <Button
                variant={viewMode === 'faces' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('faces')}
              >
                <Eye className="w-4 h-4 mr-2" />
                Faces
              </Button>
              <Button
                variant={viewMode === 'suggestions' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('suggestions')}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Suggestions
              </Button>
            </div>
            <Dialog open={isCreatePersonOpen} onOpenChange={setIsCreatePersonOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add Person
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Person</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="personName">Name</Label>
                    <Input
                      id="personName"
                      value={newPersonName}
                      onChange={(e) => setNewPersonName(e.target.value)}
                      placeholder="Enter person's name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="personNotes">Notes (optional)</Label>
                    <Textarea
                      id="personNotes"
                      value={newPersonNotes}
                      onChange={(e) => setNewPersonNotes(e.target.value)}
                      placeholder="Add any notes about this person"
                    />
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setIsCreatePersonOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={() => createPersonMutation.mutate({ 
                        name: newPersonName, 
                        notes: newPersonNotes || undefined 
                      })}
                      disabled={!newPersonName.trim() || createPersonMutation.isPending}
                    >
                      Create Person
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 p-6 overflow-y-auto">
        {/* Show search/filters only for people and faces views */}
        {viewMode !== 'suggestions' && (
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder={viewMode === 'people' ? "Search people..." : "Search faces..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-80"
                />
              </div>
            {viewMode === 'faces' && (
              <>
                <Select value={selectedPerson || 'all'} onValueChange={(value) => setSelectedPerson(value === 'all' ? null : value)}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by person" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All People</SelectItem>
                    {people.map((person) => (
                      <SelectItem key={person.id} value={person.id}>
                        {person.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant={filterUnassigned ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterUnassigned(!filterUnassigned)}
                >
                  <Filter className="w-4 h-4 mr-2" />
                  Unassigned Only
                </Button>
              </>
            )}
            </div>
            
            {selectedFaces.length > 0 && (
              <div className="flex items-center space-x-2">
                <Badge variant="secondary">{selectedFaces.length} faces selected</Badge>
                <Select onValueChange={handleAssignFaces}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Assign to person..." />
                  </SelectTrigger>
                  <SelectContent>
                    {people.map((person) => (
                      <SelectItem key={person.id} value={person.id}>
                        {person.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedFaces([])}
                >
                  Clear Selection
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Face Suggestions View */}
        {viewMode === 'suggestions' && <FaceSuggestions />}

        {/* People View */}
        {viewMode === 'people' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredPeople.map((person) => (
              <Card key={person.id} className="cursor-pointer hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{person.name}</CardTitle>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle>Manage {person.name}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3">
                          <Button
                            variant="outline"
                            className="w-full justify-start"
                            onClick={() => {
                              setSelectedPerson(person.id);
                              setIsViewPhotosOpen(true);
                            }}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            View Photos ({person.photoCount || 0})
                          </Button>
                          <Button
                            variant="outline"
                            className="w-full justify-start"
                            onClick={() => {
                              setEditingPerson(person);
                              setNewPersonName(person.name);
                              setNewPersonNotes(person.notes || '');
                              setIsEditPersonOpen(true);
                            }}
                          >
                            <Edit className="w-4 h-4 mr-2" />
                            Edit Details
                          </Button>
                          <Button
                            variant="destructive"
                            className="w-full justify-start"
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete ${person.name}? This will unassign all their faces.`)) {
                                deletePersonMutation.mutate(person.id);
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete Person
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {person.coverPhoto && (
                      <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                        <img
                          src={`/api/files/${person.coverPhoto}`}
                          alt={person.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <span className="flex items-center">
                        <Eye className="w-4 h-4 mr-1" />
                        {person.faceCount || 0} faces
                      </span>
                      <span className="flex items-center">
                        <Camera className="w-4 h-4 mr-1" />
                        {person.photoCount || 0} photos
                      </span>
                    </div>
                    {person.notes && (
                      <p className="text-sm text-gray-600 truncate">{person.notes}</p>
                    )}
                    <div className="flex items-center space-x-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="flex-1"
                        onClick={() => {
                          setSelectedPerson(person.id);
                          setIsViewPhotosOpen(true);
                        }}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View Photos
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
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Faces View */}
        {viewMode === 'faces' && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
            {filteredFaces.map((face) => (
              <Card 
                key={face.id} 
                className={`cursor-pointer transition-all ${
                  selectedFaces.includes(face.id) 
                    ? 'ring-2 ring-primary shadow-lg' 
                    : 'hover:shadow-md'
                }`}
                onClick={() => handleFaceSelection(face.id)}
              >
                <CardContent className="p-3">
                  <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 mb-2 relative">
                    {face.faceCropUrl ? (
                      <img
                        src={`/api/files/${face.faceCropUrl}`}
                        alt="Detected face"
                        className="w-full h-full object-cover"
                      />
                    ) : face.photo ? (
                      <img
                        src={`/api/files/${face.photo.filePath}`}
                        alt="Detected face"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <User className="w-8 h-8" />
                      </div>
                    )}
                    <div className="absolute top-2 left-2">
                      {selectedFaces.includes(face.id) ? (
                        <CheckSquare className="w-4 h-4 text-primary bg-white rounded" />
                      ) : (
                        <Square className="w-4 h-4 text-gray-400 bg-white rounded" />
                      )}
                    </div>
                    <div className="absolute top-2 right-2">
                      <Badge variant="secondary" className="text-xs">
                        {Math.round(face.confidence)}%
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">
                        {face.personId ? (
                          <span className="flex items-center text-green-600">
                            <User className="w-3 h-3 mr-1" />
                            Assigned
                          </span>
                        ) : (
                          <span className="text-gray-500">Unassigned</span>
                        )}
                      </span>
                    </div>
                    {face.photo && (
                      <p className="text-xs text-gray-600 truncate">
                        {face.photo.mediaAsset.originalFilename}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty States */}
        {viewMode === 'people' && filteredPeople.length === 0 && !peopleLoading && (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No people found</h3>
            <p className="text-gray-600 mb-4">
              {searchQuery ? 'No people match your search.' : 'Start by creating your first person.'}
            </p>
            <Button onClick={() => setIsCreatePersonOpen(true)}>
              <UserPlus className="w-4 h-4 mr-2" />
              Add First Person
            </Button>
          </div>
        )}

        {viewMode === 'faces' && filteredFaces.length === 0 && !facesLoading && (
          <div className="text-center py-12">
            <Eye className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No faces found</h3>
            <p className="text-gray-600">
              {filterUnassigned ? 'No unassigned faces found.' : 'No faces detected yet. Upload photos to start face detection.'}
            </p>
          </div>
        )}
      </div>

      {/* Edit Person Dialog */}
      <Dialog open={isEditPersonOpen} onOpenChange={setIsEditPersonOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Person</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="editPersonName">Name</Label>
              <Input
                id="editPersonName"
                value={newPersonName}
                onChange={(e) => setNewPersonName(e.target.value)}
                placeholder="Enter person's name"
              />
            </div>
            <div>
              <Label htmlFor="editPersonNotes">Notes (optional)</Label>
              <Textarea
                id="editPersonNotes"
                value={newPersonNotes}
                onChange={(e) => setNewPersonNotes(e.target.value)}
                placeholder="Add any notes about this person"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsEditPersonOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => {
                  if (editingPerson) {
                    updatePersonMutation.mutate({ 
                      id: editingPerson.id,
                      data: { name: newPersonName, notes: newPersonNotes || undefined }
                    });
                  }
                }}
                disabled={!newPersonName.trim() || updatePersonMutation.isPending}
              >
                Update Person
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Photos Dialog */}
      <Dialog open={isViewPhotosOpen} onOpenChange={setIsViewPhotosOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              Photos of {people.find(p => p.id === selectedPerson)?.name || 'Person'}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            {personPhotosLoading ? (
              <div className="text-center py-8">Loading photos...</div>
            ) : personPhotos.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {personPhotos.map((photo) => (
                  <div key={photo.id} className="aspect-square rounded-lg overflow-hidden">
                    <img
                      src={`/api/files/${photo.filePath}`}
                      alt={photo.mediaAsset?.originalFilename || 'Photo'}
                      className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => {
                        // You can add photo detail modal functionality here
                        console.log('Open photo detail for:', photo);
                      }}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Camera className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">No photos found for this person.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}