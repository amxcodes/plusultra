use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::Write,
    path::PathBuf,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, Manager};
use reqwest::Url;

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

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeDownloadProbe {
    pub final_url: String,
    pub content_type: Option<String>,
    pub content_length: Option<u64>,
    pub source_type: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeDiscoveredSource {
    pub url: String,
    pub source_type: String,
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

    let collapsed = sanitized.split_whitespace().collect::<Vec<_>>().join(" ");

    if collapsed.is_empty() {
        "download".to_string()
    } else {
        collapsed.chars().take(120).collect()
    }
}

fn infer_extension(source_url: &str, content_type: Option<&str>) -> &'static str {
    let lower = source_url
        .split('?')
        .next()
        .unwrap_or(source_url)
        .to_ascii_lowercase();

    if lower.ends_with(".m3u8") || content_type.is_some_and(|value| value.contains("mpegurl")) {
        "ts"
    } else if lower.ends_with(".mpd") {
        "mpd"
    } else if lower.ends_with(".webm") || content_type.is_some_and(|value| value.contains("webm")) {
        "webm"
    } else if lower.ends_with(".mkv")
        || content_type.is_some_and(|value| value.contains("matroska"))
    {
        "mkv"
    } else {
        "mp4"
    }
}

#[derive(Clone, Debug)]
struct HlsSegment {
    url: String,
    byte_range: Option<String>,
}

#[derive(Clone, Debug)]
struct HlsMediaPlaylist {
    playlist_url: String,
    init_segment: Option<HlsSegment>,
    segments: Vec<HlsSegment>,
}

fn parse_attribute_value(line: &str, key: &str) -> Option<String> {
    let marker = format!("{key}=");
    let start = line.find(&marker)? + marker.len();
    let rest = &line[start..];
    if let Some(stripped) = rest.strip_prefix('"') {
        return stripped.split('"').next().map(|value| value.to_string());
    }

    rest.split(',').next().map(|value| value.trim().to_string())
}

fn parse_bandwidth(line: &str) -> u64 {
    parse_attribute_value(line, "BANDWIDTH")
        .and_then(|value| value.parse::<u64>().ok())
        .unwrap_or_default()
}

fn resolve_url(base_url: &str, value: &str) -> Result<String, String> {
    Url::parse(base_url)
        .map_err(|error| format!("Invalid playlist URL: {error}"))?
        .join(value.trim())
        .map(|url| url.to_string())
        .map_err(|error| format!("Invalid segment URL: {error}"))
}

fn select_hls_variant(playlist_url: &str, playlist: &str) -> Result<Option<String>, String> {
    let mut best: Option<(u64, String)> = None;
    let mut pending_bandwidth: Option<u64> = None;

    for line in playlist.lines().map(str::trim).filter(|line| !line.is_empty()) {
        if line.starts_with("#EXT-X-STREAM-INF") {
            pending_bandwidth = Some(parse_bandwidth(line));
            continue;
        }

        if line.starts_with('#') {
            continue;
        }

        if let Some(bandwidth) = pending_bandwidth.take() {
            let resolved = resolve_url(playlist_url, line)?;
            if best.as_ref().is_none_or(|(current, _)| bandwidth > *current) {
                best = Some((bandwidth, resolved));
            }
        }
    }

    Ok(best.map(|(_, url)| url))
}

