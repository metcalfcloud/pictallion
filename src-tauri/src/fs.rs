// fs.rs: Filesystem operations for Pictallion backend (Rust/Tauri)
//
// This module provides tiered storage management and file utilities.
// All logic is designed to match legacy FastAPI endpoints and storage tiers.

use std::fs;
use std::path::Path;

pub fn create_tier_dir(tier: &str) -> std::io::Result<()> {
    let path = format!("data/media/{}", tier);
    fs::create_dir_all(&path)
}

pub fn move_file_to_tier(src: &str, tier: &str) -> std::io::Result<()> {
    let dest = format!("data/media/{}/{}", tier, Path::new(src).file_name().unwrap().to_str().unwrap());
    fs::rename(src, dest)
}

// Unit tests for fs.rs
#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::{self, File};
    use std::path::Path;

    #[test]
    fn test_create_tier_dir() {
        let tier = "test-tier";
        let path = format!("data/media/{}", tier);
        let _ = fs::remove_dir_all(&path); // Clean up before test
        assert!(create_tier_dir(tier).is_ok());
        assert!(Path::new(&path).exists());
        let _ = fs::remove_dir_all(&path); // Clean up after test
    }

    #[test]
    fn test_move_file_to_tier() {
        let tier = "test-tier";
        let _ = create_tier_dir(tier);
        let src = "data/media/testfile.txt";
        let mut file = File::create(src).unwrap();
        use std::io::Write;
        writeln!(file, "test").unwrap();

        assert!(move_file_to_tier(src, tier).is_ok());
        let dest = format!("data/media/{}/testfile.txt", tier);
        assert!(Path::new(&dest).exists());
        let _ = fs::remove_file(&dest);
        let _ = fs::remove_dir_all(format!("data/media/{}", tier));
    }
}
// Add more file operations as needed (delete, copy, metadata)