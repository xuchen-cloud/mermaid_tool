use aes_gcm_siv::{
    aead::{rand_core::RngCore, Aead, KeyInit, OsRng},
    Aes256GcmSiv, Nonce,
};
use futures_util::StreamExt;
use reqwest::{Client, StatusCode, Url};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::env;
use std::fs;
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

const AI_SETTINGS_FILE_NAME: &str = "ai-settings.json";
const AI_TOKEN_FILE_NAME: &str = "ai-token.bin";
const AI_TOKEN_CONTEXT: &str = "com.xuchen.mermaidtool.ai-plus";
const AI_TOKEN_FILE_MAGIC: &[u8; 4] = b"AIT1";
const AI_TOKEN_NONCE_LEN: usize = 12;
const AI_REQUEST_TIMEOUT_SECS: u64 = 90;
const AI_STREAM_EVENT_NAME: &str = "ai://generate-chunk";
const LEGACY_DEFAULT_SYSTEM_PROMPT_TEMPLATE: &str = "You generate Mermaid code for desktop diagram authoring.\nReturn Mermaid source code only.\nDo not use markdown fences.\nDo not add explanations.\nPrefer flowchart TD unless the user clearly describes actors, messages, or lifelines that fit sequenceDiagram.\nUse ASCII node ids and keep labels human-readable.\nIf existing Mermaid is provided, preserve unchanged structure where possible and return the full updated Mermaid document.";
const DEFAULT_SYSTEM_PROMPT_TEMPLATE: &str = "You generate Mermaid code for desktop diagram authoring.\nReturn Mermaid source code only.\nDo not use markdown fences.\nDo not add explanations.\nPrefer flowchart TD unless the user clearly describes actors, messages, or lifelines that fit sequenceDiagram.\nFor flowchart nodes, do not use HTML tags like <br/> in labels. If a label contains parentheses or dense punctuation, use a quoted label such as A[\"Start (details)\"].\nUse ASCII node ids and keep labels human-readable.\nIf existing Mermaid is provided, preserve unchanged structure where possible and return the full updated Mermaid document.";
const DEFAULT_USER_PROMPT_TEMPLATE: &str = "User request:\n{{prompt}}\n\n{{mode_instruction}}\n\n{{current_diagram_section}}{{repair_section}}";
const LEGACY_DEFAULT_DRAWIO_SYSTEM_PROMPT_TEMPLATE: &str = "You generate draw.io XML for desktop diagram authoring.\nReturn a complete .drawio XML document only.\nThe root element must be <mxfile>.\nDo not use markdown fences.\nDo not add explanations.\nDefault to compressed=\"false\".\nPreserve unaffected pages, cells, ids, geometry, and relationships whenever existing draw.io XML is provided.\nReturn valid XML that draw.io can open and export.";
const LEGACY_DEFAULT_DRAWIO_USER_PROMPT_TEMPLATE: &str =
    "User request:\n{{prompt}}\n\n{{mode_instruction}}\n\n{{current_diagram_section}}{{repair_section}}";
