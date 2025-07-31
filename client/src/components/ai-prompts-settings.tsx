import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Edit3, Trash2, Plus, RotateCcw, Save, X } from "lucide-react";

interface AIPrompt {
  id: string;
  name: string;
  description: string;
  category: "analysis" | "naming" | "description";
  provider: "openai" | "ollama" | "both";
  systemPrompt: string;
  userPrompt: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PromptFormData {
  name: string;
  description: string;
  category: "analysis" | "naming" | "description";
  provider: "openai" | "ollama" | "both";
  systemPrompt: string;
  userPrompt: string;
  isActive: boolean;
}

const CATEGORIES = {
  analysis: "Image Analysis",
  naming: "File Naming", 
  description: "Description Generation"
};

const PROVIDERS = {
  openai: "OpenAI",
  ollama: "Ollama",
  both: "Both Providers"
};

export function AIPromptsSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [editingPrompt, setEditingPrompt] = useState<AIPrompt | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  
  const [formData, setFormData] = useState<PromptFormData>({
    name: "",
    description: "",
    category: "analysis",
    provider: "both",
    systemPrompt: "",
    userPrompt: "",
    isActive: true
  });

  // Fetch all AI prompts
  const { data: prompts = [], isLoading } = useQuery<AIPrompt[]>({
    queryKey: ["/api/ai/prompts"],
  });

  // Fetch default prompts for reference
  const { data: defaultData } = useQuery({
    queryKey: ["/api/ai/prompts/defaults/available"],
  });

