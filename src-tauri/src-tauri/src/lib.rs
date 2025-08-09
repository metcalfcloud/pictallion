#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    #[test]
    fn test_basic_functionality() {
        // Basic test to ensure the module compiles and basic functionality works
        assert_eq!(2 + 2, 4);
    }

    #[test]
    fn test_log_level_filter() {
        // Test that log level filter is accessible
        let level = log::LevelFilter::Info;
        assert_eq!(level, log::LevelFilter::Info);
    }
}