fn parse_hls_media_playlist(playlist_url: &str, playlist: &str) -> Result<HlsMediaPlaylist, String> {
    let mut segments = Vec::new();
    let mut init_segment = None;
    let mut next_byte_range: Option<String> = None;

    for line in playlist.lines().map(str::trim).filter(|line| !line.is_empty()) {
        if line.starts_with("#EXT-X-KEY") {
            let method = parse_attribute_value(line, "METHOD").unwrap_or_default();
            if !method.eq_ignore_ascii_case("NONE") {
                return Err("This HLS stream is encrypted. Offline saving is limited to unencrypted HLS media.".to_string());
            }
            continue;
        }

        if line.starts_with("#EXT-X-MAP") {
            if let Some(uri) = parse_attribute_value(line, "URI") {
                init_segment = Some(HlsSegment {
                    url: resolve_url(playlist_url, &uri)?,
                    byte_range: parse_attribute_value(line, "BYTERANGE"),
                });
            }
            continue;
        }

        if line.starts_with("#EXT-X-BYTERANGE") {
            next_byte_range = line
                .split_once(':')
                .map(|(_, value)| value.trim().to_string());
            continue;
        }

        if line.starts_with('#') {
            continue;
        }

        segments.push(HlsSegment {
            url: resolve_url(playlist_url, line)?,
            byte_range: next_byte_range.take(),
        });
    }

    if segments.is_empty() {
        return Err("This HLS playlist did not expose media segments.".to_string());
    }

    Ok(HlsMediaPlaylist {
        playlist_url: playlist_url.to_string(),
        init_segment,
        segments,
    })
}

fn source_type(url: &str, content_type: Option<&str>) -> &'static str {
    let lower_url = url.to_ascii_lowercase();
    let lower_type = content_type.unwrap_or_default().to_ascii_lowercase();

    if lower_url.contains(".m3u8") || lower_type.contains("mpegurl") {
        "m3u8"
    } else if lower_url.contains(".mpd") || lower_type.contains("dash+xml") {
        "mpd"
    } else if lower_url.contains(".webm") || lower_type.contains("webm") {
        "webm"
    } else if lower_url.contains(".mkv") || lower_type.contains("matroska") {
        "mkv"
    } else if lower_url.contains(".mp4")
        || lower_type.contains("mp4")
        || lower_type.starts_with("video/")
    {
        "mp4"
    } else {
        "unknown"
    }
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

#[cfg(test)]
mod tests {
    use super::{is_internal_app_url, source_type};

    #[test]
    fn does_not_treat_a_script_url_as_media() {
        assert_eq!(
            source_type("https://www.googletagmanager.com/gtag/js?id=G-123", None),
            "unknown"
        );
    }

    #[test]
    fn recognizes_a_direct_video_url() {
        assert_eq!(
            source_type("https://cdn.example.test/video.mp4?token=abc", None),
            "mp4"
        );
    }

    #[test]
    fn rejects_tauri_internal_ipc_urls() {
        assert!(is_internal_app_url("http://ipc.localhost/tauri_discover_offline_sources"));
    }
}

fn looks_like_html(sample: &[u8], content_type: Option<&str>) -> bool {
    let normalized_type = content_type.unwrap_or_default().to_ascii_lowercase();
    if normalized_type.contains("text/html") || normalized_type.contains("application/xhtml") {
        return true;
    }

    let text = String::from_utf8_lossy(sample)
        .trim_start()
        .to_ascii_lowercase();
    text.starts_with("<!doctype html") || text.starts_with("<html") || text.starts_with("<head")
}

fn is_direct_media(
    content_type: Option<&str>,
    content_disposition: Option<&str>,
    final_url: &str,
) -> bool {
    let normalized_type = content_type.unwrap_or_default().to_ascii_lowercase();
    let normalized_disposition = content_disposition.unwrap_or_default().to_ascii_lowercase();
    let lower_url = final_url.to_ascii_lowercase();

    normalized_type.starts_with("video/")
        || normalized_type.starts_with("audio/")
        || normalized_type == "application/octet-stream"
        || normalized_disposition.contains("attachment")
        || [".mp4", ".m4v", ".webm", ".mkv", ".mov"]
            .iter()
            .any(|extension| lower_url.contains(extension))
}

