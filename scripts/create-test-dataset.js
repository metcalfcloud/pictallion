#!/usr/bin/env node

/**
 * Test Dataset Generator for Pictallion
 * 
 * This script creates a comprehensive test dataset to validate all features:
 * - Burst photo sequences (for burst detection)
 * - Similar photos (for duplicate detection)
 * - Photos with faces (for face detection)
 * - Various metadata scenarios (for AI processing)
 * - Different file types and sizes
 */

import https from 'https';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Free image sources that don't require API keys
const TEST_IMAGES = [
  // Burst sequence simulation - same subject, slight variations
  {
    url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
    filename: 'mountain_burst_001.jpg',
    category: 'burst',
    description: 'Mountain landscape - burst sequence 1'
  },
  {
    url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80&crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3wxfDB8MXxyYW5kb218MHx8fHx8fHx8MTcwMDAwMDAwMHww&ixlib=rb-4.0.3',
    filename: 'mountain_burst_002.jpg',
    category: 'burst',
    description: 'Mountain landscape - burst sequence 2'
  },
  {
    url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80&auto=format&fit=crop',
    filename: 'mountain_burst_003.jpg',
    category: 'burst',
    description: 'Mountain landscape - burst sequence 3'
  },

  // Portrait photos with faces
  {
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80',
    filename: 'portrait_male_001.jpg',
    category: 'faces',
    description: 'Male portrait for face detection'
  },
  {
    url: 'https://images.unsplash.com/photo-1494790108755-2616b612b77c?w=800&q=80',
    filename: 'portrait_female_001.jpg',
    category: 'faces',
    description: 'Female portrait for face detection'
  },
  {
    url: 'https://images.unsplash.com/photo-1566492031773-4f4e44671d66?w=800&q=80',
    filename: 'group_photo_001.jpg',
    category: 'faces',
    description: 'Group photo with multiple faces'
  },

  // Similar but not identical (for duplicate detection)
  {
    url: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&q=80',
    filename: 'forest_similar_001.jpg',
    category: 'similar',
    description: 'Forest scene - similar image 1'
  },
  {
    url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80',
    filename: 'forest_similar_002.jpg',
    category: 'similar',
    description: 'Forest scene - similar image 2'
  },

  // Diverse content for AI tagging
  {
    url: 'https://images.unsplash.com/photo-1518717758536-85ae29035b6d?w=800&q=80',
    filename: 'animals_dog_001.jpg',
    category: 'animals',
    description: 'Dog photo for animal detection'
  },
  {
    url: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=800&q=80',
    filename: 'animals_cat_001.jpg',
    category: 'animals',
    description: 'Cat photo for animal detection'
  },
  {
    url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
    filename: 'nature_mountain_001.jpg',
    category: 'nature',
    description: 'Mountain landscape'
  },
  {
    url: 'https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=800&q=80',
    filename: 'nature_lake_001.jpg',
    category: 'nature',
    description: 'Lake landscape'
  },
  {
    url: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&q=80',
    filename: 'architecture_city_001.jpg',
    category: 'architecture',
    description: 'City skyline'
  },
  {
    url: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=800&q=80',
    filename: 'food_pizza_001.jpg',
    category: 'food',
    description: 'Pizza for food detection'
  },
  {
    url: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=800&q=80',
    filename: 'vehicle_car_001.jpg',
    category: 'vehicles',
    description: 'Car for vehicle detection'
  },

  // High resolution for quality testing
  {
    url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=2400&q=95',
    filename: 'high_res_test_001.jpg',
    category: 'quality',
    description: 'High resolution test image'
  },

  // Different aspect ratios
  {
    url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=1200&fit=crop',
    filename: 'portrait_aspect_001.jpg',
    category: 'formats',
    description: 'Portrait aspect ratio'
  },
  {
    url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&h=600&fit=crop',
    filename: 'panorama_aspect_001.jpg',
    category: 'formats',
    description: 'Panoramic aspect ratio'
  }
];

// Create timestamped sequences for burst testing
function generateBurstTimestamps() {
  const baseTime = new Date('2024-07-27T14:30:00Z');
  return [
    new Date(baseTime.getTime()),
    new Date(baseTime.getTime() + 2000),  // 2 seconds later
    new Date(baseTime.getTime() + 5000),  // 5 seconds later
  ];
}

