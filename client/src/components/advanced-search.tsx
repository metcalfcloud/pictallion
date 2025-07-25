import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Calendar as CalendarIcon, 
  Camera, 
  MapPin, 
  Tag, 
  Star,
  X,
  Filter
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

export interface SearchFilters {
  query: string;
  tier: string[];
  dateRange: {
    from?: Date;
    to?: Date;
  };
  camera: string;
  tags: string[];
  location: string;
  aiConfidence: [number, number];
  fileType: string[];
  fileSize: [number, number]; // in MB
  hasGPS: boolean;
  isReviewed?: boolean;
  hasFaces: boolean;
  people: string[];
}

interface AdvancedSearchProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  availableTags: string[];
  availableCameras: string[];
  availablePeople: string[];
  onSearch: () => void;
  onReset: () => void;
}

export default function AdvancedSearch({
  filters,
  onFiltersChange,
  availableTags,
  availableCameras,
  availablePeople,
  onSearch,
  onReset
}: AdvancedSearchProps) {
  const [isOpen, setIsOpen] = useState(false);

  const updateFilters = (updates: Partial<SearchFilters>) => {
    onFiltersChange({ ...filters, ...updates });
  };

  const toggleArrayFilter = (key: keyof SearchFilters, value: string) => {
    const currentArray = filters[key] as string[];
    const newArray = currentArray.includes(value)
      ? currentArray.filter(item => item !== value)
      : [...currentArray, value];
    updateFilters({ [key]: newArray });
  };

  const removeTag = (key: keyof SearchFilters, value: string) => {
    const currentArray = filters[key] as string[];
    updateFilters({ [key]: currentArray.filter(item => item !== value) });
  };

  const activeFiltersCount = 
    (filters.query ? 1 : 0) +
    filters.tier.length +
    (filters.dateRange.from || filters.dateRange.to ? 1 : 0) +
    (filters.camera ? 1 : 0) +
    filters.tags.length +
    (filters.location ? 1 : 0) +
    (filters.aiConfidence[0] > 0 || filters.aiConfidence[1] < 100 ? 1 : 0) +
    filters.fileType.length +
    (filters.fileSize[0] > 0 || filters.fileSize[1] < 100 ? 1 : 0) +
    (filters.hasGPS ? 1 : 0) +
    (filters.isReviewed !== undefined ? 1 : 0) +
    (filters.hasFaces ? 1 : 0) +
    filters.people.length;

  return (
    <div className="w-full">
      {/* Quick Search Bar */}
      <div className="flex items-center space-x-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search photos by filename, tags, or description..."
            value={filters.query}
            onChange={(e) => updateFilters({ query: e.target.value })}
            className="pl-10"
            onKeyDown={(e) => e.key === 'Enter' && onSearch()}
          />
        </div>
        <Button
          variant="outline"
          onClick={() => setIsOpen(!isOpen)}
          className={cn(activeFiltersCount > 0 && "border-blue-500 bg-blue-50")}
        >
          <Filter className="h-4 w-4 mr-2" />
          Filters
          {activeFiltersCount > 0 && (
            <Badge variant="secondary" className="ml-2 text-xs">
              {activeFiltersCount}
            </Badge>
          )}
        </Button>
        <Button onClick={onSearch}>Search</Button>
      </div>

      {/* Active Filters */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {filters.tier.map(tier => (
            <Badge key={tier} variant="secondary" className="cursor-pointer">
              Tier: {tier}
              <X className="h-3 w-3 ml-1" onClick={() => removeTag('tier', tier)} />
            </Badge>
          ))}
          {filters.tags.map(tag => (
            <Badge key={tag} variant="secondary" className="cursor-pointer">
              Tag: {tag}
              <X className="h-3 w-3 ml-1" onClick={() => removeTag('tags', tag)} />
            </Badge>
          ))}
          {filters.people.map(person => (
            <Badge key={person} variant="secondary" className="cursor-pointer">
              Person: {person}
              <X className="h-3 w-3 ml-1" onClick={() => removeTag('people', person)} />
            </Badge>
          ))}
          <Button variant="ghost" size="sm" onClick={onReset}>
            Clear all
          </Button>
        </div>
      )}

      {/* Advanced Filters Panel */}
      {isOpen && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-lg">Advanced Filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              
              {/* Tier Filter */}
              <div className="space-y-2">
                <Label>Tier</Label>
                <div className="space-y-2">
                  {['bronze', 'silver', 'gold'].map(tier => (
                    <div key={tier} className="flex items-center space-x-2">
                      <Checkbox
                        id={tier}
                        checked={filters.tier.includes(tier)}
                        onCheckedChange={() => toggleArrayFilter('tier', tier)}
                      />
                      <Label htmlFor={tier} className="capitalize">{tier}</Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Date Range */}
              <div className="space-y-2">
                <Label>Date Range</Label>
                <div className="flex space-x-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {filters.dateRange.from ? format(filters.dateRange.from, "PPP") : "From date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={filters.dateRange.from}
                        onSelect={(date) => updateFilters({ 
                          dateRange: { ...filters.dateRange, from: date } 
                        })}
                      />
                    </PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {filters.dateRange.to ? format(filters.dateRange.to, "PPP") : "To date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={filters.dateRange.to}
                        onSelect={(date) => updateFilters({ 
                          dateRange: { ...filters.dateRange, to: date } 
                        })}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Camera */}
              <div className="space-y-2">
                <Label>Camera</Label>
                <Select value={filters.camera} onValueChange={(value) => updateFilters({ camera: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select camera" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All cameras</SelectItem>
                    {availableCameras.map(camera => (
                      <SelectItem key={camera} value={camera}>{camera}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Location */}
              <div className="space-y-2">
                <Label>Location</Label>
                <Input
                  placeholder="Enter location..."
                  value={filters.location}
                  onChange={(e) => updateFilters({ location: e.target.value })}
                />
              </div>

              {/* AI Confidence */}
              <div className="space-y-2">
                <Label>AI Confidence ({filters.aiConfidence[0]}% - {filters.aiConfidence[1]}%)</Label>
                <Slider
                  value={filters.aiConfidence}
                  onValueChange={(value) => updateFilters({ aiConfidence: value as [number, number] })}
                  max={100}
                  min={0}
                  step={5}
                  className="w-full"
                />
              </div>

              {/* File Type */}
              <div className="space-y-2">
                <Label>File Type</Label>
                <div className="space-y-2">
                  {['image/jpeg', 'image/png', 'image/tiff', 'video/mp4'].map(type => (
                    <div key={type} className="flex items-center space-x-2">
                      <Checkbox
                        id={type}
                        checked={filters.fileType.includes(type)}
                        onCheckedChange={() => toggleArrayFilter('fileType', type)}
                      />
                      <Label htmlFor={type}>{type.split('/')[1].toUpperCase()}</Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                {availableTags.map(tag => (
                  <Badge
                    key={tag}
                    variant={filters.tags.includes(tag) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleArrayFilter('tags', tag)}
                  >
                    <Tag className="h-3 w-3 mr-1" />
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>

            {/* People */}
            <div className="space-y-2">
              <Label>People</Label>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                {availablePeople.map(person => (
                  <Badge
                    key={person}
                    variant={filters.people.includes(person) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleArrayFilter('people', person)}
                  >
                    {person}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Boolean Filters */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="hasGPS"
                  checked={filters.hasGPS}
                  onCheckedChange={(checked) => updateFilters({ hasGPS: !!checked })}
                />
                <Label htmlFor="hasGPS">Has GPS</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="hasFaces"
                  checked={filters.hasFaces}
                  onCheckedChange={(checked) => updateFilters({ hasFaces: !!checked })}
                />
                <Label htmlFor="hasFaces">Has Faces</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isReviewed"
                  checked={filters.isReviewed === true}
                  onCheckedChange={(checked) => updateFilters({ 
                    isReviewed: checked ? true : undefined 
                  })}
                />
                <Label htmlFor="isReviewed">Reviewed</Label>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-2 pt-4 border-t">
              <Button variant="outline" onClick={onReset}>
                Reset Filters
              </Button>
              <Button onClick={onSearch}>
                Apply Filters
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}