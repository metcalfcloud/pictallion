
/**
 * Media Library and Database Reset Script
 * 
 * This script completely resets Pictallion for clean end-to-end testing:
 * - Removes all media files from bronze, silver, gold, and temp directories
 * - Truncates all database tables
 * - Preserves directory structure
 * - Provides confirmation prompts for safety
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from "ws";
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure database connection
neonConfig.webSocketConstructor = ws;

// Get database URL from environment
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

// Media directories to clean
const MEDIA_DIRS = [
  'data/media/bronze',
  'data/media/silver', 
  'data/media/gold',
  'data/media/archive',
  'data/media/dropzone',
  'uploads/temp'
];

// Database tables to truncate (in dependency order)
const TABLES_TO_TRUNCATE = [
  'asset_history',
  'collection_photos', 
  'faces',
  'file_versions',
  'collections',
  'people',
  'media_assets',
  'settings'
];

async function createReadlineInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

async function confirmAction(message) {
  const rl = await createReadlineInterface();
  
  return new Promise((resolve) => {
    rl.question(`${message} (y/N): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

async function removeDirectoryContents(dirPath) {
  const fullPath = path.join(process.cwd(), dirPath);
  
  try {
    await fs.access(fullPath);
    const items = await fs.readdir(fullPath);
    
    let removedCount = 0;
    for (const item of items) {
      const itemPath = path.join(fullPath, item);
      const stat = await fs.stat(itemPath);
      
      if (stat.isDirectory()) {
        await fs.rm(itemPath, { recursive: true });
        console.log(`  📁 Removed directory: ${item}`);
        removedCount++;
      } else if (item !== '.gitkeep') {
        await fs.unlink(itemPath);
        console.log(`  📄 Removed file: ${item}`);
        removedCount++;
      }
    }
    
    return removedCount;
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log(`  ⚠️  Directory not found: ${dirPath}`);
      return 0;
    }
    throw error;
  }
}

async function truncateDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('🗃️  Truncating database tables...');
    
    // Disable foreign key checks temporarily
    await client.query('SET session_replication_role = replica;');
    
    let truncatedCount = 0;
    for (const table of TABLES_TO_TRUNCATE) {
      try {
        await client.query(`TRUNCATE TABLE ${table} CASCADE;`);
        console.log(`  ✅ Truncated table: ${table}`);
        truncatedCount++;
      } catch (error) {
        console.log(`  ⚠️  Could not truncate ${table}: ${error.message}`);
      }
    }
    
    // Re-enable foreign key checks
    await client.query('SET session_replication_role = DEFAULT;');
    
    console.log(`📊 Truncated ${truncatedCount} database tables`);
    
  } finally {
    client.release();
  }
}

async function resetMediaLibrary() {
  console.log('🧹 Pictallion Media Library Reset Tool\n');
  
  // Show what will be reset
  console.log('This will completely reset your Pictallion installation:');
  console.log('📁 Media files will be removed from:');
  MEDIA_DIRS.forEach(dir => console.log(`   • ${dir}`));
  console.log('\n🗃️  Database tables will be truncated:');
  TABLES_TO_TRUNCATE.forEach(table => console.log(`   • ${table}`));
  console.log('\n⚠️  This action cannot be undone!\n');
  
  // Confirm action
  const confirmed = await confirmAction('Are you sure you want to reset everything?');
  if (!confirmed) {
    console.log('❌ Reset cancelled');
    return;
  }
  
  try {
    // Remove media files
    console.log('\n📁 Cleaning media directories...');
    let totalFilesRemoved = 0;
    
    for (const dir of MEDIA_DIRS) {
      console.log(`\nCleaning ${dir}:`);
      const removedCount = await removeDirectoryContents(dir);
      totalFilesRemoved += removedCount;
    }
    
    console.log(`\n📊 Removed ${totalFilesRemoved} files and directories`);
    
    // Reset database
    console.log('\n🗃️  Resetting database...');
    await truncateDatabase();
    
    console.log('\n✅ Media library reset completed successfully!');
    console.log('\n🚀 You can now:');
    console.log('   • Upload test photos via the web interface');
    console.log('   • Run end-to-end testing scenarios');
    console.log('   • Use scripts/create-test-dataset.js for sample data');
    
  } catch (error) {
    console.error('\n❌ Reset failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Add command line options
const args = process.argv.slice(2);
const forceMode = args.includes('--force') || args.includes('-f');
const helpMode = args.includes('--help') || args.includes('-h');

if (helpMode) {
  console.log(`
Pictallion Media Library Reset Tool

Usage: node scripts/reset-media-library.js [options]

Options:
  -f, --force    Skip confirmation prompts (use with caution!)
  -h, --help     Show this help message

Examples:
  node scripts/reset-media-library.js          # Interactive reset with confirmation
  node scripts/reset-media-library.js --force  # Reset without confirmation prompts

This script will:
• Remove all media files from bronze, silver, gold, and temp directories
• Truncate all database tables
• Preserve directory structure with .gitkeep files
• Prepare the system for clean end-to-end testing
`);
  process.exit(0);
}

// Override confirmation function in force mode
if (forceMode) {
  console.log('🚨 Force mode enabled - skipping confirmations\n');
}

// Run the reset
resetMediaLibrary().catch(console.error);
