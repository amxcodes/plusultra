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
    pub mime_type: Option<String>,
    pub status_code: Option<u16>,
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

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CdpResponseReceived {
    #[serde(default)]
    r#type: String,
    response: CdpResponse,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CdpResponse {
    url: String,
    #[serde(default)]
    status: u16,
    #[serde(default)]
    mime_type: String,
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

fn is_internal_app_url(url: &str) -> bool {
    let lower = url.to_ascii_lowercase();
    lower.starts_with("http://ipc.localhost/")
        || lower.starts_with("https://ipc.localhost/")
        || lower.starts_with("tauri://")
        || lower.contains("/tauri_")
        || lower.contains("127.0.0.1")
        || lower.contains("localhost")
}

fn source_type(url: &str, mime_type: Option<&str>) -> &'static str {
    let lower_url = url.to_ascii_lowercase();
    let lower_type = mime_type.unwrap_or_default().to_ascii_lowercase();

    if lower_url.contains(".m3u8")
        || lower_type.contains("mpegurl")
        || lower_type.contains("vnd.apple.mpegurl")
    {
        "hls"
    } else if lower_url.contains(".mpd") || lower_type.contains("dash+xml") {
        "dash"
    } else if lower_url.contains(".mp4")
        || lower_url.contains(".m4v")
        || lower_type.contains("mp4")
    {
        "video"
    } else if lower_url.contains(".webm") || lower_type.contains("webm") {
        "video"
    } else if lower_url.contains(".mkv") || lower_type.contains("matroska") {
        "video"
    } else if lower_type.starts_with("video/") {
        "video"
    } else if lower_type.starts_with("audio/") {
        "audio"
    } else {
        "unknown"
    }
}

fn should_capture_response(event_type: &str, url: &str, mime_type: Option<&str>) -> bool {
    if is_internal_app_url(url) {
        return false;
    }

    let resource_type = source_type(url, mime_type);
    matches!(resource_type, "video" | "audio" | "hls" | "dash")
        || event_type.eq_ignore_ascii_case("media")
}

fn record_media_event(
    app: &AppHandle,
    url: String,
    resource_type: String,
    mime_type: Option<String>,
    status_code: Option<u16>,
) {
    if !(url.starts_with("https://") || url.starts_with("http://")) {
        return;
    }
    if is_internal_app_url(&url) {
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
        resource_type,
        mime_type,
        status_code,
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

pub fn record_media_request(app: &AppHandle, url: String) {
    let resource_type = source_type(&url, None).to_string();
    if resource_type == "unknown" && !url.to_ascii_lowercase().contains(".m3u8") {
        return;
    }

    record_media_event(app, url, resource_type, None, None);
}

fn record_cdp_response(app: &AppHandle, payload_json: &str) {
    let Ok(payload) = serde_json::from_str::<CdpResponseReceived>(payload_json) else {
        return;
    };

    let mime_type = (!payload.response.mime_type.is_empty()).then_some(payload.response.mime_type);
    if !should_capture_response(&payload.r#type, &payload.response.url, mime_type.as_deref()) {
        return;
    }

    let resource_type = source_type(&payload.response.url, mime_type.as_deref()).to_string();
    record_media_event(
        app,
        payload.response.url,
        resource_type,
        mime_type,
        (payload.response.status > 0).then_some(payload.response.status),
    );
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
    use webview2_com::{
        take_pwstr, CallDevToolsProtocolMethodCompletedHandler,
        DevToolsProtocolEventReceivedEventHandler, WebResourceRequestedEventHandler,
    };
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

                let request_app = app.clone();
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
                        record_media_request(&request_app, url);
                        Ok(())
                    })),
                    &mut token,
                );

                let _ = webview.CallDevToolsProtocolMethod(
                    &HSTRING::from("Network.enable"),
                    &HSTRING::from("{}"),
                    &CallDevToolsProtocolMethodCompletedHandler::create(Box::new(
                        |_, _| Ok(()),
                    )),
                );

                if let Ok(receiver) =
                    webview.GetDevToolsProtocolEventReceiver(&HSTRING::from("Network.responseReceived"))
                {
                    let app = app.clone();
                    let mut cdp_token = 0;
                    let _ = receiver.add_DevToolsProtocolEventReceived(
                        &DevToolsProtocolEventReceivedEventHandler::create(Box::new(
                            move |_, args| {
                                let Some(args) = args else {
                                    return Ok(());
                                };

                                let mut payload = PWSTR::null();
                                args.ParameterObjectAsJson(&mut payload)?;
                                let json = take_pwstr(payload);
                                record_cdp_response(&app, &json);
                                Ok(())
                            },
                        )),
                        &mut cdp_token,
                    );
                }
            }
        })
        .map_err(|error| error.to_string())?;

    Ok(())
}

#[cfg(not(windows))]
pub fn install(_app: AppHandle) -> Result<(), String> {
    Ok(())
}
