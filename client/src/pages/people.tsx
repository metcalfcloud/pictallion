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
    mutationFn: ({ personId, faceId }: { personId: string; faceId: string }) => 
      apiRequest('PUT', `/api/people/${personId}/thumbnail`, { faceId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/people"] });
      setIsSelectThumbnailOpen(false);
      toast({
        title: "Success",
        description: "Thumbnail updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update thumbnail",
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

  return (
    <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">People</h1>
      

      {/* Header */}
      

      {/* Content */}
      
        {/* Show search/filters only for people and faces views */}
        

        {/* Face Suggestions View */}
        

        {/* People View */}
        

        {/* Faces View */}
        

        {/* Empty States */}
        

        
          
            
            
              
                
                  
                  
                  
                  
                    
                    
                      
                      
                    
                  
                
              
            
          
        
      

      {/* Edit Person Dialog */}
      
        
          
            
              
                
                  
                
              
            
              
                
                  
                
              
            
              
                
                  
                
              
            
            
              
                
              
              
                
                    
                      
                      
                    
                  
                
                
                  
                    Update Person
                  
                
              
            
          
        
      

      {/* View Photos Dialog */}
      
        
          
            
              
                Photos of {people.find(p => p.id === selectedPerson)?.name || 'Person'}
              
            
              
                View all photos containing this person's face.
              
            
          
            
                Loading photos...
              
                 
                    
                      
                        
                          
                            
                              
                                // You can add photo detail modal functionality here
                                console.log('Open photo detail for:', photo);
                              
                            
                          
                        
                      
                    
                  
                
              
              
                
                  
                    
                      
                      
                    
                    No photos found for this person.
                  
                
              
            
          
        
      

      {/* Select Thumbnail Dialog */}
      
        
          
            
              
                Select Thumbnail for {people.find(p => p.id === selectedPerson)?.name || 'Person'}
              
            
              
                Choose which face photo to use as the thumbnail for this person.
              
            
          
            
              
                 
                    
                      
                        
                          
                            
                              
                                
                                  
                                    
                                      
                                    
                                  
                                
                              
                            
                          
                        
                      
                    
                  
                
              
            
          
        
      
    
  );
}