use serde::{Deserialize, Serialize};
use std::{collections::HashMap, sync::Mutex};
use tauri::{AppHandle, Emitter, Manager};

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaCaptureSession {
    pub tmdb_id: String,
    pub media_type: String,
    pub season: Option<u32>,
    pub episode: Option<u32>,
    pub provider_id: String,
    pub provider_name: String,
    pub title: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CapturedMedia {
    pub url: String,
    pub resource_type: String,
    pub timestamp: u64,
    pub capture_key: String,
    pub media: CapturedMediaSession,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CapturedMediaSession {
    pub key: String,
    #[serde(flatten)]
    pub session: MediaCaptureSession,
}

#[derive(Default)]
pub struct MediaCaptureState {
    active: Mutex<Option<ActiveCapture>>,
    captures: Mutex<HashMap<String, Vec<CapturedMedia>>>,
}

#[derive(Clone)]
struct ActiveCapture {
    key: String,
    session: MediaCaptureSession,
}

fn timestamp() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or_default()
}

fn new_key() -> String {
    format!("capture-{}", timestamp())
}

pub fn record_media_request(app: &AppHandle, url: String) {
    if !(url.starts_with("https://") || url.starts_with("http://")) {
        return;
    }

    let state = app.state::<MediaCaptureState>();
    let active = match state.active.lock() {
        Ok(active) => active.clone(),
        Err(_) => return,
    };
    let Some(active) = active else {
        return;
    };

    let item = CapturedMedia {
        url: url.clone(),
        resource_type: "media".to_string(),
        timestamp: timestamp(),
        capture_key: active.key.clone(),
        media: CapturedMediaSession {
            key: active.key.clone(),
            session: active.session,
        },
    };

    let inserted = match state.captures.lock() {
        Ok(mut captures) => {
            let entries = captures.entry(item.capture_key.clone()).or_default();
            if entries.iter().any(|entry| entry.url == item.url) || entries.len() >= 24 {
                false
            } else {
                entries.push(item.clone());
                true
            }
        }
        Err(_) => false,
    };

    if inserted {
        let _ = app.emit("tauri-captured-media", item);
    }
}

#[tauri::command]
pub fn tauri_start_media_capture(
    app: AppHandle,
    session_info: MediaCaptureSession,
) -> Result<serde_json::Value, String> {
    let key = new_key();
    let state = app.state::<MediaCaptureState>();

    *state.active.lock().map_err(|error| error.to_string())? = Some(ActiveCapture {
        key: key.clone(),
        session: session_info,
    });
    state
        .captures
        .lock()
        .map_err(|error| error.to_string())?
        .insert(key.clone(), Vec::new());
    let _ = app.emit(
        "tauri-captured-media-reset",
        serde_json::json!({ "captureKey": key }),
    );

    Ok(serde_json::json!({ "ok": true, "captureKey": key }))
}

#[tauri::command]
pub fn tauri_stop_media_capture(
    app: AppHandle,
    capture_key: String,
) -> Result<serde_json::Value, String> {
    let state = app.state::<MediaCaptureState>();
    let mut active = state.active.lock().map_err(|error| error.to_string())?;
    if active
        .as_ref()
        .is_some_and(|entry| entry.key == capture_key)
    {
        *active = None;
    }
    Ok(serde_json::json!({ "ok": true }))
}

#[tauri::command]
pub fn tauri_get_captured_media(
    app: AppHandle,
    capture_key: String,
) -> Result<Vec<CapturedMedia>, String> {
    let state = app.state::<MediaCaptureState>();
    let entries = state
        .captures
        .lock()
        .map_err(|error| error.to_string())?
        .get(&capture_key)
        .cloned()
        .unwrap_or_default();
    Ok(entries)
}

#[cfg(windows)]
pub fn install(app: AppHandle) -> Result<(), String> {
    use tauri::Manager;
    use webview2_com::Microsoft::Web::WebView2::Win32::COREWEBVIEW2_WEB_RESOURCE_CONTEXT_MEDIA;
    use webview2_com::{take_pwstr, WebResourceRequestedEventHandler};
    use windows::core::{HSTRING, PWSTR};

    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Main webview is unavailable.".to_string())?;

    window
        .with_webview(move |platform_webview| {
            let app = app.clone();
            unsafe {
                let Ok(webview) = platform_webview.controller().CoreWebView2() else {
                    return;
                };
                let filter = HSTRING::from("*");
                if webview
                    .AddWebResourceRequestedFilter(&filter, COREWEBVIEW2_WEB_RESOURCE_CONTEXT_MEDIA)
                    .is_err()
                {
                    return;
                }

                let mut token = 0;
                let _ = webview.add_WebResourceRequested(
                    &WebResourceRequestedEventHandler::create(Box::new(move |_, args| {
                        let Some(args) = args else {
                            return Ok(());
                        };
                        let request = args.Request()?;
                        let mut uri = PWSTR::null();
                        request.Uri(&mut uri)?;
                        let url = take_pwstr(uri);
                        record_media_request(&app, url);
                        Ok(())
                    })),
                    &mut token,
                );
            }
        })
        .map_err(|error| error.to_string())?;

    Ok(())
}

#[cfg(not(windows))]
pub fn install(_app: AppHandle) -> Result<(), String> {
    Ok(())
}
