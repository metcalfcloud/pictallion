import { storage } from "../storage";
import { DEFAULT_PROMPTS } from "@shared/ai-prompts";
import type { AIPrompt } from "@shared/schema";
import { info, error } from "@shared/logger";

export class PromptManager {
  private static instance: PromptManager;
  private promptCache: Map<string, AIPrompt> = new Map();
  private initialized = false;

  private constructor() {}

  static getInstance(): PromptManager {
    if (!PromptManager.instance) {
      PromptManager.instance = new PromptManager();
    }
    return PromptManager.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const existingPrompts = await storage.getAllAIPrompts();
      
      if (existingPrompts.length === 0) {
        info("Initializing default AI prompts", "PromptManager");
        await this.initializeDefaultPrompts();
      }

      await this.refreshCache();
      this.initialized = true;
      info("Prompt manager initialized successfully", "PromptManager");
    } catch (err) {
      error("Failed to initialize prompt manager", "PromptManager", { error: err });
      throw err;
    }
  }

  private async initializeDefaultPrompts(): Promise<void> {
    for (const prompt of DEFAULT_PROMPTS) {
      try {
        await storage.createAIPrompt({
        });
      } catch (err) {
        error(`Failed to create default prompt ${prompt.name}`, "PromptManager", { error: err });
      }
    }
  }

  private async refreshCache(): Promise<void> {
    try {
      const prompts = await storage.getActiveAIPrompts();
      this.promptCache.clear();
      
      for (const prompt of prompts) {
        const key = `${prompt.category}-${prompt.provider}`;
        this.promptCache.set(key, prompt);
        
        this.promptCache.set(prompt.id, prompt);
      }
    } catch (error) {
      // error("Failed to refresh prompt cache:", error);
    }
  }

  async getPrompt(category: string, provider: string): Promise<AIPrompt | null> {
    await this.initialize();
    
    // First try exact match
    let key = `${category}-${provider}`;
    let prompt = this.promptCache.get(key);
    
    if (!prompt && provider !== 'both') {
      key = `${category}-both`;
      prompt = this.promptCache.get(key);
    }

    if (!prompt) {
      // Fallback to database query
      try {
        const prompts = await storage.getAIPromptsByCategory(category);
        const filtered = prompts.filter(p => 
          p.provider === provider || p.provider === 'both'
        );
        prompt = filtered.find(p => p.isActive) || filtered[0] || null;
      } catch (error) {
        // error("Failed to fetch prompt from database:", error);
        return null;
      }
    }

    return prompt;
  }

  async getPromptById(id: string): Promise<AIPrompt | null> {
    await this.initialize();
    
    let prompt = this.promptCache.get(id);
    if (!prompt) {
      try {
        prompt = await storage.getAIPrompt(id);
      } catch (error) {
        // error("Failed to fetch prompt by ID:", error);
        return null;
      }
    }

    return prompt || null;
  }

  async updatePrompt(id: string, updates: Partial<AIPrompt>): Promise<AIPrompt | null> {
    try {
      const updated = await storage.updateAIPrompt(id, updates);
      await this.refreshCache();
      return updated;
    } catch (error) {
      // error("Failed to update prompt:", error);
      return null;
    }
  }

  async createPrompt(promptData: any): Promise<AIPrompt | null> {
    try {
      const created = await storage.createAIPrompt(promptData);
      await this.refreshCache();
      return created;
    } catch (error) {
      // error("Failed to create prompt:", error);
      return null;
    }
  }

  async deletePrompt(id: string): Promise<boolean> {
    try {
      await storage.deleteAIPrompt(id);
      await this.refreshCache();
      return true;
    } catch (error) {
      // error("Failed to delete prompt:", error);
      return false;
    }
  }

  async resetToDefaults(): Promise<boolean> {
    try {
      await storage.resetAIPromptsToDefaults();
      await this.refreshCache();
      return true;
    } catch (error) {
      // error("Failed to reset prompts to defaults:", error);
      return false;
    }
  }

  // Get all prompts for a specific category
  async getPromptsByCategory(category: string): Promise<AIPrompt[]> {
    await this.initialize();
    
    try {
      return await storage.getAIPromptsByCategory(category);
    } catch (error) {
      // error("Failed to get prompts by category:", error);
      return [];
    }
  }

  async generateFamilyDescription(peopleContext: Array<{
    ageInPhoto?: number | null;
  }>): Promise<string> {
    if (!peopleContext || peopleContext.length === 0) {
      return "A beautiful family moment captured in time.";
    }

    const names = peopleContext.map(p => p.name);
    const ages = peopleContext.filter(p => p.ageInPhoto).map(p => `${p.name} (${p.ageInPhoto})`);
    
    let description = `A wonderful moment with ${names.join(", ")}`;
    
    if (ages.length > 0) {
      description += ` - ages: ${ages.join(", ")}`;
    }

    const relationships = peopleContext.flatMap(p => p.relationships.map(r => r.type));
    if (relationships.includes("parent") || relationships.includes("child")) {
      description += ". A precious family gathering";
    } else if (relationships.includes("spouse") || relationships.includes("partner")) {
      description += ". A special time together";
    }

    return description + ".";
  }
}

export const promptManager = PromptManager.getInstance();