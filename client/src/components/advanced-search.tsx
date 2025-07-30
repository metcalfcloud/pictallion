import { useState, useEffect } from "react";
import { Search, Filter, X, Calendar, MapPin, Tag, Star, Camera, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { RatingFilter } from "./rating-system";
import { cn } from "@/lib/utils";

export interface SearchFilters {
  query?: string;
  tier?: 'silver' | 'gold';
  rating?: { min?: number; max?: number };
  dateRange?: { start?: Date; end?: Date };
  keywords?: string[];
  eventType?: string[];
  eventName?: string;
  location?: string;
  mimeType?: string[];
  camera?: string;
  lens?: string;
  minConfidence?: number;
  peopleIds?: string[];
  hasGPS?: boolean;
  collections?: string[];
  isReviewed?: boolean;
}

interface AdvancedSearchProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  onSearch: () => void;
  className?: string;
}

export function AdvancedSearch({ 
  filters, 
  onFiltersChange, 
  onSearch,
  className 
}: AdvancedSearchProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  // Update active filters count
  useEffect(() => {
    const active = [];
    if (filters.query) active.push('query');
    if (filters.tier) active.push('tier');
    if (filters.rating?.min || filters.rating?.max) active.push('rating');
    if (filters.dateRange?.start || filters.dateRange?.end) active.push('date');
    if (filters.keywords?.length) active.push('keywords');
    if (filters.eventType?.length) active.push('events');
    if (filters.location) active.push('location');
    if (filters.mimeType?.length) active.push('filetype');
    if (filters.camera) active.push('camera');
    if (filters.minConfidence) active.push('confidence');
    if (filters.hasGPS) active.push('gps');
    if (filters.isReviewed !== undefined) active.push('reviewed');
    
    setActiveFilters(active);
  }, [filters]);

  const updateFilter = (key: keyof SearchFilters, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  const clearFilters = () => {
    onFiltersChange({});
  };

  const removeFilter = (filterKey: string) => {
    const newFilters = { ...filters };
    switch (filterKey) {
      case 'query':
        delete newFilters.query;
        break;
      case 'tier':
        delete newFilters.tier;
        break;
      case 'rating':
        delete newFilters.rating;
        break;
      case 'date':
        delete newFilters.dateRange;
        break;
      case 'keywords':
        delete newFilters.keywords;
        break;
      case 'events':
        delete newFilters.eventType;
        delete newFilters.eventName;
        break;
      case 'location':
        delete newFilters.location;
        break;
      case 'filetype':
        delete newFilters.mimeType;
        break;
      case 'camera':
        delete newFilters.camera;
        break;
      case 'confidence':
        delete newFilters.minConfidence;
        break;
      case 'gps':
        delete newFilters.hasGPS;
        break;
      case 'reviewed':
        delete newFilters.isReviewed;
        break;
    }
    onFiltersChange(newFilters);
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Main search bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search photos by filename, description, tags, location..."
            value={filters.query || ""}
            onChange={(e) => updateFilter('query', e.target.value)}
            className="pl-10"
            onKeyDown={(e) => e.key === 'Enter' && onSearch()}
          />
        </div>
        
        <Button
          variant="outline"
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            "flex items-center gap-2",
            activeFilters.length > 0 && "border-blue-500 text-blue-600 dark:text-blue-400"
          )}
        >
          <Filter className="h-4 w-4" />
          Filters
          {activeFilters.length > 0 && (
            <Badge variant="secondary" className="ml-1">
              {activeFilters.length}
            </Badge>
          )}
        </Button>
        
        <Button onClick={onSearch}>
          Search
        </Button>
      </div>

      {/* Active filters */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {activeFilters.map((filterKey) => (
            <Badge key={filterKey} variant="secondary" className="flex items-center gap-1">
              {filterKey}
              <X 
                className="h-3 w-3 cursor-pointer hover:text-red-500" 
                onClick={() => removeFilter(filterKey)}
              />
            </Badge>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-6 px-2 text-xs"
          >
            Clear all
          </Button>
        </div>
      )}

      {/* Advanced filters */}
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Basic Filters */}
            <div className="space-y-4">
              <h3 className="font-medium flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Basic Filters
              </h3>
              
              <div className="space-y-3">
                <div>
                  <Label htmlFor="tier">Tier</Label>
                  <Select value={filters.tier || "all"} onValueChange={(value) => updateFilter('tier', value === 'all' ? undefined : value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All tiers" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All tiers</SelectItem>

                      <SelectItem value="silver">Silver</SelectItem>
                      <SelectItem value="gold">Gold</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="filetype">File Type</Label>
                  <Select 
                    value={filters.mimeType?.[0] || "all"} 
                    onValueChange={(value) => updateFilter('mimeType', value === 'all' ? undefined : [value])}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All types</SelectItem>
                      <SelectItem value="image/jpeg">JPEG</SelectItem>
                      <SelectItem value="image/png">PNG</SelectItem>
                      <SelectItem value="image/tiff">TIFF</SelectItem>
                      <SelectItem value="video/mp4">MP4</SelectItem>
                      <SelectItem value="video/quicktime">MOV</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="reviewed"
                    checked={filters.isReviewed || false}
                    onCheckedChange={(checked) => updateFilter('isReviewed', checked ? true : undefined)}
                  />
                  <Label htmlFor="reviewed">Only reviewed photos</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="hasGPS"
                    checked={filters.hasGPS || false}
                    onCheckedChange={(checked) => updateFilter('hasGPS', checked ? true : undefined)}
                  />
                  <Label htmlFor="hasGPS">Has GPS location</Label>
                </div>
              </div>
            </div>

            {/* Rating and Quality */}
            <div className="space-y-4">
              <h3 className="font-medium flex items-center gap-2">
                <Star className="h-4 w-4" />
                Rating & Quality
              </h3>
              
              <RatingFilter
                minRating={filters.rating?.min || 0}
                maxRating={filters.rating?.max || 5}
                onRatingRangeChange={(min, max) => {
                  updateFilter('rating', 
                    min === 0 && max === 5 ? undefined : { min, max }
                  );
                }}
              />

              <div>
                <Label>AI Confidence (min {filters.minConfidence || 0}%)</Label>
                <Slider
                  value={[filters.minConfidence || 0]}
                  onValueChange={([value]) => updateFilter('minConfidence', value > 0 ? value : undefined)}
                  max={100}
                  step={5}
                  className="mt-2"
                />
              </div>
            </div>

            {/* Camera and Technical */}
            <div className="space-y-4">
              <h3 className="font-medium flex items-center gap-2">
                <Camera className="h-4 w-4" />
                Camera & Technical
              </h3>
              
              <div className="space-y-3">
                <div>
                  <Label htmlFor="camera">Camera</Label>
                  <Input
                    id="camera"
                    placeholder="e.g. Canon EOS R5"
                    value={filters.camera || ""}
                    onChange={(e) => updateFilter('camera', e.target.value || undefined)}
                  />
                </div>

                <div>
                  <Label htmlFor="lens">Lens</Label>
                  <Input
                    id="lens"
                    placeholder="e.g. 24-70mm f/2.8"
                    value={filters.lens || ""}
                    onChange={(e) => updateFilter('lens', e.target.value || undefined)}
                  />
                </div>
              </div>
            </div>

            {/* Location and Events */}
            <div className="space-y-4">
              <h3 className="font-medium flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Location & Events
              </h3>
              
              <div className="space-y-3">
                <div>
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    placeholder="e.g. Paris, beach, home"
                    value={filters.location || ""}
                    onChange={(e) => updateFilter('location', e.target.value || undefined)}
                  />
                </div>

                <div>
                  <Label htmlFor="eventName">Event</Label>
                  <Input
                    id="eventName"
                    placeholder="e.g. wedding, vacation, birthday"
                    value={filters.eventName || ""}
                    onChange={(e) => updateFilter('eventName', e.target.value || undefined)}
                  />
                </div>

                <div>
                  <Label htmlFor="eventType">Event Type</Label>
                  <Select 
                    value={filters.eventType?.[0] || "all"} 
                    onValueChange={(value) => updateFilter('eventType', value === 'all' ? undefined : [value])}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All events" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All events</SelectItem>
                      <SelectItem value="holiday">Holiday</SelectItem>
                      <SelectItem value="birthday">Birthday</SelectItem>
                      <SelectItem value="wedding">Wedding</SelectItem>
                      <SelectItem value="vacation">Vacation</SelectItem>
                      <SelectItem value="party">Party</SelectItem>
                      <SelectItem value="sports">Sports</SelectItem>
                      <SelectItem value="concert">Concert</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Date Range */}
            <div className="space-y-4">
              <h3 className="font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Date Range
              </h3>
              
              <div className="space-y-3">
                <div>
                  <Label htmlFor="startDate">From</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={filters.dateRange?.start?.toISOString().split('T')[0] || ""}
                    onChange={(e) => {
                      const date = e.target.value ? new Date(e.target.value) : undefined;
                      updateFilter('dateRange', {
                        ...filters.dateRange,
                        start: date
                      });
                    }}
                  />
                </div>

                <div>
                  <Label htmlFor="endDate">To</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={filters.dateRange?.end?.toISOString().split('T')[0] || ""}
                    onChange={(e) => {
                      const date = e.target.value ? new Date(e.target.value) : undefined;
                      updateFilter('dateRange', {
                        ...filters.dateRange,
                        end: date
                      });
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Keywords */}
            <div className="space-y-4">
              <h3 className="font-medium flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Keywords & Tags
              </h3>
              
              <div>
                <Label htmlFor="keywords">Keywords (comma-separated)</Label>
                <Input
                  id="keywords"
                  placeholder="e.g. landscape, sunset, mountain"
                  value={filters.keywords?.join(', ') || ""}
                  onChange={(e) => {
                    const keywords = e.target.value
                      .split(',')
                      .map(k => k.trim())
                      .filter(k => k.length > 0);
                    updateFilter('keywords', keywords.length > 0 ? keywords : undefined);
                  }}
                />
              </div>
            </div>
          </div>

          <Separator />

          <div className="flex justify-between">
            <Button variant="outline" onClick={clearFilters}>
              Clear All Filters
            </Button>
            <Button onClick={onSearch}>
              Apply Filters
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}