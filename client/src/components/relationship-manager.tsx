import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Users, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface Person {
  id: string;
  name: string;
  notes?: string;
  birthdate?: string;
}

interface Relationship {
  id: string;
  person1Id: string;
  person2Id: string;
  relationshipType: "spouse" | "partner" | "sibling" | "parent" | "child" | "friend" | "relative";
  notes?: string;
  createdAt: string;
  person1?: Person;
  person2?: Person;
}

interface RelationshipManagerProps {
  personId: string;
  personName: string;
}

const RELATIONSHIP_TYPES = [
  { value: "spouse", label: "Spouse of" },
  { value: "partner", label: "Partner of" },
  { value: "sibling", label: "Sibling of" },
  { value: "parent", label: "Parent of" },
  { value: "child", label: "Child of" },
  { value: "friend", label: "Friend of" },
  { value: "relative", label: "Other Relative of" },
];

const getRelationshipDisplayText = (
  relationship: Relationship, 
  currentPersonId: string
): { label: string; otherPerson: Person | undefined } => {
  const isCurrentPersonPerson1 = relationship.person1Id === currentPersonId;
  const otherPerson = isCurrentPersonPerson1 ? relationship.person2 : relationship.person1;
  
  // Get the relationship type from the current person's perspective with directional clarity
  let relationshipLabel = relationship.relationshipType;
  
  // For parent/child relationships, we need to invert if the current person is person2
  if (relationship.relationshipType === "parent" && !isCurrentPersonPerson1) {
    relationshipLabel = "child";
  } else if (relationship.relationshipType === "child" && !isCurrentPersonPerson1) {
    relationshipLabel = "parent";
  }
  
  // Add directional "of" to make it clear
  const labelMap: Record<string, string> = {
    spouse: "Spouse of",
    partner: "Partner of", 
    sibling: "Sibling of",
    parent: "Parent of",
    child: "Child of",
    friend: "Friend of",
    relative: "Other Relative of"
  };
  
  return {
    label: labelMap[relationshipLabel] || relationshipLabel,
    otherPerson
  };
};

export function RelationshipManager({ personId, personName }: RelationshipManagerProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedPersonId, setSelectedPersonId] = useState<string>("");
  const [relationshipType, setRelationshipType] = useState<string>("");
  const [relationshipNotes, setRelationshipNotes] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch relationships for this person
  const { data: relationships = [], isLoading: relationshipsLoading } = useQuery<Relationship[]>({
    queryKey: [`/api/people/${personId}/relationships`],
  });

  // Fetch all people for selection
  const { data: allPeople = [], isLoading: peopleLoading } = useQuery<Person[]>({
    queryKey: ["/api/people"],
  });

  // Create relationship mutation
  const createRelationshipMutation = useMutation({
    mutationFn: async (data: { person1Id: string; person2Id: string; relationshipType: string; notes?: string }) => {
      return await apiRequest('POST', '/api/relationships', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/people/${personId}/relationships`] });
      toast({ title: "Relationship added successfully" });
      setIsAddDialogOpen(false);
      setSelectedPersonId("");
      setRelationshipType("");
      setRelationshipNotes("");
    },
    onError: () => {
      toast({ title: "Failed to add relationship", variant: "destructive" });
    }
  });

  // Delete relationship mutation
  const deleteRelationshipMutation = useMutation({
    mutationFn: async (relationshipId: string) => {
      return await apiRequest('DELETE', `/api/relationships/${relationshipId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/people/${personId}/relationships`] });
      toast({ title: "Relationship removed successfully" });
    },
    onError: () => {
      toast({ title: "Failed to remove relationship", variant: "destructive" });
    }
  });

  const handleAddRelationship = () => {
    if (!selectedPersonId || !relationshipType) {
      toast({ title: "Please select a person and relationship type", variant: "destructive" });
      return;
    }

    createRelationshipMutation.mutate({
      person1Id: personId,
      person2Id: selectedPersonId,
      relationshipType,
      notes: relationshipNotes.trim() || undefined,
    });
  };

  // Filter people for selection (exclude current person and existing relationships)
  const existingRelationshipPersonIds = new Set(
    relationships.map((rel: Relationship) => 
      rel.person1Id === personId ? rel.person2Id : rel.person1Id
    )
  );

  const availablePeople = allPeople.filter((person: Person) => 
    person.id !== personId && 
    !existingRelationshipPersonIds.has(person.id) &&
    person.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (relationshipsLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="w-5 h-5" />
            <span>Relationships</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">Loading relationships...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5" />
              <span>Relationships</span>
            </div>
            <Button
              onClick={() => setIsAddDialogOpen(true)}
              size="sm"
              className="flex items-center space-x-1"
            >
              <Plus className="w-4 h-4" />
              <span>Add</span>
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {relationships.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No relationships added yet</p>
              <p className="text-sm">Click "Add" to create family connections</p>
            </div>
          ) : (
            <div className="space-y-3">
              {relationships.map((relationship: Relationship) => {
                const { label, otherPerson } = getRelationshipDisplayText(relationship, personId);
                return (
                  <div key={relationship.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <Badge variant="secondary" className="capitalize">
                          {label}
                        </Badge>
                        <span className="font-medium">{otherPerson?.name || "Unknown Person"}</span>
                      </div>
                      {relationship.notes && (
                        <p className="text-sm text-muted-foreground mt-1">{relationship.notes}</p>
                      )}
                    </div>
                    <Button
                      onClick={() => deleteRelationshipMutation.mutate(relationship.id)}
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-700"
                      disabled={deleteRelationshipMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Relationship Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Relationship</DialogTitle>
            <DialogDescription>
              Define how {personName} is related to another person. For example, selecting "Parent of" means {personName} is the parent of the selected person.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="relationship-type">Relationship Type</Label>
              <Select value={relationshipType} onValueChange={setRelationshipType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select relationship type" />
                </SelectTrigger>
                <SelectContent>
                  {RELATIONSHIP_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="person-search">Select Person</Label>
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search people..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                
                <div className="max-h-48 overflow-y-auto border rounded-md">
                  {peopleLoading ? (
                    <div className="p-4 text-center text-muted-foreground">Loading people...</div>
                  ) : availablePeople.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground">
                      {searchQuery ? "No people match your search" : "No available people to add"}
                    </div>
                  ) : (
                    availablePeople.map((person: Person) => (
                      <div
                        key={person.id}
                        className={`p-3 cursor-pointer hover:bg-muted border-b last:border-b-0 ${
                          selectedPersonId === person.id ? "bg-accent" : ""
                        }`}
                        onClick={() => setSelectedPersonId(person.id)}
                      >
                        <div className="font-medium">{person.name}</div>
                        {person.notes && (
                          <div className="text-sm text-muted-foreground">{person.notes}</div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="relationship-notes">Notes (optional)</Label>
              <Textarea
                id="relationship-notes"
                placeholder="Add any notes about this relationship"
                value={relationshipNotes}
                onChange={(e) => setRelationshipNotes(e.target.value)}
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsAddDialogOpen(false);
                  setSelectedPersonId("");
                  setRelationshipType("");
                  setRelationshipNotes("");
                  setSearchQuery("");
                }}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleAddRelationship}
                disabled={!selectedPersonId || !relationshipType || createRelationshipMutation.isPending}
              >
                {createRelationshipMutation.isPending ? 'Adding...' : 'Add Relationship'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}