async function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const file = fs.open(filepath, 'w');
    
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }
      
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', async () => {
        try {
          await fs.writeFile(filepath, Buffer.concat(chunks));
          console.log(`Downloaded: ${path.basename(filepath)}`);
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

async function createTestDataset() {
  console.log('Creating comprehensive test dataset for Pictallion...\n');
  
  // Create test directory
  const testDir = path.join(process.cwd(), 'test-dataset');
  
  try {
    await fs.access(testDir);
    console.log('Test dataset directory already exists. Cleaning...');
    await fs.rm(testDir, { recursive: true });
  } catch {
    // Directory doesn't exist, which is fine
  }
  
  await fs.mkdir(testDir, { recursive: true });
  console.log(`Created test directory: ${testDir}\n`);

  // Download all test images
  const results = {
    success: 0,
    failed: 0,
    categories: {}
  };

  for (const image of TEST_IMAGES) {
    try {
      const filepath = path.join(testDir, image.filename);
      await downloadImage(image.url, filepath);
      
      results.success++;
      results.categories[image.category] = (results.categories[image.category] || 0) + 1;
      
      // Add small delay to be respectful to the service
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error(`Failed to download ${image.filename}: ${error.message}`);
      results.failed++;
    }
  }

  // Create metadata file with testing instructions
  const metadata = {
    created: new Date().toISOString(),
    purpose: 'Comprehensive test dataset for Pictallion features',
    totalImages: TEST_IMAGES.length,
    downloadResults: results,
    testingInstructions: {
      burstDetection: 'Upload mountain_burst_*.jpg files together to test burst grouping',
      faceDetection: 'Upload portrait_*.jpg and group_photo_*.jpg to test face recognition',
      duplicateDetection: 'Process forest_similar_*.jpg to Gold tier then check duplicates',
      aiTagging: 'Upload images from animals, nature, architecture, food, vehicles categories',
      qualityTesting: 'Upload high_res_test_*.jpg to test large file handling',
      formatTesting: 'Upload portrait_aspect_*.jpg and panorama_aspect_*.jpg for aspect ratio testing'
    },
    uploadOrder: [
      '1. Upload all burst photos together (mountain_burst_*.jpg)',
      '2. Upload portrait and group photos (portrait_*.jpg, group_photo_*.jpg)',
      '3. Upload diverse content photos for AI testing',
      '4. Upload similar photos and process to Gold tier for duplicate testing',
      '5. Upload high resolution and different aspect ratio photos'
    ]
  };

  await fs.writeFile(
    path.join(testDir, 'dataset-info.json'), 
    JSON.stringify(metadata, null, 2)
  );

  // Create upload script
  const uploadScript = `#!/bin/bash

# Pictallion Test Dataset Upload Script
# This script uploads images in the correct order to test all features

echo "🚀 Starting Pictallion feature testing..."
echo ""

echo "📁 Test dataset contains:"
echo "   • ${results.categories.burst || 0} burst sequence photos"
echo "   • ${results.categories.faces || 0} photos with faces"
echo "   • ${results.categories.similar || 0} similar photos for duplicate testing"
echo "   • ${results.categories.animals || 0} animal photos"
echo "   • ${results.categories.nature || 0} nature photos"
echo "   • ${results.categories.architecture || 0} architecture photos"
echo "   • ${results.categories.food || 0} food photos"
echo "   • ${results.categories.vehicles || 0} vehicle photos"
echo "   • ${results.categories.quality || 0} high resolution test photos"
echo "   • ${results.categories.formats || 0} different format test photos"
echo ""

echo "📋 Testing workflow:"
echo "1. Go to http://localhost:5000/upload"
echo "2. Upload burst photos first: mountain_burst_*.jpg"
echo "3. Process them and check /burst-selection page"
echo "4. Upload face photos: portrait_*.jpg, group_photo_*.jpg"
echo "5. Process and check /people page for face detection"
echo "6. Upload remaining photos for AI tagging tests"
echo "7. Process some photos to Gold tier"
echo "8. Check /duplicates page for duplicate detection"
echo ""

echo "✅ Dataset ready! Start testing by uploading photos to Pictallion."
`;

  await fs.writeFile(path.join(testDir, 'test-workflow.sh'), uploadScript);
  await fs.chmod(path.join(testDir, 'test-workflow.sh'), '755');

  console.log(`\n✅ Test dataset created successfully!`);
  console.log(`📁 Location: ${testDir}`);
  console.log(`📊 Downloaded: ${results.success} images`);
  console.log(`❌ Failed: ${results.failed} images`);
  console.log(`\n📋 Categories:`);
  Object.entries(results.categories).forEach(([category, count]) => {
    console.log(`   • ${category}: ${count} images`);
  });
  console.log(`\n🚀 Run './test-workflow.sh' in the test-dataset directory for testing instructions`);
  console.log(`📖 See 'dataset-info.json' for detailed testing guidance`);
}

// Run the script
createTestDataset().catch(console.error);