fn collect_direct_media_urls(document: &str) -> Vec<NativeDiscoveredSource> {
    let normalized = document
        .replace("\\/", "/")
        .replace("\\u0026", "&")
        .replace("&amp;", "&");
    let mut remaining = normalized.as_str();
    let mut results = Vec::new();

    while let Some(start) = [remaining.find("https://"), remaining.find("http://")]
        .into_iter()
        .flatten()
        .min()
    {
        let candidate = &remaining[start..];
        let end = candidate
            .find(|character: char| {
                matches!(
                    character,
                    '"' | '\'' | '`' | '<' | '>' | '\\' | ' ' | '\n' | '\r'
                )
            })
            .unwrap_or(candidate.len());
        let url = candidate[..end]
            .trim_end_matches([')', ',', ';'])
            .to_string();
        if is_internal_app_url(&url) {
            remaining = &candidate[end..];
            if remaining.is_empty() {
                break;
            }
            continue;
        }
        let kind = source_type(&url, None);

        if matches!(kind, "mp4" | "webm" | "mkv" | "m3u8" | "mpd")
            && !results
                .iter()
                .any(|entry: &NativeDiscoveredSource| entry.url == url)
        {
            results.push(NativeDiscoveredSource {
                url,
                source_type: kind.to_string(),
            });
        }

        remaining = &candidate[end..];
        if remaining.is_empty() {
            break;
        }
    }

    results.into_iter().take(12).collect()
}

#[tauri::command]
pub async fn tauri_discover_offline_sources(
    source_url: String,
) -> Result<Vec<NativeDiscoveredSource>, String> {
    if is_internal_app_url(&source_url) {
        return Ok(Vec::new());
    }

    let client = reqwest::Client::builder()
        .user_agent("PlusUltraTauri/1.0")
        .redirect(reqwest::redirect::Policy::limited(8))
        .build()
        .map_err(|error| error.to_string())?;
    let response = client
        .get(source_url)
        .send()
        .await
        .map_err(|error| format!("Could not inspect provider document: {error}"))?;

    if !response.status().is_success() {
        return Err(format!("Provider document returned {}", response.status()));
    }

    if response.content_length().unwrap_or_default() > 2_000_000 {
        return Ok(Vec::new());
    }

    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default()
        .to_ascii_lowercase();
    if !content_type.is_empty()
        && !content_type.contains("html")
        && !content_type.contains("javascript")
    {
        return Ok(Vec::new());
    }

    let body = response.text().await.map_err(|error| error.to_string())?;
    Ok(collect_direct_media_urls(&body))
}

