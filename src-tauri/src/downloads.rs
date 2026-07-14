use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::Write,
    path::PathBuf,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, Manager};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadRequest {
    pub source_url: String,
    pub title: String,
    pub tmdb_id: Option<u64>,
    pub media_type: Option<String>,
    pub season: Option<u32>,
    pub episode: Option<u32>,
    pub provider_id: Option<String>,
    pub provider_name: Option<String>,
    pub image_url: Option<String>,
    pub backdrop_url: Option<String>,
    pub description: Option<String>,
    pub year: Option<u32>,
    pub genre: Option<Vec<String>>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeDownloadEntry {
    pub id: String,
    pub title: String,
    pub source_url: String,
    pub file_path: String,
    pub status: String,
    pub created_at: u64,
    pub completed_at: Option<u64>,
    pub bytes_received: Option<u64>,
    pub total_bytes: Option<u64>,
    pub file_size: Option<u64>,
    pub mime_type: Option<String>,
    pub message: Option<String>,
    pub tmdb_id: Option<u64>,
    pub media_type: Option<String>,
    pub season: Option<u32>,
    pub episode: Option<u32>,
    pub provider_id: Option<String>,
    pub provider_name: Option<String>,
    pub image_url: Option<String>,
    pub backdrop_url: Option<String>,
    pub description: Option<String>,
    pub year: Option<u32>,
    pub genre: Option<Vec<String>>,
}

fn library_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("offline-library");
    fs::create_dir_all(&base).map_err(|error| error.to_string())?;
    Ok(base)
}

fn catalog_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(library_dir(app)?.join("catalog.json"))
}

fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or_default()
}

fn sanitize_name(value: &str) -> String {
    let sanitized: String = value
        .chars()
        .map(|ch| match ch {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => ' ',
            ch if ch.is_control() => ' ',
            ch => ch,
        })
        .collect();

    let collapsed = sanitized
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");

    if collapsed.is_empty() {
        "download".to_string()
    } else {
        collapsed.chars().take(120).collect()
    }
}

fn infer_extension(source_url: &str) -> &'static str {
    let lower = source_url
        .split('?')
        .next()
        .unwrap_or(source_url)
        .to_ascii_lowercase();

    if lower.ends_with(".m3u8") {
        "m3u8"
    } else if lower.ends_with(".mpd") {
        "mpd"
    } else if lower.ends_with(".webm") {
        "webm"
    } else if lower.ends_with(".mkv") {
        "mkv"
    } else {
        "mp4"
    }
}

fn read_catalog(app: &AppHandle) -> Result<Vec<NativeDownloadEntry>, String> {
    let path = catalog_path(app)?;
    if !path.exists() {
        return Ok(Vec::new());
    }

    let text = fs::read_to_string(path).map_err(|error| error.to_string())?;
    serde_json::from_str(&text).map_err(|error| error.to_string())
}

fn write_catalog(app: &AppHandle, entries: &[NativeDownloadEntry]) -> Result<(), String> {
    let path = catalog_path(app)?;
    let text = serde_json::to_string_pretty(entries).map_err(|error| error.to_string())?;
    fs::write(path, text).map_err(|error| error.to_string())
}

fn emit_catalog(app: &AppHandle) {
    if let Ok(entries) = read_catalog(app) {
        let _ = app.emit("tauri-offline-downloads-changed", entries);
    }
}

fn patch_entry<F>(app: &AppHandle, id: &str, patch: F) -> Result<(), String>
where
    F: FnOnce(&mut NativeDownloadEntry),
{
    let mut catalog = read_catalog(app)?;
    if let Some(entry) = catalog.iter_mut().find(|entry| entry.id == id) {
        patch(entry);
        write_catalog(app, &catalog)?;
        emit_catalog(app);
    }
    Ok(())
}

#[tauri::command]
pub fn tauri_list_offline_downloads(app: AppHandle) -> Result<Vec<NativeDownloadEntry>, String> {
    read_catalog(&app)
}

