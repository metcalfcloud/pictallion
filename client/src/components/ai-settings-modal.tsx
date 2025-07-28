import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Loader2, Settings } from "lucide-react";

interface AIConfig {
  currentProvider: "ollama" | "openai" | "both";
  availableProviders: {
    ollama: boolean;
    openai: boolean;
  };
  config: {
    ollama: {
      baseUrl: string;
      visionModel: string;
      textModel: string;
    };
    openai: {
      model: string;
      hasApiKey: boolean;
    };
  };
}

interface AISettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AISettingsModal({ open, onOpenChange }: AISettingsModalProps) {
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [formData, setFormData] = useState({
    provider: "ollama" as "ollama" | "openai" | "both",
    ollamaBaseUrl: "http://localhost:11434",
    ollamaVisionModel: "llava:latest",
    ollamaTextModel: "llama3.2:latest",
    openaiApiKey: "",
    openaiModel: "gpt-4o"
  });
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadConfig();
    }
  }, [open]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/ai/config");
      const data = await response.json();
      setConfig(data);
      
      // Update form data with current config
      setFormData({
        provider: data.currentProvider,
        ollamaBaseUrl: data.config.ollama.baseUrl,
        ollamaVisionModel: data.config.ollama.visionModel,
        ollamaTextModel: data.config.ollama.textModel,
        openaiApiKey: "",
        openaiModel: data.config.openai.model
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load AI configuration",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const testProviders = async () => {
    try {
      setTesting(true);
      const response = await fetch("/api/ai/test", { method: "POST" });
      const data = await response.json();
      
      // Update the config with fresh status
      setConfig(prev => prev ? {
        ...prev,
        availableProviders: data
      } : null);
      
      toast({
        title: "Provider Test Complete",
        description: `Ollama: ${data.ollama ? "Available" : "Unavailable"}, OpenAI: ${data.openai ? "Available" : "Unavailable"}`
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to test AI providers",
        variant: "destructive"
      });
    } finally {
      setTesting(false);
    }
  };

  const saveConfig = async () => {
    try {
      setLoading(true);
      
      const payload = {
        provider: formData.provider,
        ollama: {
          baseUrl: formData.ollamaBaseUrl,
          visionModel: formData.ollamaVisionModel,
          textModel: formData.ollamaTextModel
        },
        ...(formData.openaiApiKey && {
          openai: {
            apiKey: formData.openaiApiKey,
            model: formData.openaiModel
          }
        })
      };

      const response = await fetch("/api/ai/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "AI configuration updated successfully"
        });
        loadConfig(); // Refresh the config
      } else {
        throw new Error("Failed to save configuration");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save AI configuration",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (!config) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            AI Provider Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Provider Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Provider Status</CardTitle>
              <CardDescription>Current availability of AI providers</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">Ollama (Local)</span>
                {config.availableProviders.ollama ? (
                  <Badge variant="default" className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Available
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200">
                    <XCircle className="h-3 w-3 mr-1" />
                    Unavailable
                  </Badge>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium">OpenAI (Cloud)</span>
                {config.availableProviders.openai ? (
                  <Badge variant="default" className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Available
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200">
                    <XCircle className="h-3 w-3 mr-1" />
                    {config.config.openai.hasApiKey ? "Key Invalid" : "No API Key"}
                  </Badge>
                )}
              </div>
              <Button onClick={testProviders} disabled={testing} size="sm" variant="outline">
                {testing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Test Providers
              </Button>
            </CardContent>
          </Card>

          {/* Configuration */}
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="ollama">Ollama</TabsTrigger>
              <TabsTrigger value="openai">OpenAI</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="provider">Preferred AI Provider</Label>
                <Select value={formData.provider} onValueChange={(value: any) => setFormData(prev => ({ ...prev, provider: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ollama">Ollama Only (Local)</SelectItem>
                    <SelectItem value="openai">OpenAI Only (Cloud)</SelectItem>
                    <SelectItem value="both">Both (Ollama First, OpenAI Fallback)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Choose which AI provider to use for photo analysis. "Both" tries Ollama first, then falls back to OpenAI.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="ollama" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ollamaBaseUrl">Ollama Base URL</Label>
                <Input
                  id="ollamaBaseUrl"
                  value={formData.ollamaBaseUrl}
                  onChange={(e) => setFormData(prev => ({ ...prev, ollamaBaseUrl: e.target.value }))}
                  placeholder="http://localhost:11434"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ollamaVisionModel">Vision Model</Label>
                <Input
                  id="ollamaVisionModel"
                  value={formData.ollamaVisionModel}
                  onChange={(e) => setFormData(prev => ({ ...prev, ollamaVisionModel: e.target.value }))}
                  placeholder="llava:latest"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ollamaTextModel">Text Model</Label>
                <Input
                  id="ollamaTextModel"
                  value={formData.ollamaTextModel}
                  onChange={(e) => setFormData(prev => ({ ...prev, ollamaTextModel: e.target.value }))}
                  placeholder="llama3.2:latest"
                />
              </div>
            </TabsContent>

            <TabsContent value="openai" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="openaiApiKey">API Key</Label>
                <Input
                  id="openaiApiKey"
                  type="password"
                  value={formData.openaiApiKey}
                  onChange={(e) => setFormData(prev => ({ ...prev, openaiApiKey: e.target.value }))}
                  placeholder="Enter your OpenAI API key"
                />
                <p className="text-sm text-muted-foreground">
                  {config.config.openai.hasApiKey ? "API key is configured" : "No API key set"}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="openaiModel">Model</Label>
                <Select value={formData.openaiModel} onValueChange={(value) => setFormData(prev => ({ ...prev, openaiModel: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-4o">GPT-4o (Recommended)</SelectItem>
                    <SelectItem value="gpt-4o-mini">GPT-4o Mini (Faster)</SelectItem>
                    <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>
          </Tabs>

          {/* Save Button */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={saveConfig} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Configuration
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}