async fn probe_download_source(source_url: &str) -> Result<NativeDownloadProbe, String> {
    if is_internal_app_url(source_url) {
        return Err("Internal app bridge URLs cannot be saved offline.".to_string());
    }

    let client = reqwest::Client::builder()
        .user_agent("PlusUltraTauri/1.0")
        .redirect(reqwest::redirect::Policy::limited(8))
        .build()
        .map_err(|error| error.to_string())?;

    let mut response = client
        .get(source_url)
        .header(reqwest::header::RANGE, "bytes=0-4095")
        .send()
        .await
        .map_err(|error| format!("Could not reach the download source: {error}"))?;

    if !response.status().is_success() && response.status() != reqwest::StatusCode::PARTIAL_CONTENT
    {
        return Err(format!("Download source returned {}", response.status()));
    }

    let final_url = response.url().to_string();
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .map(|value| value.to_string());
    let content_disposition = response
        .headers()
        .get(reqwest::header::CONTENT_DISPOSITION)
        .and_then(|value| value.to_str().ok())
        .map(|value| value.to_string());
    let content_length = response.content_length();
    let sample = response
        .chunk()
        .await
        .map_err(|error| format!("Could not inspect the download response: {error}"))?
        .unwrap_or_default();

    if looks_like_html(&sample, content_type.as_deref()) {
        return Err("This server returned a player page, not a direct media file. Start playback and select a detected direct source instead.".to_string());
    }

    let detected_type = source_type(&final_url, content_type.as_deref());
    if detected_type == "m3u8" {
        return Ok(NativeDownloadProbe {
            final_url,
            content_type,
            content_length,
            source_type: detected_type.to_string(),
        });
    }

    if detected_type == "mpd" {
        return Err("DASH manifests are detected, but offline saving currently supports direct files and unencrypted HLS.".to_string());
    }

    if !is_direct_media(
        content_type.as_deref(),
        content_disposition.as_deref(),
        &final_url,
    ) {
        return Err("The source does not identify itself as downloadable media. It was not saved to avoid capturing a web page.".to_string());
    }

    Ok(NativeDownloadProbe {
        final_url,
        content_type,
        content_length,
        source_type: detected_type.to_string(),
    })
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
pub async fn tauri_probe_offline_download(
    source_url: String,
) -> Result<NativeDownloadProbe, String> {
    probe_download_source(&source_url).await
}

#[tauri::command]
pub async fn tauri_start_offline_download(
    app: AppHandle,
    request: DownloadRequest,
) -> Result<NativeDownloadEntry, String> {
    let probe = probe_download_source(&request.source_url).await?;
    let id = format!("tauri-{}", now_millis());
    let file_name = format!(
        "{}-{}.{}",
        sanitize_name(&request.title),
        id,
        infer_extension(&probe.final_url, probe.content_type.as_deref())
    );
    let file_path = library_dir(&app)?.join(file_name);

    let entry = NativeDownloadEntry {
        id: id.clone(),
        title: request.title,
        source_url: probe.final_url.clone(),
        file_path: file_path.to_string_lossy().to_string(),
        status: "downloading".to_string(),
        created_at: now_millis(),
        completed_at: None,
        bytes_received: Some(0),
        total_bytes: probe.content_length,
        file_size: None,
        mime_type: probe.content_type.clone(),
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
    let source_url = probe.final_url;
    let source_type = probe.source_type.clone();
    tauri::async_runtime::spawn(async move {
        let result = if source_type == "m3u8" {
            download_hls_stream(download_app.clone(), id.clone(), source_url, file_path).await
        } else {
            download_stream(download_app.clone(), id.clone(), source_url, file_path).await
        };

        if let Err(message) = result {
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
pub fn tauri_remove_offline_download(
    app: AppHandle,
    id: String,
) -> Result<Vec<NativeDownloadEntry>, String> {
    let mut catalog = read_catalog(&app)?;
    if let Some(entry) = catalog.iter().find(|entry| entry.id == id) {
        let _ = fs::remove_file(&entry.file_path);
    }
    catalog.retain(|entry| entry.id != id);
    write_catalog(&app, &catalog)?;
    emit_catalog(&app);
    Ok(catalog)
}

async fn fetch_playlist_text(client: &reqwest::Client, url: &str) -> Result<String, String> {
    let response = client
        .get(url)
        .send()
        .await
        .map_err(|error| format!("Could not fetch HLS playlist: {error}"))?;

    if !response.status().is_success() {
        return Err(format!("HLS playlist returned {}", response.status()));
    }

    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .map(|value| value.to_string());
    let text = response
        .text()
        .await
        .map_err(|error| format!("Could not read HLS playlist: {error}"))?;

    if looks_like_html(text.as_bytes(), content_type.as_deref()) {
        return Err("This source returned a page instead of an HLS playlist.".to_string());
    }

    if !text.contains("#EXTM3U") {
        return Err("This source is not a valid HLS playlist.".to_string());
    }

    Ok(text)
}

fn hls_range_header(byte_range: Option<&str>) -> Result<Option<String>, String> {
    let Some(byte_range) = byte_range else {
        return Ok(None);
    };
    let Some((length, offset)) = byte_range.split_once('@') else {
        return Err("This HLS playlist uses relative byte ranges, which cannot be saved safely yet.".to_string());
    };
    let length = length
        .trim()
        .parse::<u64>()
        .map_err(|_| "Invalid HLS byte range length.".to_string())?;
    let offset = offset
        .trim()
        .parse::<u64>()
        .map_err(|_| "Invalid HLS byte range offset.".to_string())?;
    let end = offset.saturating_add(length).saturating_sub(1);
    Ok(Some(format!("bytes={offset}-{end}")))
}

async fn append_hls_segment(
    client: &reqwest::Client,
    file: &mut fs::File,
    segment: &HlsSegment,
) -> Result<u64, String> {
    let mut request = client.get(&segment.url);
    if let Some(range) = hls_range_header(segment.byte_range.as_deref())? {
        request = request.header(reqwest::header::RANGE, range);
    }

    let mut response = request
        .send()
        .await
        .map_err(|error| format!("Could not fetch HLS segment: {error}"))?;

    if !response.status().is_success() && response.status() != reqwest::StatusCode::PARTIAL_CONTENT
    {
        return Err(format!("HLS segment returned {}", response.status()));
    }

    let mut written = 0_u64;
    while let Some(chunk) = response.chunk().await.map_err(|error| error.to_string())? {
        file.write_all(&chunk).map_err(|error| error.to_string())?;
        written += chunk.len() as u64;
    }

    Ok(written)
}

async fn download_hls_stream(
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

    let mut playlist_url = source_url;
    let mut playlist = fetch_playlist_text(&client, &playlist_url).await?;
    if let Some(variant_url) = select_hls_variant(&playlist_url, &playlist)? {
        playlist_url = variant_url;
        playlist = fetch_playlist_text(&client, &playlist_url).await?;
    }

    let media = parse_hls_media_playlist(&playlist_url, &playlist)?;
    patch_entry(&app, &id, |entry| {
        entry.mime_type = Some("video/mp2t".to_string());
        entry.message = Some(format!(
            "Saving {} HLS segments from {}",
            media.segments.len(),
            media.playlist_url
        ));
    })?;

    let mut file = fs::File::create(&file_path).map_err(|error| error.to_string())?;
    let mut bytes_received = 0_u64;
    let total_segments = media.segments.len() + usize::from(media.init_segment.is_some());
    let mut completed_segments = 0_usize;

    if let Some(init_segment) = media.init_segment {
        bytes_received += append_hls_segment(&client, &mut file, &init_segment).await?;
        completed_segments += 1;
        patch_entry(&app, &id, |entry| {
            entry.bytes_received = Some(bytes_received);
            entry.message = Some(format!(
                "Saved {completed_segments}/{total_segments} HLS segments"
            ));
        })?;
    }

    for segment in media.segments {
        bytes_received += append_hls_segment(&client, &mut file, &segment).await?;
        completed_segments += 1;

        if completed_segments % 3 == 0 || completed_segments == total_segments {
            patch_entry(&app, &id, |entry| {
                entry.bytes_received = Some(bytes_received);
                entry.message = Some(format!(
                    "Saved {completed_segments}/{total_segments} HLS segments"
                ));
            })?;
        }
    }

    file.flush().map_err(|error| error.to_string())?;

    patch_entry(&app, &id, |entry| {
        entry.status = "completed".to_string();
        entry.completed_at = Some(now_millis());
        entry.bytes_received = Some(bytes_received);
        entry.total_bytes = Some(bytes_received);
        entry.file_size = Some(bytes_received);
        entry.mime_type = Some("video/mp2t".to_string());
        entry.message = None;
    })
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

    let first_chunk = response
        .chunk()
        .await
        .map_err(|error| error.to_string())?
        .unwrap_or_default();
    if looks_like_html(&first_chunk, mime_type.as_deref()) {
        return Err("The server returned HTML instead of media; download cancelled.".to_string());
    }

    patch_entry(&app, &id, |entry| {
        entry.total_bytes = total_bytes;
        entry.mime_type = mime_type.clone();
    })?;

    let mut file = fs::File::create(&file_path).map_err(|error| error.to_string())?;
    file.write_all(&first_chunk)
        .map_err(|error| error.to_string())?;
    let mut bytes_received = first_chunk.len() as u64;
    let mut last_emitted = 0_u64;

    while let Some(chunk) = response.chunk().await.map_err(|error| error.to_string())? {
        file.write_all(&chunk).map_err(|error| error.to_string())?;
        bytes_received += chunk.len() as u64;

        if bytes_received.saturating_sub(last_emitted) >= 524_288
            || Some(bytes_received) == total_bytes
        {
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