#[tauri::command]
pub async fn tauri_start_offline_download(
    app: AppHandle,
    request: DownloadRequest,
) -> Result<NativeDownloadEntry, String> {
    let id = format!("tauri-{}", now_millis());
    let file_name = format!(
        "{}-{}.{}",
        sanitize_name(&request.title),
        id,
        infer_extension(&request.source_url)
    );
    let file_path = library_dir(&app)?.join(file_name);

    let entry = NativeDownloadEntry {
        id: id.clone(),
        title: request.title,
        source_url: request.source_url.clone(),
        file_path: file_path.to_string_lossy().to_string(),
        status: "downloading".to_string(),
        created_at: now_millis(),
        completed_at: None,
        bytes_received: Some(0),
        total_bytes: None,
        file_size: None,
        mime_type: None,
        message: None,
        tmdb_id: request.tmdb_id,
        media_type: request.media_type,
        season: request.season,
        episode: request.episode,
        provider_id: request.provider_id,
        provider_name: request.provider_name,
        image_url: request.image_url,
        backdrop_url: request.backdrop_url,
        description: request.description,
        year: request.year,
        genre: request.genre,
    };

    let mut catalog = read_catalog(&app)?;
    catalog.insert(0, entry.clone());
    write_catalog(&app, &catalog)?;
    emit_catalog(&app);

    let download_app = app.clone();
    let source_url = request.source_url.clone();
    tauri::async_runtime::spawn(async move {
        if let Err(message) = download_stream(download_app.clone(), id.clone(), source_url, file_path).await {
            let _ = fs::remove_file(
                read_catalog(&download_app)
                    .ok()
                    .and_then(|entries| entries.into_iter().find(|entry| entry.id == id))
                    .map(|entry| entry.file_path)
                    .unwrap_or_default(),
            );
            let _ = patch_entry(&download_app, &id, |entry| {
                entry.status = "failed".to_string();
                entry.message = Some(message);
            });
        }
    });

    Ok(entry)
}

#[tauri::command]
pub fn tauri_remove_offline_download(app: AppHandle, id: String) -> Result<Vec<NativeDownloadEntry>, String> {
    let mut catalog = read_catalog(&app)?;
    if let Some(entry) = catalog.iter().find(|entry| entry.id == id) {
        let _ = fs::remove_file(&entry.file_path);
    }
    catalog.retain(|entry| entry.id != id);
    write_catalog(&app, &catalog)?;
    emit_catalog(&app);
    Ok(catalog)
}

async fn download_stream(
    app: AppHandle,
    id: String,
    source_url: String,
    file_path: PathBuf,
) -> Result<(), String> {
    let client = reqwest::Client::builder()
        .user_agent("PlusUltraTauri/1.0")
        .redirect(reqwest::redirect::Policy::limited(8))
        .build()
        .map_err(|error| error.to_string())?;

    let mut response = client
        .get(source_url)
        .send()
        .await
        .map_err(|error| error.to_string())?;

    if !response.status().is_success() {
        return Err(format!("Download failed with status {}", response.status()));
    }

    let total_bytes = response.content_length();
    let mime_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .map(|value| value.to_string());

    patch_entry(&app, &id, |entry| {
        entry.total_bytes = total_bytes;
        entry.mime_type = mime_type.clone();
    })?;

    let mut file = fs::File::create(&file_path).map_err(|error| error.to_string())?;
    let mut bytes_received = 0_u64;
    let mut last_emitted = 0_u64;

    while let Some(chunk) = response.chunk().await.map_err(|error| error.to_string())? {
        file.write_all(&chunk).map_err(|error| error.to_string())?;
        bytes_received += chunk.len() as u64;

        if bytes_received.saturating_sub(last_emitted) >= 524_288 || Some(bytes_received) == total_bytes {
            last_emitted = bytes_received;
            patch_entry(&app, &id, |entry| {
                entry.bytes_received = Some(bytes_received);
                entry.total_bytes = total_bytes;
            })?;
        }
    }

    file.flush().map_err(|error| error.to_string())?;

    patch_entry(&app, &id, |entry| {
        entry.status = "completed".to_string();
        entry.completed_at = Some(now_millis());
        entry.bytes_received = Some(bytes_received);
        entry.total_bytes = total_bytes.or(Some(bytes_received));
        entry.file_size = Some(bytes_received);
        entry.message = None;
    })
}
