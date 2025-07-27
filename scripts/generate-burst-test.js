#!/usr/bin/env node

/**
 * Burst Photo Test Generator
 * 
 * This creates simulated burst photos by taking a base image and creating
 * slight variations with different timestamps to properly test burst detection.
 */

import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function createBurstSequence() {
  console.log('Creating burst photo sequence for testing...\n');
  
  // Check if ImageMagick is available for image manipulation
  try {
    await execAsync('convert -version');
    console.log('✅ ImageMagick found - will create varied burst images');
  } catch {
    console.log('⚠️  ImageMagick not found - will copy base image with different timestamps');
  }
  
  const testDir = path.join(process.cwd(), 'burst-test');
  
  try {
    await fs.access(testDir);
    await fs.rm(testDir, { recursive: true });
  } catch {}
  
  await fs.mkdir(testDir, { recursive: true });
  
  // Download a base image for burst simulation
  const baseImageUrl = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&q=85';
  
  console.log('Downloading base image...');
  
  // Simple download function
  const https = await import('https');
  const downloadImage = (url, filepath) => {
    return new Promise((resolve, reject) => {
      https.default.get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }
        
        const chunks = [];
        response.on('data', chunk => chunks.push(chunk));
        response.on('end', async () => {
          await fs.writeFile(filepath, Buffer.concat(chunks));
          resolve();
        });
      }).on('error', reject);
    });
  };
  
  const baseImagePath = path.join(testDir, 'base_image.jpg');
  await downloadImage(baseImageUrl, baseImagePath);
  
  // Create burst sequence with slight variations
  const burstImages = [
    { name: 'IMG_4523.jpg', variation: 'none', seconds: 0 },
    { name: 'IMG_4524.jpg', variation: 'brightness +5', seconds: 1 },
    { name: 'IMG_4525.jpg', variation: 'brightness -3', seconds: 2 },
    { name: 'IMG_4526.jpg', variation: 'contrast +10', seconds: 3 },
    { name: 'IMG_4527.jpg', variation: 'crop 98%', seconds: 5 },
    { name: 'IMG_4528.jpg', variation: 'brightness +2 contrast +5', seconds: 7 }
  ];
  
  const baseTime = new Date('2024-07-27T14:30:15Z');
  
  for (const image of burstImages) {
    const outputPath = path.join(testDir, image.name);
    
    try {
      if (image.variation === 'none') {
        // Just copy the original
        await fs.copyFile(baseImagePath, outputPath);
      } else if (image.variation === 'crop 98%') {
        // Simple crop using ImageMagick
        await execAsync(`convert "${baseImagePath}" -crop 98%x98%+1%+1% "${outputPath}"`);
      } else {
        // Apply brightness/contrast changes
        const variations = image.variation.split(' ');
        let command = `convert "${baseImagePath}"`;
        
        for (let i = 0; i < variations.length; i += 2) {
          const type = variations[i];
          const value = variations[i + 1];
          
          if (type === 'brightness') {
            command += ` -modulate ${100 + parseInt(value)}`;
          } else if (type === 'contrast') {
            command += ` -contrast-stretch ${value}%`;
          }
        }
        
        command += ` "${outputPath}"`;
        await execAsync(command);
      }
      
      console.log(`✅ Created burst image: ${image.name} (${image.variation})`);
      
    } catch (error) {
      // Fallback: just copy the base image
      await fs.copyFile(baseImagePath, outputPath);
      console.log(`⚠️  Created burst image: ${image.name} (fallback copy)`);
    }
    
    // Modify file timestamp to simulate burst sequence
    const imageTime = new Date(baseTime.getTime() + (image.seconds * 1000));
    try {
      await execAsync(`touch -d "${imageTime.toISOString()}" "${outputPath}"`);
    } catch {
      // On systems where touch doesn't work with ISO dates
      console.log(`   (timestamp simulation not available on this system)`);
    }
  }
  
  // Clean up base image
  await fs.unlink(baseImagePath);
  
  // Create instructions
  const instructions = {
    purpose: 'Burst photo sequence test',
    description: 'These images simulate a camera burst sequence with slight variations',
    imageCount: burstImages.length,
    timeSpan: `${Math.max(...burstImages.map(i => i.seconds))} seconds`,
    testingSteps: [
      '1. Upload all images from this directory to Pictallion',
      '2. Go to the Burst Photos page (/burst-selection)',
      '3. The system should group these as a burst sequence',
      '4. Select your preferred image(s) from the group',
      '5. Process the selection to test the burst workflow'
    ],
    expectedBehavior: {
      grouping: 'All images should be grouped together as one burst sequence',
      similarity: 'Should show 95%+ similarity',
      timeWindow: 'Should detect they were taken within the same minute',
      suggestion: 'Should suggest the highest quality image as best choice'
    }
  };
  
  await fs.writeFile(
    path.join(testDir, 'burst-test-info.json'),
    JSON.stringify(instructions, null, 2)
  );
  
  console.log(`\n✅ Burst test sequence created!`);
  console.log(`📁 Location: ${testDir}`);
  console.log(`📸 Created ${burstImages.length} burst images`);
  console.log(`⏱️  Time span: ${Math.max(...burstImages.map(i => i.seconds))} seconds`);
  console.log(`\n🧪 Upload these images to test burst photo detection!`);
}

createBurstSequence().catch(console.error);