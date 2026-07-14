mod downloads;
mod media_capture;
mod shield;

use tauri::{
    webview::{NewWindowResponse, WebviewWindowBuilder},
    WebviewUrl,
};

pub fn run() {
    tauri::Builder::default()
        .manage(media_capture::MediaCaptureState::default())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            downloads::tauri_list_offline_downloads,
            downloads::tauri_discover_offline_sources,
            downloads::tauri_probe_offline_download,
            downloads::tauri_start_offline_download,
            downloads::tauri_remove_offline_download,
            media_capture::tauri_start_media_capture,
            media_capture::tauri_stop_media_capture,
            media_capture::tauri_get_captured_media,
        ])
        .setup(|app| {
            WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("Plus Ultra")
                .inner_size(1280.0, 820.0)
                .min_inner_size(960.0, 620.0)
                .resizable(true)
                .on_navigation(|url| !shield::should_block_url(url))
                .on_new_window(|url, _features| {
                    if shield::should_block_url(&url) {
                        return NewWindowResponse::Deny;
                    }

                    NewWindowResponse::Deny
                })
                .build()?;

            media_capture::install(app.handle().clone()).map_err(std::io::Error::other)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Plus Ultra");
}
