//! Adventure Keeper Serveur: runs the realtime server (`ak-server`, a sidecar)
//! on this computer, with a Cloudflare quick tunnel (`cloudflared`, the other
//! sidecar) so players reach it at a public https address. The window shows
//! the server's status, which the server reports as `AK_STATUS {json}` lines.
//! Closing the window stops the server.

// No console window on Windows.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;
use std::time::Duration;

use tauri::{Emitter, Manager, RunEvent, State};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_shell::ShellExt;

/// The app the server serves: only its Firebase accounts get in. Production
/// unless the build sets `AK_FIREBASE_PROJECT_ID` (the staging installers,
/// see .github/workflows/release-serveur-reusable.yml).
const FIREBASE_PROJECT_ID: &str = match option_env!("AK_FIREBASE_PROJECT_ID") {
    Some(id) if !id.is_empty() => id,
    _ => "adv-keeper",
};

/// The site, which Firebase Hosting serves at `<project>.web.app`.
fn site_url() -> String {
    format!("https://{FIREBASE_PROJECT_ID}.web.app")
}

/// The site's addresses, the only pages allowed to open a socket.
fn allowed_origins() -> String {
    format!("{},https://{FIREBASE_PROJECT_ID}.firebaseapp.com", site_url())
}
/// Fixed, so the site can find a server running on this computer.
const PORT: &str = "8787";

#[derive(Default)]
struct Server {
    child: Mutex<Option<CommandChild>>,
    /// The last `AK_STATUS` line, for a window that loads after it came.
    status: Mutex<Option<String>>,
}

#[tauri::command]
fn last_status(server: State<'_, Server>) -> Option<String> {
    server.status.lock().ok()?.clone()
}

/// Opens the site in the browser. Done here rather than from the window, so
/// the permission does not have to name the site's address.
#[tauri::command]
fn open_site(app: tauri::AppHandle) -> Result<(), String> {
    app.opener().open_url(site_url(), None::<&str>).map_err(|e| e.to_string())
}

/// A status of our own, in the server's format, when the server cannot say.
fn failure(message: &str) -> String {
    serde_json::json!({
        "server": { "status": "error", "message": message },
        "tunnel": { "status": "off" },
        "rooms": 0,
        "players": 0,
    })
    .to_string()
}

fn publish(app: &tauri::AppHandle, status: String) {
    if let Some(server) = app.try_state::<Server>() {
        if let Ok(mut last) = server.status.lock() {
            *last = Some(status.clone());
        }
    }
    let _ = app.emit("server-status", status);
}

fn start_server(app: &tauri::AppHandle) -> Result<(), String> {
    // Sidecars are installed next to the app's own executable.
    let exe_dir = std::env::current_exe()
        .map_err(|e| e.to_string())?
        .parent()
        .ok_or("no executable directory")?
        .to_path_buf();
    let cloudflared = exe_dir.join(if cfg!(windows) { "cloudflared.exe" } else { "cloudflared" });
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("rooms");

    let (mut events, child) = app
        .shell()
        .sidecar("ak-server")
        .map_err(|e| e.to_string())?
        .envs([
            ("PORT", PORT.to_string()),
            ("HOST", "127.0.0.1".to_string()),
            ("STATUS_JSON", "1".to_string()),
            ("FIREBASE_PROJECT_ID", FIREBASE_PROJECT_ID.to_string()),
            ("ALLOWED_ORIGINS", allowed_origins()),
            ("DATA_DIR", data_dir.to_string_lossy().into_owned()),
            ("CLOUDFLARED_PATH", cloudflared.to_string_lossy().into_owned()),
        ])
        .spawn()
        .map_err(|e| e.to_string())?;
    *app.state::<Server>().child.lock().map_err(|e| e.to_string())? = Some(child);

    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(event) = events.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    let line = String::from_utf8_lossy(&line);
                    if let Some(json) = line.trim().strip_prefix("AK_STATUS ") {
                        publish(&app, json.to_string());
                    }
                }
                CommandEvent::Stderr(line) => {
                    eprintln!("ak-server: {}", String::from_utf8_lossy(&line).trim_end());
                }
                CommandEvent::Terminated(_) => {
                    publish(&app, failure("stopped"));
                }
                _ => {}
            }
        }
    });
    Ok(())
}

/// Ask the server to stop (it saves its rooms and closes the tunnel), then
/// make sure it did.
fn stop_server(app: &tauri::AppHandle) {
    let Some(server) = app.try_state::<Server>() else { return };
    let Some(mut child) = server.child.lock().ok().and_then(|mut c| c.take()) else { return };
    let _ = child.write(b"quit\n");
    std::thread::sleep(Duration::from_millis(1500));
    let _ = child.kill();
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .manage(Server::default())
        .invoke_handler(tauri::generate_handler![last_status, open_site])
        .setup(|app| {
            if let Err(message) = start_server(app.handle()) {
                publish(app.handle(), failure(&message));
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building Adventure Keeper Serveur")
        .run(|app, event| {
            if let RunEvent::Exit = event {
                stop_server(app);
            }
        });
}