const DEFAULT_DRAWIO_SYSTEM_PROMPT_TEMPLATE: &str = "You generate native draw.io XML for desktop diagram authoring.\nReturn one complete .drawio XML document and nothing else.\nDo not use markdown fences.\nDo not add explanations.\nUse <mxfile compressed=\"false\"> as the root element.\nInclude at least one <diagram> page.\nEach diagram page must contain one <mxGraphModel> with <root><mxCell id=\"0\"/><mxCell id=\"1\" parent=\"0\"/></root>.\nEvery visible shape must be an mxCell with vertex=\"1\", a valid parent, and an <mxGeometry ... as=\"geometry\"/> that includes concrete x, y, width, and height values.\nEvery connector must be an mxCell with edge=\"1\", a valid parent, source, and target, plus <mxGeometry relative=\"1\" as=\"geometry\"/>.\nReturn a non-empty, readable diagram with sensible spacing and minimal overlaps.\nUse stable ASCII ids and simple built-in draw.io styles.\nIf you use a non-rectangular shape, include the matching perimeter style when draw.io expects one.\nIf existing draw.io XML is provided, preserve unaffected pages, cells, ids, geometry, and relationships whenever possible, and edit existing cells instead of recreating them unless necessary.\nDo not return an empty skeleton, placeholder page, or partial fragment.\nReturn XML that draw.io can load, display, edit, and export.\n\nMinimal page skeleton:\n<mxfile compressed=\"false\"><diagram id=\"page-1\" name=\"Page-1\"><mxGraphModel><root><mxCell id=\"0\"/><mxCell id=\"1\" parent=\"0\"/></root></mxGraphModel></diagram></mxfile>";
const DEFAULT_DRAWIO_USER_PROMPT_TEMPLATE: &str =
    "User request:\n{{prompt}}\n\nTask:\n{{mode_instruction}}\n\nLayout requirements:\n- Make the diagram visually readable with a clear top-to-bottom or left-to-right flow unless the user requests another layout.\n- Use concise human-readable labels.\n- If the request is ambiguous, choose standard draw.io flowchart conventions and keep the result simple rather than decorative.\n\n{{current_diagram_section}}{{repair_section}}";

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct AiSettingsFile {
    #[serde(default)]
    enabled: bool,
    #[serde(default)]
    base_url: String,
    #[serde(default)]
    model: String,
    #[serde(default = "default_system_prompt_template")]
    system_prompt_template: String,
    #[serde(default = "default_user_prompt_template")]
    user_prompt_template: String,
    #[serde(default = "default_drawio_system_prompt_template")]
    drawio_system_prompt_template: String,
    #[serde(default = "default_drawio_user_prompt_template")]
    drawio_user_prompt_template: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiSettingsSnapshot {
    enabled: bool,
    base_url: String,
    model: String,
    system_prompt_template: String,
    user_prompt_template: String,
    drawio_system_prompt_template: String,
    drawio_user_prompt_template: String,
    token_configured: bool,
    runtime_supported: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveAiSettingsOptions {
    enabled: bool,
    base_url: String,
    model: String,
    system_prompt_template: Option<String>,
    user_prompt_template: Option<String>,
    drawio_system_prompt_template: Option<String>,
    drawio_user_prompt_template: Option<String>,
    token: Option<String>,
    clear_token: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateAiMermaidOptions {
    prompt: String,
    current_code: Option<String>,
    merge_mode: Option<bool>,
    previous_code: Option<String>,
    validation_error: Option<String>,
    request_token: Option<u32>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateAiMermaidResult {
    mermaid_text: String,
    model: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateAiDrawioOptions {
    prompt: String,
    current_xml: Option<String>,
    merge_mode: Option<bool>,
    previous_xml: Option<String>,
    validation_error: Option<String>,
    request_token: Option<u32>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateAiDrawioResult {
    drawio_xml: String,
    model: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct AiStreamChunkEvent {
    request_token: u32,
    kind: String,
    chunk: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TestAiConnectionOptions {
    base_url: String,
    model: String,
    token: Option<String>,
    use_saved_token: Option<bool>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TestAiConnectionResult {
    ok: bool,
    model: String,
    endpoint_host: String,
    message: String,
}

#[tauri::command]
pub fn load_ai_settings(app: AppHandle) -> Result<AiSettingsSnapshot, String> {
    let file_settings = read_ai_settings_file(&ai_settings_path(&app)?)
        .map_err(|error| log_ai_error("load_ai_settings.read_file", error))?;
    let token_configured = read_ai_token(&app)
        .map_err(|error| log_ai_error("load_ai_settings.read_token", error))?
        .is_some();

    Ok(AiSettingsSnapshot {
        enabled: file_settings.enabled,
        base_url: file_settings.base_url,
        model: file_settings.model,
        system_prompt_template: file_settings.system_prompt_template,
        user_prompt_template: file_settings.user_prompt_template,
        drawio_system_prompt_template: file_settings.drawio_system_prompt_template,
        drawio_user_prompt_template: file_settings.drawio_user_prompt_template,
        token_configured,
        runtime_supported: true,
    })
}

#[tauri::command]
pub fn save_ai_settings(
    app: AppHandle,
    options: SaveAiSettingsOptions,
) -> Result<AiSettingsSnapshot, String> {
    let next_settings = AiSettingsFile {
        enabled: options.enabled,
        base_url: normalize_base_url(&options.base_url),
        model: options.model.trim().to_string(),
        system_prompt_template: normalize_prompt_template(
            options.system_prompt_template.as_deref(),
            DEFAULT_SYSTEM_PROMPT_TEMPLATE,
        ),
        user_prompt_template: normalize_prompt_template(
            options.user_prompt_template.as_deref(),
            DEFAULT_USER_PROMPT_TEMPLATE,
        ),
        drawio_system_prompt_template: normalize_prompt_template(
            options.drawio_system_prompt_template.as_deref(),
            DEFAULT_DRAWIO_SYSTEM_PROMPT_TEMPLATE,
        ),
        drawio_user_prompt_template: normalize_prompt_template(
            options.drawio_user_prompt_template.as_deref(),
            DEFAULT_DRAWIO_USER_PROMPT_TEMPLATE,
        ),
    };
    let next_token = options.token.unwrap_or_default().trim().to_string();
    let clear_token = options.clear_token.unwrap_or(false);

    if next_settings.enabled && next_settings.base_url.is_empty() {
        return Err(log_ai_error(
            "save_ai_settings.validation",
            "AI+ requires an API Base URL when enabled.".into(),
        ));
    }

    if next_settings.enabled && next_settings.model.is_empty() {
        return Err(log_ai_error(
            "save_ai_settings.validation",
            "AI+ requires a model when enabled.".into(),
        ));
    }

    if clear_token {
        clear_ai_token(&app)
            .map_err(|error| log_ai_error("save_ai_settings.clear_token", error))?;
    }

    if !next_token.is_empty() {
        write_ai_token(&app, &next_token)
            .map_err(|error| log_ai_error("save_ai_settings.write_token", error))?;
    }

    let token_configured = read_ai_token(&app)
        .map_err(|error| log_ai_error("save_ai_settings.verify_token", error))?
        .is_some();
    if next_settings.enabled && !token_configured {
        let message = if !next_token.is_empty() {
            "AI+ could not verify the locally encrypted API token. Remove ai-token.bin and try again."
        } else {
            "AI+ requires a saved API token when enabled."
        };
        return Err(log_ai_error("save_ai_settings.validation", message.into()));
    }

    write_ai_settings_file(&ai_settings_path(&app)?, &next_settings)
        .map_err(|error| log_ai_error("save_ai_settings.write_file", error))?;

    Ok(AiSettingsSnapshot {
        enabled: next_settings.enabled,
        base_url: next_settings.base_url,
        model: next_settings.model,
        system_prompt_template: next_settings.system_prompt_template,
        user_prompt_template: next_settings.user_prompt_template,
        drawio_system_prompt_template: next_settings.drawio_system_prompt_template,
        drawio_user_prompt_template: next_settings.drawio_user_prompt_template,
        token_configured,
        runtime_supported: true,
    })
}

#[tauri::command]
pub async fn generate_ai_mermaid(
    app: AppHandle,
    options: GenerateAiMermaidOptions,
) -> Result<GenerateAiMermaidResult, String> {
    let (settings, token, endpoint, endpoint_host) =
        prepare_generate_ai_request(&app, "generate_ai_mermaid")?;
    log::info!(
        "ai.generate.request host={} merge_mode={}",
        endpoint_host,
        options.merge_mode.unwrap_or(false)
    );

    let payload = build_generate_payload(&settings, &options, false);
    let body = send_ai_request(
        &endpoint,
        &token,
        payload,
        "generate_ai_mermaid",
        &endpoint_host,
    )
    .await?;

    let response_json: Value = serde_json::from_str(&body).map_err(|error| {
        log_ai_error(
            "generate_ai_mermaid.parse_json",
            format!("Failed to parse AI response JSON: {error}"),
        )
    })?;
    let content = extract_response_content(&response_json)
        .map_err(|error| log_ai_error("generate_ai_mermaid.extract_content", error))?;
    let mermaid_text = sanitize_ai_response_text(&content);
    if mermaid_text.is_empty() {
        return Err(log_ai_error(
            "generate_ai_mermaid.empty_response",
            "AI response did not include Mermaid code.".into(),
        ));
    }

    log::info!("ai.generate.success host={}", endpoint_host);
    Ok(GenerateAiMermaidResult {
        mermaid_text,
        model: settings.model,
    })
}

#[tauri::command]
pub async fn generate_ai_mermaid_stream(
    app: AppHandle,
    options: GenerateAiMermaidOptions,
) -> Result<GenerateAiMermaidResult, String> {
    let (settings, token, endpoint, endpoint_host) =
        prepare_generate_ai_request(&app, "generate_ai_mermaid_stream")?;
    let request_token = options.request_token.unwrap_or_default();
    log::info!(
        "ai.generate.stream.request host={} merge_mode={} request_token={}",
        endpoint_host,
        options.merge_mode.unwrap_or(false),
        request_token
    );

    let payload = build_generate_payload(&settings, &options, true);
    let content = send_ai_request_streaming(
        &app,
        &endpoint,
        &token,
        payload,
        "generate_ai_mermaid_stream",
        &endpoint_host,
        request_token,
    )
    .await?;
    let mermaid_text = sanitize_ai_response_text(&content);
    if mermaid_text.is_empty() {
        return Err(log_ai_error(
            "generate_ai_mermaid_stream.empty_response",
            "AI response did not include Mermaid code.".into(),
        ));
    }

    log::info!(
        "ai.generate.stream.success host={} request_token={}",
        endpoint_host,
        request_token
    );
    Ok(GenerateAiMermaidResult {
        mermaid_text,
        model: settings.model,
    })
}

#[tauri::command]
pub async fn generate_ai_drawio(
    app: AppHandle,
    options: GenerateAiDrawioOptions,
) -> Result<GenerateAiDrawioResult, String> {
    let (settings, token, endpoint, endpoint_host) =
        prepare_generate_ai_request(&app, "generate_ai_drawio")?;
    log::info!(
        "ai.generate.drawio.request host={} merge_mode={}",
        endpoint_host,
        options.merge_mode.unwrap_or(false)
    );

    let payload = build_drawio_generate_payload(&settings, &options, false);
    let body = send_ai_request(
        &endpoint,
        &token,
        payload,
        "generate_ai_drawio",
        &endpoint_host,
    )
    .await?;

    let response_json: Value = serde_json::from_str(&body).map_err(|error| {
        log_ai_error(
            "generate_ai_drawio.parse_json",
            format!("Failed to parse AI response JSON: {error}"),
        )
    })?;
    let content = extract_response_content(&response_json)
        .map_err(|error| log_ai_error("generate_ai_drawio.extract_content", error))?;
    let drawio_xml = sanitize_ai_drawio_response_text(&content);
    if drawio_xml.is_empty() {
        return Err(log_ai_error(
            "generate_ai_drawio.empty_response",
            "AI response did not include draw.io XML.".into(),
        ));
    }

    log::info!("ai.generate.drawio.success host={}", endpoint_host);
    Ok(GenerateAiDrawioResult {
        drawio_xml,
        model: settings.model,
    })
}

#[tauri::command]
pub async fn generate_ai_drawio_stream(
    app: AppHandle,
    options: GenerateAiDrawioOptions,
) -> Result<GenerateAiDrawioResult, String> {
    let (settings, token, endpoint, endpoint_host) =
        prepare_generate_ai_request(&app, "generate_ai_drawio_stream")?;
    let request_token = options.request_token.unwrap_or_default();
    log::info!(
        "ai.generate.drawio.stream.request host={} merge_mode={} request_token={}",
        endpoint_host,
        options.merge_mode.unwrap_or(false),
        request_token
    );

    let payload = build_drawio_generate_payload(&settings, &options, true);
    let content = send_ai_request_streaming(
        &app,
        &endpoint,
        &token,
        payload,
        "generate_ai_drawio_stream",
        &endpoint_host,
        request_token,
    )
    .await?;
    let drawio_xml = sanitize_ai_drawio_response_text(&content);
    if drawio_xml.is_empty() {
        return Err(log_ai_error(
            "generate_ai_drawio_stream.empty_response",
            "AI response did not include draw.io XML.".into(),
        ));
    }

    log::info!(
        "ai.generate.drawio.stream.success host={} request_token={}",
        endpoint_host,
        request_token
    );
    Ok(GenerateAiDrawioResult {
        drawio_xml,
        model: settings.model,
    })
}

#[tauri::command]
pub async fn test_ai_connection(
    app: AppHandle,
    options: TestAiConnectionOptions,
) -> Result<TestAiConnectionResult, String> {
    let base_url = normalize_base_url(&options.base_url);
    let model = options.model.trim().to_string();
    if base_url.is_empty() {
        return Err(log_ai_error(
            "test_ai_connection.validation",
            "AI+ requires an API Base URL before testing.".into(),
        ));
    }

    if model.is_empty() {
        return Err(log_ai_error(
            "test_ai_connection.validation",
            "AI+ requires a model before testing.".into(),
        ));
    }

    let saved_token = if options.use_saved_token.unwrap_or(false) {
        read_ai_token(&app).map_err(|error| log_ai_error("test_ai_connection.read_token", error))?
    } else {
        None
    };
    let token = resolve_effective_token(options.token.as_deref(), saved_token.as_deref())
        .ok_or_else(|| {
            log_ai_error(
                "test_ai_connection.validation",
                "AI+ requires an API token before testing.".into(),
            )
        })?;

    let endpoint = resolve_chat_completions_endpoint(&base_url)
        .map_err(|error| log_ai_error("test_ai_connection.endpoint", error))?;
    let host = endpoint_host(&endpoint);
    let payload = json!({
        "model": model,
        "temperature": 0,
        "stream": false,
        "max_tokens": 8,
        "messages": [
            {
                "role": "system",
                "content": "Reply with OK."
            },
            {
                "role": "user",
                "content": "Connection test."
            }
        ]
    });

    log::info!("ai.test_connection.request host={} model={}", host, model);
    let _ = send_ai_request(&endpoint, &token, payload, "test_ai_connection", &host).await?;
    log::info!("ai.test_connection.success host={} model={}", host, model);

    Ok(TestAiConnectionResult {
        ok: true,
        model,
        endpoint_host: host,
        message: "AI connection test succeeded.".into(),
    })
}

fn ai_config_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let app_config_dir = app
        .path()
        .app_config_dir()
        .map_err(|error| format!("Failed to resolve app config directory: {error}"))?;
    fs::create_dir_all(&app_config_dir)
        .map_err(|error| format!("Failed to create app config directory: {error}"))?;
    Ok(app_config_dir)
}

fn ai_settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(ai_config_dir(app)?.join(AI_SETTINGS_FILE_NAME))
}

fn ai_token_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(ai_config_dir(app)?.join(AI_TOKEN_FILE_NAME))
}

fn read_ai_settings_file(path: &Path) -> Result<AiSettingsFile, String> {
    if !path.exists() {
        return Ok(default_ai_settings_file());
    }

    let text = fs::read_to_string(path)
        .map_err(|error| format!("Failed to read AI settings file: {error}"))?;
    let parsed: AiSettingsFile = serde_json::from_str(&text)
        .map_err(|error| format!("Failed to parse AI settings file: {error}"))?;

    Ok(AiSettingsFile {
        enabled: parsed.enabled,
        base_url: normalize_base_url(&parsed.base_url),
        model: parsed.model.trim().to_string(),
        system_prompt_template: normalize_prompt_template(
            Some(&parsed.system_prompt_template),
            DEFAULT_SYSTEM_PROMPT_TEMPLATE,
        ),
        user_prompt_template: normalize_prompt_template(
            Some(&parsed.user_prompt_template),
            DEFAULT_USER_PROMPT_TEMPLATE,
        ),
        drawio_system_prompt_template: normalize_prompt_template(
            Some(&parsed.drawio_system_prompt_template),
            DEFAULT_DRAWIO_SYSTEM_PROMPT_TEMPLATE,
        ),
        drawio_user_prompt_template: normalize_prompt_template(
            Some(&parsed.drawio_user_prompt_template),
            DEFAULT_DRAWIO_USER_PROMPT_TEMPLATE,
        ),
    })
}

fn write_ai_settings_file(path: &Path, settings: &AiSettingsFile) -> Result<(), String> {
    let serialized = serde_json::to_string_pretty(settings)
        .map_err(|error| format!("Failed to serialize AI settings: {error}"))?;
    fs::write(path, serialized)
        .map_err(|error| format!("Failed to write AI settings file: {error}"))
}

fn default_ai_settings_file() -> AiSettingsFile {
    AiSettingsFile {
        enabled: false,
        base_url: String::new(),
        model: String::new(),
        system_prompt_template: default_system_prompt_template(),
        user_prompt_template: default_user_prompt_template(),
        drawio_system_prompt_template: default_drawio_system_prompt_template(),
        drawio_user_prompt_template: default_drawio_user_prompt_template(),
    }
}

fn default_system_prompt_template() -> String {
    DEFAULT_SYSTEM_PROMPT_TEMPLATE.into()
}

fn default_user_prompt_template() -> String {
    DEFAULT_USER_PROMPT_TEMPLATE.into()
}

fn default_drawio_system_prompt_template() -> String {
    DEFAULT_DRAWIO_SYSTEM_PROMPT_TEMPLATE.into()
}

fn default_drawio_user_prompt_template() -> String {
    DEFAULT_DRAWIO_USER_PROMPT_TEMPLATE.into()
}

fn normalize_prompt_template(value: Option<&str>, fallback: &str) -> String {
    let template = value.unwrap_or("").trim();
    if template.is_empty() {
        return fallback.into();
    }

    if fallback == DEFAULT_SYSTEM_PROMPT_TEMPLATE
        && template == LEGACY_DEFAULT_SYSTEM_PROMPT_TEMPLATE
    {
        return DEFAULT_SYSTEM_PROMPT_TEMPLATE.into();
    }

    if fallback == DEFAULT_DRAWIO_SYSTEM_PROMPT_TEMPLATE
        && template == LEGACY_DEFAULT_DRAWIO_SYSTEM_PROMPT_TEMPLATE
    {
        return DEFAULT_DRAWIO_SYSTEM_PROMPT_TEMPLATE.into();
    }

    if fallback == DEFAULT_DRAWIO_USER_PROMPT_TEMPLATE
        && template == LEGACY_DEFAULT_DRAWIO_USER_PROMPT_TEMPLATE
    {
        return DEFAULT_DRAWIO_USER_PROMPT_TEMPLATE.into();
    }

    template.replace("\r\n", "\n")
}

fn read_ai_token(app: &AppHandle) -> Result<Option<String>, String> {
    let path = ai_token_path(app)?;
    let key = derive_token_key(&machine_token_context()?);
    read_ai_token_from_path(&path, &key)
}

fn read_ai_token_from_path(path: &Path, key: &[u8; 32]) -> Result<Option<String>, String> {
    if !path.exists() {
        return Ok(None);
    }

    let encrypted = fs::read(path)
        .map_err(|error| format!("Failed to read encrypted AI token file: {error}"))?;
    let token = decrypt_ai_token_bytes(&encrypted, key)?;
    if token.trim().is_empty() {
        return Ok(None);
    }

    Ok(Some(token))
}

fn write_ai_token(app: &AppHandle, token: &str) -> Result<(), String> {
    let path = ai_token_path(app)?;
    let key = derive_token_key(&machine_token_context()?);
    let encrypted = encrypt_ai_token_bytes(token, &key)?;
    fs::write(&path, encrypted)
        .map_err(|error| format!("Failed to write encrypted AI token file: {error}"))?;
    tighten_token_file_permissions(&path)?;
    Ok(())
}

fn clear_ai_token(app: &AppHandle) -> Result<(), String> {
    let path = ai_token_path(app)?;
    if !path.exists() {
        return Ok(());
    }

    fs::remove_file(path)
        .map_err(|error| format!("Failed to clear encrypted AI token file: {error}"))
}

fn machine_token_context() -> Result<String, String> {
    let machine_id = machine_uid::get()
        .map_err(|error| format!("Failed to derive a machine-bound token key: {error}"))?;
    let username = env::var("USER")
        .or_else(|_| env::var("USERNAME"))
        .unwrap_or_else(|_| "unknown-user".into());

    Ok(format!("{AI_TOKEN_CONTEXT}:{username}:{machine_id}"))
}

fn derive_token_key(context: &str) -> [u8; 32] {
    let digest = Sha256::digest(context.as_bytes());
    let mut key = [0_u8; 32];
    key.copy_from_slice(&digest);
    key
}

fn encrypt_ai_token_bytes(token: &str, key: &[u8; 32]) -> Result<Vec<u8>, String> {
    let cipher = Aes256GcmSiv::new_from_slice(key)
        .map_err(|error| format!("Failed to initialize local token encryption: {error}"))?;
    let mut nonce_bytes = [0_u8; AI_TOKEN_NONCE_LEN];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);
    let ciphertext = cipher
        .encrypt(nonce, token.as_bytes())
        .map_err(|_| "Failed to encrypt the AI token for local storage.".to_string())?;

    let mut data =
        Vec::with_capacity(AI_TOKEN_FILE_MAGIC.len() + nonce_bytes.len() + ciphertext.len());
    data.extend_from_slice(AI_TOKEN_FILE_MAGIC);
    data.extend_from_slice(&nonce_bytes);
    data.extend_from_slice(&ciphertext);
    Ok(data)
}

fn decrypt_ai_token_bytes(encrypted: &[u8], key: &[u8; 32]) -> Result<String, String> {
    if encrypted.len() <= AI_TOKEN_FILE_MAGIC.len() + AI_TOKEN_NONCE_LEN {
        return Err("Encrypted AI token file is truncated.".into());
    }

    if &encrypted[..AI_TOKEN_FILE_MAGIC.len()] != AI_TOKEN_FILE_MAGIC {
        return Err("Encrypted AI token file format is unsupported.".into());
    }

    let nonce_start = AI_TOKEN_FILE_MAGIC.len();
    let nonce_end = nonce_start + AI_TOKEN_NONCE_LEN;
    let cipher = Aes256GcmSiv::new_from_slice(key)
        .map_err(|error| format!("Failed to initialize local token decryption: {error}"))?;
    let plaintext = cipher
        .decrypt(
            Nonce::from_slice(&encrypted[nonce_start..nonce_end]),
            &encrypted[nonce_end..],
        )
        .map_err(|_| "Failed to decrypt the stored AI token on this device.".to_string())?;

    String::from_utf8(plaintext)
        .map_err(|error| format!("Decrypted AI token is invalid UTF-8: {error}"))
}

#[cfg(unix)]
fn tighten_token_file_permissions(path: &Path) -> Result<(), String> {
    let permissions = fs::Permissions::from_mode(0o600);
    fs::set_permissions(path, permissions)
        .map_err(|error| format!("Failed to protect AI token file permissions: {error}"))
}

#[cfg(not(unix))]
fn tighten_token_file_permissions(_path: &Path) -> Result<(), String> {
    Ok(())
}

fn log_ai_error(context: &str, message: String) -> String {
    log::error!("ai.error context={} message={}", context, message);
    message
}

fn endpoint_host(endpoint: &str) -> String {
    Url::parse(endpoint)
        .ok()
        .and_then(|url| url.host_str().map(str::to_string))
        .unwrap_or_else(|| "unknown".into())
}

fn resolve_effective_token(draft_token: Option<&str>, saved_token: Option<&str>) -> Option<String> {
    let next_token = draft_token.unwrap_or("").trim();
    if !next_token.is_empty() {
        return Some(next_token.to_string());
    }

    let existing_token = saved_token.unwrap_or("").trim();
    if !existing_token.is_empty() {
        return Some(existing_token.to_string());
    }

    None
}

fn ai_http_client() -> Result<&'static Client, String> {
    static AI_HTTP_CLIENT: OnceLock<Result<Client, String>> = OnceLock::new();
    match AI_HTTP_CLIENT.get_or_init(|| {
        Client::builder()
            .timeout(Duration::from_secs(AI_REQUEST_TIMEOUT_SECS))
            .build()
            .map_err(|error| format!("Failed to initialize AI client: {error}"))
    }) {
        Ok(client) => Ok(client),
        Err(error) => Err(error.clone()),
    }
}

async fn send_ai_request(
    endpoint: &str,
    token: &str,
    payload: Value,
    context: &str,
    endpoint_host: &str,
) -> Result<String, String> {
    let client = ai_http_client()
        .map_err(|error| log_ai_error(&format!("{context}.client"), error))?;

    let response = client
        .post(endpoint)
        .bearer_auth(token)
        .json(&payload)
        .send()
        .await
        .map_err(|error| {
            log_ai_error(
                &format!("{context}.http"),
                format!("AI request failed: {error}"),
            )
        })?;
    let status = response.status();
    let body = response.text().await.map_err(|error| {
        log_ai_error(
            &format!("{context}.read_body"),
            format!("Failed to read AI response: {error}"),
        )
    })?;

    if !status.is_success() {
        log::warn!(
            "ai.http_error context={} host={} status={}",
            context,
            endpoint_host,
            status
        );
        return Err(log_ai_error(
            &format!("{context}.http_status"),
            extract_http_error_message(status, &body),
        ));
    }

    Ok(body)
}

async fn send_ai_request_streaming(
    app: &AppHandle,
    endpoint: &str,
    token: &str,
    payload: Value,
    context: &str,
    endpoint_host: &str,
    request_token: u32,
) -> Result<String, String> {
    let client = ai_http_client()
        .map_err(|error| log_ai_error(&format!("{context}.client"), error))?;

    let response = client
        .post(endpoint)
        .bearer_auth(token)
        .json(&payload)
        .send()
        .await
        .map_err(|error| {
            log_ai_error(
                &format!("{context}.http"),
                format!("AI request failed: {error}"),
            )
        })?;
    let status = response.status();

    if !status.is_success() {
        let body = response.text().await.map_err(|error| {
            log_ai_error(
                &format!("{context}.read_body"),
                format!("Failed to read AI response: {error}"),
            )
        })?;
        log::warn!(
            "ai.http_error context={} host={} status={}",
            context,
            endpoint_host,
            status
        );
        return Err(log_ai_error(
            &format!("{context}.http_status"),
            extract_http_error_message(status, &body),
        ));
    }

    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("")
        .to_ascii_lowercase();
    if !content_type.contains("text/event-stream") {
        let body = response.text().await.map_err(|error| {
            log_ai_error(
                &format!("{context}.read_body"),
                format!("Failed to read AI response: {error}"),
            )
        })?;
        let response_json: Value = serde_json::from_str(&body).map_err(|error| {
            log_ai_error(
                &format!("{context}.parse_json"),
                format!("Failed to parse AI response JSON: {error}"),
            )
        })?;
        let content = extract_response_content(&response_json)
            .map_err(|error| log_ai_error(&format!("{context}.extract_content"), error))?;
        emit_ai_stream_chunk(app, request_token, "content", &content)
            .map_err(|error| log_ai_error(&format!("{context}.emit_chunk"), error))?;
        return Ok(content);
    }

    let mut stream = response.bytes_stream();
    let mut pending_utf8 = Vec::new();
    let mut line_buffer = String::new();
    let mut event_lines = Vec::new();
    let mut collected = String::new();
    let mut done = false;

    while let Some(next_chunk) = stream.next().await {
        let chunk = next_chunk.map_err(|error| {
            log_ai_error(
                &format!("{context}.read_stream"),
                format!("Failed to read AI stream chunk: {error}"),
            )
        })?;
        pending_utf8.extend_from_slice(&chunk);
        decode_stream_utf8(&mut pending_utf8, &mut line_buffer)
            .map_err(|error| log_ai_error(&format!("{context}.decode_stream"), error))?;
        if process_sse_lines(
            app,
            request_token,
            &mut line_buffer,
            &mut event_lines,
            &mut collected,
            context,
        )
        .map_err(|error| log_ai_error(&format!("{context}.parse_stream"), error))?
        {
            done = true;
            break;
        }
    }

    if !done {
        decode_stream_utf8(&mut pending_utf8, &mut line_buffer)
            .map_err(|error| log_ai_error(&format!("{context}.decode_stream"), error))?;
        if !line_buffer.is_empty() {
            process_sse_line(
                app,
                request_token,
                line_buffer.trim_end_matches('\r'),
                &mut event_lines,
                &mut collected,
            )
            .map_err(|error| log_ai_error(&format!("{context}.parse_stream"), error))?;
        }
        finalize_sse_event(app, request_token, &mut event_lines, &mut collected)
            .map_err(|error| log_ai_error(&format!("{context}.parse_stream"), error))?;
    }

    Ok(collected)
}

fn normalize_base_url(value: &str) -> String {
    value.trim().trim_end_matches('/').to_string()
}

fn resolve_chat_completions_endpoint(base_url: &str) -> Result<String, String> {
    let normalized = normalize_base_url(base_url);
    if normalized.is_empty() {
        return Err("AI Base URL cannot be empty.".into());
    }

    if normalized.ends_with("/chat/completions") {
        return Ok(normalized);
    }

    Ok(format!("{normalized}/chat/completions"))
}

fn prepare_generate_ai_request(
    app: &AppHandle,
    context: &str,
) -> Result<(AiSettingsFile, String, String, String), String> {
    let settings = read_ai_settings_file(&ai_settings_path(app)?)
        .map_err(|error| log_ai_error(&format!("{context}.read_file"), error))?;
    if !settings.enabled {
        return Err(log_ai_error(
            &format!("{context}.validation"),
            "AI+ is disabled in Settings.".into(),
        ));
    }

    let token = read_ai_token(app)
        .map_err(|error| log_ai_error(&format!("{context}.read_token"), error))?
        .ok_or_else(|| {
            log_ai_error(
                &format!("{context}.validation"),
                "AI+ token is not configured.".into(),
            )
        })?;
    if settings.base_url.is_empty() || settings.model.is_empty() {
        return Err(log_ai_error(
            &format!("{context}.validation"),
            "AI+ settings are incomplete.".into(),
        ));
    }

    let endpoint = resolve_chat_completions_endpoint(&settings.base_url)
        .map_err(|error| log_ai_error(&format!("{context}.endpoint"), error))?;
    let endpoint_host = endpoint_host(&endpoint);
    Ok((settings, token, endpoint, endpoint_host))
}

fn build_generate_payload(
    settings: &AiSettingsFile,
    options: &GenerateAiMermaidOptions,
    stream: bool,
) -> Value {
    build_chat_payload(
        &settings.model,
        build_system_prompt(settings),
        build_user_prompt(settings, options),
        stream,
    )
}

fn build_drawio_generate_payload(
    settings: &AiSettingsFile,
    options: &GenerateAiDrawioOptions,
    stream: bool,
) -> Value {
    build_chat_payload_with_options(
        &settings.model,
        build_drawio_system_prompt(settings),
        build_drawio_user_prompt(settings, options),
        stream,
        0.0,
    )
}

fn build_chat_payload(model: &str, system_prompt: String, user_prompt: String, stream: bool) -> Value {
    build_chat_payload_with_options(model, system_prompt, user_prompt, stream, 0.2)
}

fn build_chat_payload_with_options(
    model: &str,
    system_prompt: String,
    user_prompt: String,
    stream: bool,
    temperature: f32,
) -> Value {
    json!({
        "model": model,
        "temperature": temperature,
        "stream": stream,
        "messages": [
            {
                "role": "system",
                "content": system_prompt
            },
            {
                "role": "user",
                "content": user_prompt
            }
        ]
    })
}

fn build_system_prompt(settings: &AiSettingsFile) -> String {
    normalize_prompt_template(
        Some(&settings.system_prompt_template),
        DEFAULT_SYSTEM_PROMPT_TEMPLATE,
    )
}

fn build_user_prompt(settings: &AiSettingsFile, options: &GenerateAiMermaidOptions) -> String {
    let template = normalize_prompt_template(
        Some(&settings.user_prompt_template),
        DEFAULT_USER_PROMPT_TEMPLATE,
    );
    let prompt = options.prompt.trim();
    let merge_mode = options.merge_mode.unwrap_or(false);
    let current_code = options.current_code.as_deref().unwrap_or("").trim();
    let previous_code = options.previous_code.as_deref().unwrap_or("").trim();
    let validation_error = options.validation_error.as_deref().unwrap_or("").trim();

    let mode_instruction = if merge_mode && !current_code.is_empty() {
        "Update the existing Mermaid diagram to satisfy the user request. Preserve unaffected structure, ids, and relationships when possible."
    } else {
        "Create a complete Mermaid diagram from scratch."
    };
    let current_diagram_section = if merge_mode && !current_code.is_empty() {
        format!("Current Mermaid:\n{current_code}\n\n")
    } else {
        String::new()
    };
    let repair_section = if !previous_code.is_empty() && !validation_error.is_empty() {
        format!(
            "The previous AI draft failed Mermaid validation. Repair it and still satisfy the original request.\n\nPrevious invalid Mermaid:\n{previous_code}\n\nValidation error:\n{validation_error}\n"
        )
    } else {
        String::new()
    };

    render_prompt_template(
        &template,
        &[
            ("prompt", prompt),
            ("mode_instruction", mode_instruction),
            ("current_diagram_section", &current_diagram_section),
            ("repair_section", &repair_section),
        ],
    )
}

fn build_drawio_system_prompt(settings: &AiSettingsFile) -> String {
    normalize_prompt_template(
        Some(&settings.drawio_system_prompt_template),
        DEFAULT_DRAWIO_SYSTEM_PROMPT_TEMPLATE,
    )
}

fn build_drawio_user_prompt(settings: &AiSettingsFile, options: &GenerateAiDrawioOptions) -> String {
    let template = normalize_prompt_template(
        Some(&settings.drawio_user_prompt_template),
        DEFAULT_DRAWIO_USER_PROMPT_TEMPLATE,
    );
    let prompt = options.prompt.trim();
    let merge_mode = options.merge_mode.unwrap_or(false);
    let current_xml = options.current_xml.as_deref().unwrap_or("").trim();
    let previous_xml = options.previous_xml.as_deref().unwrap_or("").trim();
    let validation_error = options.validation_error.as_deref().unwrap_or("").trim();

    let mode_instruction = if merge_mode && !current_xml.is_empty() {
        "Update the existing draw.io XML to satisfy the user request. Return the complete mxfile document. Keep unaffected pages, cells, ids, geometry, and relationships unchanged whenever possible, prefer editing existing cells instead of recreating them, and ensure the final diagram still contains visible content."
    } else {
        "Create a new draw.io diagram from scratch. Return the complete mxfile document. The result must contain visible diagram content, not only the empty root cells."
    };
    let current_diagram_section = if merge_mode && !current_xml.is_empty() {
        format!("Current draw.io XML:\n{current_xml}\n\n")
    } else {
        String::new()
    };
    let repair_section = if !previous_xml.is_empty() && !validation_error.is_empty() {
        format!(
            "The previous AI draft failed local draw.io XML validation. Repair it and still satisfy the original request.\nAvoid common failures such as prose outside the XML, a missing <mxfile> wrapper, missing mxCell id=\"0\" / id=\"1\" root cells, missing geometry, invalid edge source or target references, and empty diagrams.\n\nPrevious invalid draw.io XML:\n{previous_xml}\n\nValidation error:\n{validation_error}\n"
        )
    } else {
        String::new()
    };

    render_prompt_template(
        &template,
        &[
            ("prompt", prompt),
            ("mode_instruction", mode_instruction),
            ("current_diagram_section", &current_diagram_section),
            ("repair_section", &repair_section),
        ],
    )
}

fn render_prompt_template(template: &str, replacements: &[(&str, &str)]) -> String {
    let mut rendered = template.to_string();
    for (key, value) in replacements {
        rendered = rendered.replace(&format!("{{{{{key}}}}}"), value);
    }
    rendered.trim().to_string()
}

fn extract_http_error_message(status: StatusCode, body: &str) -> String {
    let default_message = format!("AI request failed with status {status}.");
    let parsed: Result<Value, _> = serde_json::from_str(body);
    parsed
        .ok()
        .and_then(|value| {
            value
                .get("error")
                .and_then(|error| error.get("message"))
                .and_then(Value::as_str)
                .map(str::to_string)
        })
        .filter(|message| !message.trim().is_empty())
        .unwrap_or(default_message)
}

fn extract_response_content(value: &Value) -> Result<String, String> {
    let content = value
        .get("choices")
        .and_then(Value::as_array)
        .and_then(|choices| choices.first())
        .and_then(|choice| choice.get("message"))
        .and_then(|message| message.get("content"))
        .ok_or_else(|| "AI response did not contain choices[0].message.content.".to_string())?;

    if let Some(text) = content.as_str() {
        return Ok(text.to_string());
    }

    if let Some(items) = content.as_array() {
        let joined = items
            .iter()
            .filter_map(|item| {
                item.get("text")
                    .and_then(Value::as_str)
                    .or_else(|| item.get("content").and_then(Value::as_str))
            })
            .collect::<Vec<_>>()
            .join("\n");

        if !joined.trim().is_empty() {
            return Ok(joined);
        }
    }

    Err("AI response content format is unsupported.".into())
}

fn extract_stream_delta_parts(value: &Value) -> Vec<(String, String)> {
    let delta = match value
        .get("choices")
        .and_then(Value::as_array)
        .and_then(|choices| choices.first())
        .and_then(|choice| choice.get("delta"))
    {
        Some(delta) => delta,
        None => return Vec::new(),
    };
    let mut parts = Vec::new();

    collect_stream_text_parts(delta.get("reasoning_content"), "thinking", &mut parts);
    collect_stream_text_parts(delta.get("reasoningContent"), "thinking", &mut parts);
    collect_stream_text_parts(delta.get("reasoning"), "thinking", &mut parts);
    collect_stream_text_parts(delta.get("thinking"), "thinking", &mut parts);

    match delta.get("content") {
        Some(Value::String(text)) if !text.is_empty() => {
            parts.push(("content".into(), text.to_string()));
        }
        Some(Value::Array(items)) => {
            for item in items {
                if let Some(text) = item.as_str() {
                    if !text.is_empty() {
                        parts.push(("content".into(), text.to_string()));
                    }
                    continue;
                }

                if let Some((kind, text)) = extract_stream_item_part(item) {
                    parts.push((kind, text));
                }
            }
        }
        _ => {}
    }

    if parts.is_empty() {
        collect_stream_text_parts(delta.get("text"), "content", &mut parts);
    }

    parts
}

fn collect_stream_text_parts(value: Option<&Value>, kind: &str, output: &mut Vec<(String, String)>) {
    match value {
        Some(Value::String(text)) if !text.is_empty() => {
            output.push((kind.to_string(), text.to_string()));
        }
        Some(Value::Array(items)) => {
            for item in items {
                if let Some(text) = item.as_str() {
                    if !text.is_empty() {
                        output.push((kind.to_string(), text.to_string()));
                    }
                    continue;
                }

                if let Some((_, text)) = extract_stream_item_part(item) {
                    output.push((kind.to_string(), text));
                }
            }
        }
        _ => {}
    }
}

fn extract_stream_item_part(item: &Value) -> Option<(String, String)> {
    let kind = if item
        .get("type")
        .and_then(Value::as_str)
        .map(is_reasoning_type_name)
        .unwrap_or(false)
    {
        "thinking"
    } else {
        "content"
    };

    let text = item
        .get("text")
        .and_then(Value::as_str)
        .or_else(|| item.get("content").and_then(Value::as_str))
        .or_else(|| item.get("reasoning").and_then(Value::as_str))
        .or_else(|| item.get("reasoning_content").and_then(Value::as_str))
        .or_else(|| item.get("thinking").and_then(Value::as_str))?;

    if text.is_empty() {
        return None;
    }

    Some((kind.into(), text.to_string()))
}

fn is_reasoning_type_name(value: &str) -> bool {
    let normalized = value.to_ascii_lowercase();
    normalized.contains("reasoning") || normalized.contains("thinking")
}

fn emit_ai_stream_chunk(
    app: &AppHandle,
    request_token: u32,
    kind: &str,
    chunk: &str,
) -> Result<(), String> {
    if chunk.is_empty() {
        return Ok(());
    }

    app.emit(
        AI_STREAM_EVENT_NAME,
        AiStreamChunkEvent {
            request_token,
            kind: kind.to_string(),
            chunk: chunk.to_string(),
        },
    )
    .map_err(|error| format!("Failed to emit AI stream chunk: {error}"))
}

fn decode_stream_utf8(pending_bytes: &mut Vec<u8>, output: &mut String) -> Result<(), String> {
    loop {
        match std::str::from_utf8(pending_bytes) {
            Ok(text) => {
                output.push_str(text);
                pending_bytes.clear();
                return Ok(());
            }
            Err(error) => {
                let valid_up_to = error.valid_up_to();
                if valid_up_to > 0 {
                    let valid_text = std::str::from_utf8(&pending_bytes[..valid_up_to])
                        .map_err(|decode_error| {
                            format!("AI stream contained invalid UTF-8 data: {decode_error}")
                        })?;
                    output.push_str(valid_text);
                    let trailing = pending_bytes.split_off(valid_up_to);
                    *pending_bytes = trailing;
                }

                if error.error_len().is_none() {
                    return Ok(());
                }

                return Err("AI stream contained invalid UTF-8 data.".into());
            }
        }
    }
}

fn process_sse_lines(
    app: &AppHandle,
    request_token: u32,
    line_buffer: &mut String,
    event_lines: &mut Vec<String>,
    collected: &mut String,
    _context: &str,
) -> Result<bool, String> {
    while let Some(newline_index) = line_buffer.find('\n') {
        let mut line = line_buffer[..newline_index].to_string();
        line_buffer.drain(..=newline_index);
        if line.ends_with('\r') {
            line.pop();
        }

        if process_sse_line(app, request_token, &line, event_lines, collected)? {
            return Ok(true);
        }
    }

    Ok(false)
}

fn process_sse_line(
    app: &AppHandle,
    request_token: u32,
    line: &str,
    event_lines: &mut Vec<String>,
    collected: &mut String,
) -> Result<bool, String> {
    if line.is_empty() {
        return finalize_sse_event(app, request_token, event_lines, collected);
    }

    if line.starts_with(':') {
        return Ok(false);
    }

    if let Some(data_line) = line.strip_prefix("data:") {
        event_lines.push(data_line.trim_start().to_string());
    }

    Ok(false)
}

fn finalize_sse_event(
    app: &AppHandle,
    request_token: u32,
    event_lines: &mut Vec<String>,
    collected: &mut String,
) -> Result<bool, String> {
    if event_lines.is_empty() {
        return Ok(false);
    }

    let payload = event_lines.join("\n");
    event_lines.clear();
    let trimmed = payload.trim();
    if trimmed.is_empty() {
        return Ok(false);
    }

    if trimmed == "[DONE]" {
        return Ok(true);
    }

    let value: Value = serde_json::from_str(trimmed)
        .map_err(|error| format!("Failed to parse AI stream event JSON: {error}"))?;
    for (kind, chunk) in extract_stream_delta_parts(&value) {
        if kind == "content" {
            collected.push_str(&chunk);
        }
        emit_ai_stream_chunk(app, request_token, &kind, &chunk)?;
    }

    Ok(false)
}

fn sanitize_ai_response_text(value: &str) -> String {
    let trimmed = value.trim();
    let fenced = trimmed.split("```").collect::<Vec<_>>();

    let mut text = if fenced.len() >= 3 {
        fenced[1]
            .lines()
            .skip_while(|line| line.trim().eq_ignore_ascii_case("mermaid"))
            .collect::<Vec<_>>()
            .join("\n")
            .trim()
            .to_string()
    } else {
        trimmed.to_string()
    };

    let lines = text.lines().collect::<Vec<_>>();
    let start_index = lines
        .iter()
        .position(|line| looks_like_mermaid_declaration(line))
        .unwrap_or(0);
    text = lines[start_index..].join("\n").trim().to_string();
    text
}

fn sanitize_ai_drawio_response_text(value: &str) -> String {
    let trimmed = value.trim();
    let fenced = trimmed.split("```").collect::<Vec<_>>();

    let mut text = if fenced.len() >= 3 {
        fenced[1]
            .lines()
            .skip_while(|line| {
                let trimmed = line.trim();
                trimmed.eq_ignore_ascii_case("xml") || trimmed.eq_ignore_ascii_case("drawio")
            })
            .collect::<Vec<_>>()
            .join("\n")
            .trim()
            .to_string()
    } else {
        trimmed.to_string()
    };

    if let Some(start_index) = text.find("<mxfile") {
        text = text[start_index..].trim().to_string();
    }

    if let Some(end_index) = text.rfind("</mxfile>") {
        text = text[..end_index + "</mxfile>".len()].trim().to_string();
    }

    text
}

fn looks_like_mermaid_declaration(line: &str) -> bool {
    let trimmed = line.trim_start();
    [
        "flowchart",
        "graph",
        "sequenceDiagram",
        "classDiagram",
        "stateDiagram",
        "stateDiagram-v2",
        "erDiagram",
        "journey",
        "gantt",
        "pie",
        "mindmap",
        "timeline",
        "quadrantChart",
        "requirementDiagram",
        "gitGraph",
        "C4Context",
        "C4Container",
        "C4Component",
        "C4Dynamic",
        "C4Deployment",
        "architecture-beta",
        "packet-beta",
        "xychart-beta",
        "kanban",
        "block-beta",
        "sankey-beta",
    ]
    .iter()
    .any(|keyword| trimmed.starts_with(keyword))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn normalize_base_url_trims_and_strips_trailing_slashes() {
        assert_eq!(
            normalize_base_url(" https://api.openai.com/v1/ "),
            "https://api.openai.com/v1"
        );
    }

    #[test]
    fn resolve_endpoint_appends_chat_completions_when_needed() {
        assert_eq!(
            resolve_chat_completions_endpoint("https://example.com/v1").unwrap(),
            "https://example.com/v1/chat/completions"
        );
    }

    #[test]
    fn resolve_endpoint_keeps_explicit_chat_completions_path() {
        assert_eq!(
            resolve_chat_completions_endpoint("https://example.com/v1/chat/completions").unwrap(),
            "https://example.com/v1/chat/completions"
        );
    }

    #[test]
    fn sanitize_response_text_strips_code_fences_and_prose() {
        let input = "Here is the Mermaid:\n```mermaid\nflowchart TD\nA-->B\n```";
        assert_eq!(sanitize_ai_response_text(input), "flowchart TD\nA-->B");
    }

    #[test]
    fn sanitize_drawio_response_text_strips_fences_and_prose() {
        let input = "Here is the XML:\n```xml\n<mxfile><diagram id=\"1\" name=\"Page-1\"></diagram></mxfile>\n```";
        assert_eq!(
            sanitize_ai_drawio_response_text(input),
            "<mxfile><diagram id=\"1\" name=\"Page-1\"></diagram></mxfile>"
        );
    }

    #[test]
    fn render_prompt_template_replaces_supported_placeholders() {
        let rendered = render_prompt_template(
            "A {{prompt}} B {{mode_instruction}} C",
            &[("prompt", "demo"), ("mode_instruction", "merge")],
        );
        assert_eq!(rendered, "A demo B merge C");
    }

    #[test]
    fn default_settings_include_prompt_templates() {
        let settings = default_ai_settings_file();
        assert_eq!(
            settings.system_prompt_template,
            DEFAULT_SYSTEM_PROMPT_TEMPLATE
        );
        assert_eq!(settings.user_prompt_template, DEFAULT_USER_PROMPT_TEMPLATE);
        assert_eq!(
            settings.drawio_system_prompt_template,
            DEFAULT_DRAWIO_SYSTEM_PROMPT_TEMPLATE
        );
        assert_eq!(
            settings.drawio_user_prompt_template,
            DEFAULT_DRAWIO_USER_PROMPT_TEMPLATE
        );
    }

    #[test]
    fn resolve_effective_token_prefers_draft_token() {
        assert_eq!(
            resolve_effective_token(Some(" draft-token "), Some("saved-token")),
            Some("draft-token".into())
        );
    }

    #[test]
    fn extract_http_error_message_uses_api_error_message() {
        let body = r#"{"error":{"message":"Invalid API key."}}"#;
        assert_eq!(
            extract_http_error_message(StatusCode::UNAUTHORIZED, body),
            "Invalid API key."
        );
    }

    #[test]
    fn endpoint_host_extracts_hostname() {
        assert_eq!(
            endpoint_host("https://api.openai.com/v1/chat/completions"),
            "api.openai.com"
        );
    }

    #[test]
    fn encrypted_token_round_trip_avoids_plaintext_storage() {
        let key = derive_token_key("unit-test-context");
        let encrypted = encrypt_ai_token_bytes("sk-secret-token", &key).unwrap();
        assert!(!String::from_utf8_lossy(&encrypted).contains("sk-secret-token"));
        assert_eq!(
            decrypt_ai_token_bytes(&encrypted, &key).unwrap(),
            "sk-secret-token"
        );
    }

    #[test]
    fn encrypted_token_file_round_trip_reads_back_token() {
        let temp_dir = std::env::temp_dir().join(format!(
            "mermaid-tool-ai-token-test-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&temp_dir).unwrap();
        let token_path = temp_dir.join("ai-token.bin");
        let key = derive_token_key("unit-test-context");
        let encrypted = encrypt_ai_token_bytes("sk-another-secret", &key).unwrap();
        fs::write(&token_path, encrypted).unwrap();

        let read_back = read_ai_token_from_path(&token_path, &key).unwrap();
        assert_eq!(read_back.as_deref(), Some("sk-another-secret"));

        fs::remove_file(&token_path).unwrap();
        fs::remove_dir_all(&temp_dir).unwrap();
    }

    #[test]
    fn settings_file_round_trip_preserves_non_sensitive_fields() {
        let temp_dir = std::env::temp_dir().join(format!(
            "mermaid-tool-ai-test-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&temp_dir).unwrap();
        let settings_path = temp_dir.join("ai-settings.json");
        let settings = AiSettingsFile {
            enabled: true,
            base_url: "https://example.com/v1".into(),
            model: "gpt-test".into(),
            system_prompt_template: DEFAULT_SYSTEM_PROMPT_TEMPLATE.into(),
            user_prompt_template: DEFAULT_USER_PROMPT_TEMPLATE.into(),
            drawio_system_prompt_template: DEFAULT_DRAWIO_SYSTEM_PROMPT_TEMPLATE.into(),
            drawio_user_prompt_template: DEFAULT_DRAWIO_USER_PROMPT_TEMPLATE.into(),
        };

        write_ai_settings_file(&settings_path, &settings).unwrap();
        let read_back = read_ai_settings_file(&settings_path).unwrap();

        assert!(read_back.enabled);
        assert_eq!(read_back.base_url, "https://example.com/v1");
        assert_eq!(read_back.model, "gpt-test");
        assert_eq!(
            read_back.system_prompt_template,
            DEFAULT_SYSTEM_PROMPT_TEMPLATE
        );
        assert_eq!(read_back.user_prompt_template, DEFAULT_USER_PROMPT_TEMPLATE);
        assert_eq!(
            read_back.drawio_system_prompt_template,
            DEFAULT_DRAWIO_SYSTEM_PROMPT_TEMPLATE
        );
        assert_eq!(
            read_back.drawio_user_prompt_template,
            DEFAULT_DRAWIO_USER_PROMPT_TEMPLATE
        );

        fs::remove_file(&settings_path).unwrap();
        fs::remove_dir_all(&temp_dir).unwrap();
    }

    #[test]
    fn settings_file_with_missing_prompt_fields_uses_defaults() {
        let temp_dir = std::env::temp_dir().join(format!(
            "mermaid-tool-ai-test-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&temp_dir).unwrap();
        let settings_path = temp_dir.join("ai-settings.json");
        fs::write(
            &settings_path,
            r#"{
  "enabled": true,
  "baseUrl": "https://example.com/v1",
  "model": "gpt-test"
}"#,
        )
        .unwrap();

        let read_back = read_ai_settings_file(&settings_path).unwrap();

        assert!(read_back.enabled);
        assert_eq!(read_back.base_url, "https://example.com/v1");
        assert_eq!(read_back.model, "gpt-test");
        assert_eq!(
            read_back.system_prompt_template,
            DEFAULT_SYSTEM_PROMPT_TEMPLATE
        );
        assert_eq!(read_back.user_prompt_template, DEFAULT_USER_PROMPT_TEMPLATE);
        assert_eq!(
            read_back.drawio_system_prompt_template,
            DEFAULT_DRAWIO_SYSTEM_PROMPT_TEMPLATE
        );
        assert_eq!(
            read_back.drawio_user_prompt_template,
            DEFAULT_DRAWIO_USER_PROMPT_TEMPLATE
        );

        fs::remove_file(&settings_path).unwrap();
        fs::remove_dir_all(&temp_dir).unwrap();
    }

    #[test]
    fn settings_file_with_legacy_drawio_prompt_templates_is_migrated() {
        let temp_dir = std::env::temp_dir().join(format!(
            "mermaid-tool-ai-test-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&temp_dir).unwrap();
        let settings_path = temp_dir.join("ai-settings.json");
        fs::write(
            &settings_path,
            format!(
                r#"{{
  "enabled": true,
  "baseUrl": "https://example.com/v1",
  "model": "gpt-test",
  "drawioSystemPromptTemplate": {system:?},
  "drawioUserPromptTemplate": {user:?}
}}"#,
                system = LEGACY_DEFAULT_DRAWIO_SYSTEM_PROMPT_TEMPLATE,
                user = LEGACY_DEFAULT_DRAWIO_USER_PROMPT_TEMPLATE
            ),
        )
        .unwrap();

        let read_back = read_ai_settings_file(&settings_path).unwrap();

        assert_eq!(
            read_back.drawio_system_prompt_template,
            DEFAULT_DRAWIO_SYSTEM_PROMPT_TEMPLATE
        );
        assert_eq!(
            read_back.drawio_user_prompt_template,
            DEFAULT_DRAWIO_USER_PROMPT_TEMPLATE
        );

        fs::remove_file(&settings_path).unwrap();
        fs::remove_dir_all(&temp_dir).unwrap();
    }
}
