// src-tauri/src/location.rs

use serde::{Deserialize, Serialize};
use tauri::command;
use std::collections::HashMap;

/// Represents a GPS coordinate.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Coordinate {
    pub latitude: f64,
    pub longitude: f64,
}

/// Represents a location cluster.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocationCluster {
    pub cluster_id: usize,
    pub coordinates: Vec<Coordinate>,
}

/// Clusters coordinates using a simple grid-based approach.
/// This is readable and reproducible, not micro-optimized.
pub fn cluster_locations(coords: &[Coordinate], grid_size: f64) -> Vec<LocationCluster> {
    let mut grid: HashMap<(i64, i64), Vec<Coordinate>> = HashMap::new();
    for coord in coords {
        let lat_idx = (coord.latitude / grid_size).floor() as i64;
        let lon_idx = (coord.longitude / grid_size).floor() as i64;
        grid.entry((lat_idx, lon_idx))
            .or_insert_with(Vec::new)
            .push(coord.clone());
    }
    grid.into_iter()
        .enumerate()
        .map(|(i, (_key, coords))| LocationCluster {
            cluster_id: i,
            coordinates: coords,
        })
        .collect()
}

/// Reverse geocodes a coordinate using the Nominatim API.
/// Returns the address as a String.
pub async fn reverse_geocode(coord: &Coordinate) -> Result<String, reqwest::Error> {
    let url = format!(
        "https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat={}&lon={}",
        coord.latitude, coord.longitude
    );
    let resp = reqwest::get(&url).await?.json::<serde_json::Value>().await?;
    Ok(resp["display_name"].as_str().unwrap_or("").to_string())
}

/// IPC endpoint: cluster_locations
#[command]
pub async fn ipc_cluster_locations(coords: Vec<Coordinate>, grid_size: f64) -> Vec<LocationCluster> {
    cluster_locations(&coords, grid_size)
}

/// IPC endpoint: reverse_geocode
#[command]
pub async fn ipc_reverse_geocode(coord: Coordinate) -> Result<String, String> {
    reverse_geocode(&coord)
        .await
        .map_err(|e| format!("Reverse geocoding failed: {}", e))
}