mod ai;
mod commands;

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
        .invoke_handler(tauri::generate_handler![
            commands::choose_workspace_directory,
            commands::read_workspace_tree,
            commands::create_workspace_entry,
            commands::rename_workspace_entry,
            commands::move_workspace_entry,
            commands::delete_workspace_entry,
            commands::write_text_file,
            commands::read_text_file,
            commands::save_text_file,
            commands::open_text_file,
            commands::save_binary_file,
            commands::copy_image_to_clipboard,
            ai::load_ai_settings,
            ai::save_ai_settings,
            ai::generate_ai_mermaid,
            ai::generate_ai_mermaid_stream,
            ai::test_ai_connection
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
