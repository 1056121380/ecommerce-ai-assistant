#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::PathBuf;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::Manager;

const CREDENTIAL_SERVICE: &str = "com.ecommerce.ai.assistant";
const APP_VERSION: &str = "1.0.0";

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
    "trends.google.com.tw",
    "dummyjson.com",
    "world.openfoodfacts.org",
    "www.douyin.com",
    "aweme-v2.douyinvod.com",
    "index.baidu.com",
    "top.baidu.com",
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
    let url = reqwest::Url::parse(endpoint).map_err(|err| {
        eprintln!("[ERROR] 公开数据源 URL 解析失败: {} - {}", endpoint, err);
        format!("公开数据源 URL 无效: {err}")
    })?;

    if url.scheme() != "https" {
        eprintln!("[ERROR] 公开数据源使用非 HTTPS 协议: {}", endpoint);
        return Err("公开数据源只允许使用 HTTPS".to_string());
    }

    let host = url
        .host_str()
        .ok_or_else(|| {
            eprintln!("[ERROR] 公开数据源 URL 缺少 host: {}", endpoint);
            "公开数据源 URL 缺少 host".to_string()
        })?;

    if PUBLIC_GET_HOSTS.contains(&host) {
        println!("[INFO] 公开数据源 URL 验证通过: {}", endpoint);
        Ok(url)
    } else {
        eprintln!("[ERROR] 未授权的公开数据源 host: {}", host);
        Err(format!("未授权的公开数据源 host: {host}"))
    }
}

fn validate_data_file(file_name: &str) -> Result<(), String> {
    if DATA_FILES.contains(&file_name) {
        Ok(())
    } else {
        eprintln!("[ERROR] 尝试访问未授权的数据文件: {}", file_name);
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
    println!("[INFO] 保存应用数据: {} ({} bytes)", file_name, content.len());
    let path = app_data_file(&app, &file_name)?;
    fs::write(&path, content).map_err(|err| {
        eprintln!("[ERROR] 保存数据失败: {} - {}", path.display(), err);
        format!("保存数据失败: {err}")
    })?;
    println!("[INFO] 数据保存成功: {}", path.display());
    Ok(())
}

#[tauri::command]
fn load_app_data(app: tauri::AppHandle, file_name: String) -> Result<Option<String>, String> {
    let path = app_data_file(&app, &file_name)?;
    if !path.exists() {
        println!("[INFO] 数据文件不存在: {}", path.display());
        return Ok(None);
    }
    println!("[INFO] 加载应用数据: {}", path.display());
    fs::read_to_string(&path)
        .map(Some)
        .map_err(|err| {
            eprintln!("[ERROR] 读取数据失败: {} - {}", path.display(), err);
            format!("读取数据失败: {err}")
        })
}

#[tauri::command]
fn save_api_key(account: String, api_key: String) -> Result<(), String> {
    println!("[INFO] 保存 API Key: {}", account);
    let entry = keyring::Entry::new(CREDENTIAL_SERVICE, &account)
        .map_err(|err| {
            eprintln!("[ERROR] 打开系统凭据存储失败: {} - {}", account, err);
            format!("打开系统凭据存储失败: {err}")
        })?;
    if api_key.trim().is_empty() {
        let _ = entry.delete_credential();
        println!("[INFO] API Key 已清空: {}", account);
        return Ok(());
    }
    entry
        .set_password(&api_key)
        .map_err(|err| {
            eprintln!("[ERROR] 保存 API Key 失败: {} - {}", account, err);
            format!("保存 API Key 失败: {err}")
        })?;
    println!("[INFO] API Key 保存成功: {}", account);
    Ok(())
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
            window.set_title(&format!("电商AI助手 v{}", APP_VERSION)).unwrap();
            println!("[INFO] 电商AI助手启动成功 v{}", APP_VERSION);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("启动失败");
}
