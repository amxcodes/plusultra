mod downloads;
mod media_capture;
mod shield;

use tauri::{
    webview::{NewWindowResponse, WebviewWindowBuilder},
    LogicalSize, Manager, Size, WebviewUrl,
};

#[tauri::command]
fn tauri_enter_compact_player(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(existing) = app.get_webview_window("mini-player") {
        let _ = existing.close();
    }

    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Main window is not available.".to_string())?;

    window
        .set_min_size(Some(Size::Logical(LogicalSize {
            width: 420.0,
            height: 236.0,
        })))
        .map_err(|error| error.to_string())?;
    window
        .set_size(Size::Logical(LogicalSize {
            width: 520.0,
            height: 292.0,
        }))
        .map_err(|error| error.to_string())?;
    window
        .set_always_on_top(true)
        .map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())?;

    Ok(())
}

#[tauri::command]
fn tauri_restore_player_window(app: tauri::AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Main window is not available.".to_string())?;

    window
        .set_always_on_top(false)
        .map_err(|error| error.to_string())?;
    window
        .set_min_size(Some(Size::Logical(LogicalSize {
            width: 960.0,
            height: 620.0,
        })))
        .map_err(|error| error.to_string())?;
    window
        .set_size(Size::Logical(LogicalSize {
            width: 1280.0,
            height: 820.0,
        }))
        .map_err(|error| error.to_string())?;
    window.center().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())?;

    Ok(())
}

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
            tauri_enter_compact_player,
            tauri_restore_player_window,
        ])
        .setup(|app| {
            let entry_url = format!("index.html?desktopBuild={}", env!("CARGO_PKG_VERSION"));

            WebviewWindowBuilder::new(app, "main", WebviewUrl::App(entry_url.into()))
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