  // Create prompt mutation
  const createPromptMutation = useMutation({
    mutationFn: (data: PromptFormData) => fetch("/api/ai/prompts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/prompts"] });
      toast({ title: "Success", description: "AI prompt created successfully" });
      setIsCreating(false);
      resetForm();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create AI prompt",
        variant: "destructive"
      });
    },
  });

  // Update prompt mutation
  const updatePromptMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<PromptFormData> }) => 
      fetch(`/api/ai/prompts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/prompts"] });
      toast({ title: "Success", description: "AI prompt updated successfully" });
      setEditingPrompt(null);
      resetForm();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update AI prompt",
        variant: "destructive"
      });
    },
  });

  // Delete prompt mutation
  const deletePromptMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/ai/prompts/${id}`, {
      method: "DELETE",
    }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/prompts"] });
      toast({ title: "Success", description: "AI prompt deleted successfully" });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete AI prompt",
        variant: "destructive"
      });
    },
  });

  // Reset to defaults mutation
  const resetToDefaultsMutation = useMutation({
    mutationFn: () => fetch("/api/ai/prompts/reset-to-defaults", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/prompts"] });
      toast({ title: "Success", description: "AI prompts reset to defaults successfully" });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to reset AI prompts to defaults",
        variant: "destructive"
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      category: "analysis",
      provider: "both",
      systemPrompt: "",
      userPrompt: "",
      isActive: true
    });
  };

  const startEditing = (prompt: AIPrompt) => {
    setEditingPrompt(prompt);
    setFormData({
      name: prompt.name,
      description: prompt.description,
      category: prompt.category,
      provider: prompt.provider,
      systemPrompt: prompt.systemPrompt,
      userPrompt: prompt.userPrompt,
      isActive: prompt.isActive
    });
    setIsCreating(false);
  };

  const startCreating = () => {
    setIsCreating(true);
    setEditingPrompt(null);
    resetForm();
  };

  const cancelEditing = () => {
    setEditingPrompt(null);
    setIsCreating(false);
    resetForm();
  };

  const handleSave = () => {
    if (editingPrompt) {
      updatePromptMutation.mutate({ id: editingPrompt.id, data: formData });
    } else {
      createPromptMutation.mutate(formData);
    }
  };

  const handleDelete = (id: string) => {
    deletePromptMutation.mutate(id);
  };

  const filteredPrompts = selectedCategory === "all" 
    ? prompts 
    : prompts.filter(p => p.category === selectedCategory);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse space-y-2">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">AI Prompts Management</h3>
          <p className="text-sm text-muted-foreground">
            Customize how AI analyzes and describes your photos. Control the system prompts that guide AI behavior.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={startCreating} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            New Prompt
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm">
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset to Defaults
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset to Default Prompts</AlertDialogTitle>
                <AlertDialogDescription>
                  This will delete all custom prompts and restore the original default prompts. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => resetToDefaultsMutation.mutate()}>
                  Reset to Defaults
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
        <TabsList>
          <TabsTrigger value="all">All Prompts</TabsTrigger>
          <TabsTrigger value="analysis">Image Analysis</TabsTrigger>
          <TabsTrigger value="naming">File Naming</TabsTrigger>
          <TabsTrigger value="description">Description</TabsTrigger>
        </TabsList>

        <TabsContent value={selectedCategory} className="space-y-4">
          {/* Editing/Creating Form */}
          {(editingPrompt || isCreating) && (
            <Card className="border-primary">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {editingPrompt ? "Edit Prompt" : "Create New Prompt"}
                  <Button variant="ghost" size="sm" onClick={cancelEditing}>
                    <X className="h-4 w-4" />
                  </Button>
                </CardTitle>
                <CardDescription>
                  {editingPrompt ? "Modify the prompt settings below" : "Create a new AI prompt for photo analysis"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Family Photo Analyzer"
                    />
                  </div>
                  <div>
                    <Label htmlFor="category">Category</Label>
                    <Select value={formData.category} onValueChange={(value: any) => setFormData(prev => ({ ...prev, category: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="analysis">Image Analysis</SelectItem>
                        <SelectItem value="naming">File Naming</SelectItem>
                        <SelectItem value="description">Description Generation</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="provider">AI Provider</Label>
                    <Select value={formData.provider} onValueChange={(value: any) => setFormData(prev => ({ ...prev, provider: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="openai">OpenAI Only</SelectItem>
                        <SelectItem value="ollama">Ollama Only</SelectItem>
                        <SelectItem value="both">Both Providers</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center space-x-2 pt-6">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={formData.isActive}
                      onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                      className="rounded"
                    />
                    <Label htmlFor="isActive">Active</Label>
                  </div>
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Brief description of what this prompt does"
                  />
                </div>

                <div>
                  <Label htmlFor="systemPrompt">System Prompt</Label>
                  <Textarea
                    id="systemPrompt"
                    value={formData.systemPrompt}
                    onChange={(e) => setFormData(prev => ({ ...prev, systemPrompt: e.target.value }))}
                    placeholder="The main instruction that guides the AI's behavior..."
                    rows={8}
                    className="font-mono text-sm"
                  />
                </div>

                <div>
                  <Label htmlFor="userPrompt">User Prompt</Label>
                  <Textarea
                    id="userPrompt"
                    value={formData.userPrompt}
                    onChange={(e) => setFormData(prev => ({ ...prev, userPrompt: e.target.value }))}
                    placeholder="The specific request sent with each image..."
                    rows={3}
                    className="font-mono text-sm"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={cancelEditing}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave}>
                    <Save className="h-4 w-4 mr-2" />
                    Save Prompt
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Prompts List */}
          <div className="space-y-3">
            {filteredPrompts.map((prompt) => (
              <Card key={prompt.id} className={!prompt.isActive ? "opacity-60" : ""}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        {prompt.name}
                        <Badge variant={prompt.isDefault ? "default" : "secondary"}>
                          {prompt.isDefault ? "Default" : "Custom"}
                        </Badge>
                        <Badge variant="outline">
                          {PROVIDERS[prompt.provider]}
                        </Badge>
                        <Badge variant="secondary">
                          {CATEGORIES[prompt.category]}
                        </Badge>
                        {!prompt.isActive && (
                          <Badge variant="destructive">Inactive</Badge>
                        )}
                      </CardTitle>
                      <CardDescription>{prompt.description}</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEditing(prompt)}
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      {!prompt.isDefault && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Prompt</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{prompt.name}"? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(prompt.id)}>
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">System Prompt Preview</Label>
                      <p className="text-xs bg-muted p-2 rounded font-mono">
                        {prompt.systemPrompt.length > 200 
                          ? prompt.systemPrompt.substring(0, 200) + "..."
                          : prompt.systemPrompt}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">User Prompt</Label>
                      <p className="text-xs bg-muted p-2 rounded font-mono">
                        {prompt.userPrompt}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredPrompts.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No prompts found for this category.</p>
              <Button onClick={startCreating} className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Create First Prompt
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}