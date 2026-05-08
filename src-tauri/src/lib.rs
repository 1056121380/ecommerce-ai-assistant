#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::PathBuf;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::Manager;

const CREDENTIAL_SERVICE: &str = "com.ecommerce.ai.assistant";
const DATA_FILES: &[&str] = &[
    "llm_config.json",
    "chat_sessions.json",
    "analysis_results.json",
    "data_source_cache.json",
    "public_data_cache.json",
];
const PUBLIC_GET_HOSTS: &[&str] = &[
    "api.gdeltproject.org",
    "trends.google.com",
    "dummyjson.com",
    "world.openfoodfacts.org",
];

const ALLOWED_LLM_HOSTS: &[&str] = &[
    // MiniMax
    "api.minimaxi.com",
    "api.minimax.io",
    "api.minimax.chat",
    // Kimi / Moonshot
    "api.moonshot.cn",
    "ark.cn-beijing.volces.com",
    // Claude (Anthropic)
    "api.anthropic.com",
    // SiliconFlow
    "api.siliconflow.cn",
    "api.siliconflow.com",
    // OpenAI
    "api.openai.com",
    "openai.com",
    // Ollama (local)
    "localhost",
    "127.0.0.1",
];

#[derive(Debug, Deserialize)]
struct HttpHeader {
    name: String,
    value: String,
}

#[derive(Debug, Serialize)]
struct HttpResponse {
    status: u16,
    body: String,
}

fn validate_public_get_url(endpoint: &str) -> Result<reqwest::Url, String> {
    let url = reqwest::Url::parse(endpoint).map_err(|err| format!("公开数据源 URL 无效: {err}"))?;
    if url.scheme() != "https" {
        return Err("公开数据源只允许使用 HTTPS".to_string());
    }
    let host = url
        .host_str()
        .ok_or_else(|| "公开数据源 URL 缺少 host".to_string())?;
    if PUBLIC_GET_HOSTS.contains(&host) {
        Ok(url)
    } else {
        Err(format!("未授权的公开数据源 host: {host}"))
    }
}

fn validate_llm_url(endpoint: &str) -> Result<reqwest::Url, String> {
    let url = reqwest::Url::parse(endpoint).map_err(|err| format!("LLM API URL 无效: {err}"))?;
    if !["http", "https"].contains(&url.scheme()) {
        return Err("LLM API 只允许使用 HTTP 或 HTTPS".to_string());
    }
    let host = url
        .host_str()
        .ok_or_else(|| "LLM API URL 缺少 host".to_string())?;
    if ALLOWED_LLM_HOSTS.contains(&host) {
        Ok(url)
    } else {
        Err(format!("未授权的 LLM API host: {host}。请在设置中使用支持的 API 服务商地址。"))
    }
}

fn validate_data_file(file_name: &str) -> Result<(), String> {
    if DATA_FILES.contains(&file_name) {
        Ok(())
    } else {
        Err("不允许访问该数据文件".to_string())
    }
}

fn app_data_file(app: &tauri::AppHandle, file_name: &str) -> Result<PathBuf, String> {
    validate_data_file(file_name)?;
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|err| format!("获取应用数据目录失败: {err}"))?;
    fs::create_dir_all(&dir).map_err(|err| format!("创建应用数据目录失败: {err}"))?;
    Ok(dir.join(file_name))
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("你好，{}！这是电商AI助手。", name)
}

#[tauri::command]
fn save_app_data(app: tauri::AppHandle, file_name: String, content: String) -> Result<(), String> {
    let path = app_data_file(&app, &file_name)?;
    fs::write(path, content).map_err(|err| format!("保存数据失败: {err}"))
}

#[tauri::command]
fn load_app_data(app: tauri::AppHandle, file_name: String) -> Result<Option<String>, String> {
    let path = app_data_file(&app, &file_name)?;
    if !path.exists() {
        return Ok(None);
    }
    fs::read_to_string(path)
        .map(Some)
        .map_err(|err| format!("读取数据失败: {err}"))
}

#[tauri::command]
fn save_api_key(account: String, api_key: String) -> Result<(), String> {
    let entry = keyring::Entry::new(CREDENTIAL_SERVICE, &account)
        .map_err(|err| format!("打开系统凭据存储失败: {err}"))?;
    if api_key.trim().is_empty() {
        let _ = entry.delete_credential();
        return Ok(());
    }
    entry
        .set_password(&api_key)
        .map_err(|err| format!("保存 API Key 失败: {err}"))
}

#[tauri::command]
fn load_api_key(account: String) -> Result<Option<String>, String> {
    let entry = keyring::Entry::new(CREDENTIAL_SERVICE, &account)
        .map_err(|err| format!("打开系统凭据存储失败: {err}"))?;
    match entry.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(err) => Err(format!("读取 API Key 失败: {err}")),
    }
}

#[tauri::command]
fn delete_api_key(account: String) -> Result<(), String> {
    let entry = keyring::Entry::new(CREDENTIAL_SERVICE, &account)
        .map_err(|err| format!("打开系统凭据存储失败: {err}"))?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(err) => Err(format!("删除 API Key 失败: {err}")),
    }
}

#[tauri::command]
async fn post_json(
    endpoint: String,
    headers: Vec<HttpHeader>,
    body: String,
    timeout_secs: Option<u64>,
) -> Result<HttpResponse, String> {
    // 安全校验：只允许访问已认证的 LLM 服务商
    validate_llm_url(&endpoint)?;
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(timeout_secs.unwrap_or(45)))
        .build()
        .map_err(|err| format!("创建 HTTP 客户端失败: {err}"))?;

    let mut request = client.post(endpoint).body(body);
    for header in headers {
        request = request.header(header.name, header.value);
    }

    let response = request
        .send()
        .await
        .map_err(|err| format!("请求模型 API 失败: {err}"))?;
    let status = response.status().as_u16();
    let body = response
        .text()
        .await
        .map_err(|err| format!("读取模型响应失败: {err}"))?;

    Ok(HttpResponse { status, body })
}

#[tauri::command]
async fn get_text(endpoint: String, timeout_secs: Option<u64>) -> Result<HttpResponse, String> {
    let url = validate_public_get_url(&endpoint)?;
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(timeout_secs.unwrap_or(8)))
        .user_agent("ecommerce-ai-assistant/1.0")
        .build()
        .map_err(|err| format!("创建 HTTP 客户端失败: {err}"))?;

    let response = client
        .get(url)
        .send()
        .await
        .map_err(|err| format!("请求公开数据源失败: {err}"))?;
    let status = response.status().as_u16();
    let body = response
        .text()
        .await
        .map_err(|err| format!("读取公开数据源失败: {err}"))?;

    Ok(HttpResponse { status, body })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            greet,
            save_app_data,
            load_app_data,
            save_api_key,
            load_api_key,
            delete_api_key,
            post_json,
            get_text
        ])
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            window.set_title("电商AI助手 v1.0.0").unwrap();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("启动失败");
}
