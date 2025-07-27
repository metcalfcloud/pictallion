# Pictallion Test Photos Directory

This directory is for organizing test photos to validate all Pictallion features.

## Recommended Test Photo Categories

### 1. Burst Sequences (for Burst Photo Detection)
Create subdirectory: `burst/`

**What to include:**
- 3-6 photos of the same subject taken within 1 minute
- Use your phone's burst mode or manual rapid shots
- Similar content but slight variations (movement, focus, angle)

**Example naming:**
```
burst/
├── mountain_burst_001.jpg  (14:30:15)
├── mountain_burst_002.jpg  (14:30:17)
├── mountain_burst_003.jpg  (14:30:19)
└── mountain_burst_004.jpg  (14:30:22)
```

### 2. Portrait Photos (for Face Detection)
Create subdirectory: `faces/`

**What to include:**
- Individual portraits (clear face visibility)
- Group photos (multiple faces)
- Different angles and lighting
- Same person in multiple photos (for person recognition)

**Example naming:**
```
faces/
├── portrait_john_001.jpg
├── portrait_jane_001.jpg
├── group_family_001.jpg
└── selfie_closeup_001.jpg
```

### 3. Diverse Content (for AI Tagging)
Create subdirectories by category:

```
content/
├── animals/
│   ├── dog_golden_001.jpg
│   ├── cat_tabby_001.jpg
│   └── bird_robin_001.jpg
├── nature/
│   ├── mountain_landscape_001.jpg
│   ├── beach_sunset_001.jpg
│   └── forest_trees_001.jpg
├── architecture/
│   ├── building_modern_001.jpg
│   ├── bridge_stone_001.jpg
│   └── house_victorian_001.jpg
├── food/
│   ├── pizza_margherita_001.jpg
│   ├── coffee_latte_001.jpg
│   └── fruit_apple_001.jpg
└── vehicles/
    ├── car_sedan_001.jpg
    ├── bicycle_road_001.jpg
    └── plane_commercial_001.jpg
```

### 4. Similar Photos (for Duplicate Detection)
Create subdirectory: `similar/`

**What to include:**
- Near-identical photos (test actual duplicates)
- Similar compositions with slight differences
- Same subject from different angles
- Photos that should NOT be considered duplicates

**Example naming:**
```
similar/
├── sunset_beach_001.jpg
├── sunset_beach_002.jpg  (very similar to 001)
├── forest_path_001.jpg
└── forest_path_002.jpg   (very similar to 001)
```

### 5. Quality & Format Tests
Create subdirectory: `formats/`

**What to include:**
- High resolution photos (test large file handling)
- Different aspect ratios (square, panoramic, portrait)
- Various formats (JPG, PNG, TIFF if supported)
- Different quality levels

**Example naming:**
```
formats/
├── high_res_4k_001.jpg       (4K resolution)
├── square_aspect_001.jpg     (1:1 ratio)
├── panorama_wide_001.jpg     (3:1 ratio)
├── portrait_tall_001.jpg     (2:3 ratio)
└── large_file_001.jpg        (close to 50MB limit)
```

## Testing Workflow

### Phase 1: Basic Upload & Processing
1. Upload 5-10 photos from different categories
2. Test Bronze → Silver processing
3. Verify AI tags and descriptions are generated
4. Check face detection results

### Phase 2: Burst Photo Testing
1. Upload all photos from `burst/` directory together
2. Navigate to Burst Photos page
3. Verify photos are grouped correctly
4. Test selection and processing workflow

### Phase 3: Advanced Features
1. Process some photos to Gold tier
2. Test duplicate detection on Gold tier photos
3. Create collections and organize photos
4. Test search functionality with AI tags

### Phase 4: Edge Cases
1. Upload very large files
2. Test different formats
3. Upload many photos at once (performance test)
4. Test error scenarios (invalid files, etc.)

## Quick Start Tips

**If you don't have test photos ready:**

1. **Use your phone:** Take burst photos of any subject (even just your desk)
2. **Capture variety:** Photo some common objects (coffee cup, pet, outside view)
3. **Include faces:** Take a few selfies or photos of family/friends
4. **Similar shots:** Take 2-3 photos of the same thing from slightly different angles

**Minimum viable test set:**
- 3 burst photos of the same subject
- 2 photos with faces
- 5 photos of different objects/scenes
- 2 very similar photos

This gives you enough content to test all major features!

## Expected Results

**Burst Detection:**
- Photos taken within 1 minute with 95%+ similarity should group together
- System should suggest the best quality photo
- You should be able to select multiple photos from a group

**Face Detection:**
- Clear faces should be detected and cropped
- Same person should be recognizable across photos
- Face crops should be reasonably accurate

**AI Tagging:**
- Common objects should be identified (dog, cat, car, etc.)
- Scenes should be described (beach, mountain, city, etc.)
- Activities might be detected (eating, sports, etc.)

**Duplicate Detection:**
- Very similar photos in Gold tier should be flagged
- System should suggest which photo to keep
- You should have options to delete or keep duplicates