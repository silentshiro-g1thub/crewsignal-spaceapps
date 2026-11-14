mod db;
mod external;
mod files;
mod models;
mod storage;

use std::sync::{
    atomic::{AtomicBool, Ordering},
    Mutex,
};

use serde_json::Value;
use tauri::{Emitter, Manager, State, WindowEvent};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;

use crate::storage::StorageSlot;
use crate::external::{detect_webview2_version, validate_external_https_url};
use crate::files::{read_text_from_path, write_text_to_path};
use crate::models::{
    AppSnapshot, CommandError, CommitCheckInEventOutcome, CommitCheckInEventRequest,
    CommitCsvBatchOutcome, CommitCsvBatchRequest, CommitObservationOutcome,
    CommitObservationRequest, DeleteProfileOutcome, DiagnosticHooks, DraftGuardState,
    FileReadOutcome, FileWriteOutcome, LookupCommitOutcome, ProfileBundleData, ProfileRecord,
    ProfileSeedInput, RestoreBackupOutcome, RestoreBackupRequest, RuntimeEnvironmentInfo,
    SaveDraftOutcome, StorageStatus,
};

struct AppState {
    storage: StorageSlot,
    draft_guard: Mutex<DraftGuardState>,
    allow_close_once: AtomicBool,
}

#[tauri::command]
fn get_runtime_info(state: State<'_, AppState>) -> RuntimeEnvironmentInfo {
    let status = state.storage.status();
    let db = state.storage.get().ok();
    RuntimeEnvironmentInfo {
        platform: "windows".to_string(),
        arch: std::env::consts::ARCH.to_string(),
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        webview2_version: detect_webview2_version(),
        db_path: db
            .as_ref()
            .map(|d| d.db_path_display())
            .or(status.db_path)
            .unwrap_or_else(|| "unavailable".to_string()),
        sqlite_journal_mode: db
            .as_ref()
            .map(|d| d.journal_mode().to_string())
            .unwrap_or_else(|| "unavailable".to_string()),
        offline_assets_bundled: true,
    }
}

#[tauri::command]
fn get_storage_status(state: State<'_, AppState>) -> StorageStatus {
    state.storage.status()
}

#[tauri::command]
fn retry_open_storage(state: State<'_, AppState>) -> StorageStatus {
    state.storage.retry()
}

#[tauri::command]
fn get_diagnostic_hooks(state: State<'_, AppState>) -> DiagnosticHooks {
    state.storage.get().map(|db| db.get_hooks()).unwrap_or_default()
}

#[tauri::command]
fn set_diagnostic_hooks(state: State<'_, AppState>, hooks: DiagnosticHooks) -> DiagnosticHooks {
    if let Ok(db) = state.storage.get() {
        db.set_hooks(hooks.clone());
    }
    hooks
}

#[tauri::command]
fn ensure_demo_seed(
    state: State<'_, AppState>,
    seed: ProfileSeedInput,
) -> Result<AppSnapshot, CommandError> {
    let db = state.storage.get()?;
    db.ensure_demo_seed_if_missing(seed)?;
    db.load_app_snapshot(None)
}

#[tauri::command]
fn load_app_snapshot(
    state: State<'_, AppState>,
    profile_id: Option<String>,
) -> Result<AppSnapshot, CommandError> {
    state.storage.get()?.load_app_snapshot(profile_id.as_deref())
}

#[tauri::command]
fn load_profile_bundle(
    state: State<'_, AppState>,
    profile_id: String,
) -> Result<ProfileBundleData, CommandError> {
    state.storage.get()?.load_profile_bundle(&profile_id)
}

#[tauri::command]
fn reset_demo_profile(
    state: State<'_, AppState>,
    seed: ProfileSeedInput,
) -> Result<AppSnapshot, CommandError> {
    state.storage.get()?.reset_demo_profile(seed)
}

#[tauri::command]
fn create_personal_profile(
    state: State<'_, AppState>,
    profile: ProfileRecord,
) -> Result<AppSnapshot, CommandError> {
    let db = state.storage.get()?;
    let created = db.create_personal_profile(profile)?;
    db.load_app_snapshot(Some(&created.id))
}

#[tauri::command]
fn set_active_profile(
    state: State<'_, AppState>,
    profile_id: String,
) -> Result<AppSnapshot, CommandError> {
    state.storage.get()?.set_active_profile(&profile_id)
}

#[tauri::command]
fn delete_personal_profile(
    state: State<'_, AppState>,
    profile_id: String,
) -> Result<DeleteProfileOutcome, CommandError> {
    state.storage.get()?.delete_personal_profile(&profile_id)
}

#[tauri::command]
fn update_preferences(
    state: State<'_, AppState>,
    preferences: Value,
) -> Result<Value, CommandError> {
    state.storage.get()?.update_preferences(preferences)
}

#[tauri::command]
fn update_profile_clock(
    state: State<'_, AppState>,
    profile_id: String,
    epoch_utc: String,
    timezone: String,
    snapshot_utc: Option<String>,
    changed_at: String,
) -> Result<ProfileRecord, CommandError> {
    state.storage.get()?.update_profile_clock(
        &profile_id,
        &epoch_utc,
        &timezone,
        snapshot_utc.as_deref(),
        &changed_at,
    )
}

#[tauri::command]
fn update_profile_settings(
    state: State<'_, AppState>,
    profile_id: String,
    alias: String,
    settings: Value,
    updated_at: String,
) -> Result<ProfileRecord, CommandError> {
    state
        .storage
        .get()?
        .update_profile_settings(&profile_id, &alias, settings, &updated_at)
}

#[tauri::command]
fn upsert_personal_reference(
    state: State<'_, AppState>,
    profile_id: String,
    reference: Value,
) -> Result<Value, CommandError> {
    state.storage.get()?.upsert_personal_reference(&profile_id, reference)
}

#[tauri::command]
fn lock_fallback_reference(
    state: State<'_, AppState>,
    profile_id: String,
    reference: Value,
) -> Result<bool, CommandError> {
    state.storage.get()?.lock_fallback_reference(&profile_id, reference)
}

#[tauri::command]
fn upsert_schedule(
    state: State<'_, AppState>,
    profile_id: String,
    schedule: Value,
) -> Result<Value, CommandError> {
    state.storage.get()?.upsert_schedule(&profile_id, schedule)
}

#[tauri::command]
fn record_action_review(
    state: State<'_, AppState>,
    profile_id: String,
    review: Value,
) -> Result<Value, CommandError> {
    state.storage.get()?.record_action_review(&profile_id, review)
}

#[tauri::command]
fn save_draft(
    state: State<'_, AppState>,
    profile_id: String,
    draft: Value,
) -> Result<SaveDraftOutcome, CommandError> {
    state.storage.get()?.save_draft(&profile_id, draft)
}

#[tauri::command]
fn delete_draft(
    state: State<'_, AppState>,
    profile_id: String,
    draft_id: String,
) -> Result<bool, CommandError> {
    state.storage.get()?.delete_draft(&profile_id, &draft_id)
}

#[tauri::command]
fn commit_observation(
    state: State<'_, AppState>,
    request: CommitObservationRequest,
) -> Result<CommitObservationOutcome, CommandError> {
    state.storage.get()?.commit_observation(request)
}

#[tauri::command]
fn check_observation_status(
    state: State<'_, AppState>,
    profile_id: String,
    observation_id: Option<String>,
    draft_id: Option<String>,
) -> Result<LookupCommitOutcome, CommandError> {
    state.storage.get()?.check_observation_status(
        &profile_id,
        observation_id.as_deref(),
        draft_id.as_deref(),
    )
}

#[tauri::command]
fn commit_checkin_event(
    state: State<'_, AppState>,
    request: CommitCheckInEventRequest,
) -> Result<CommitCheckInEventOutcome, CommandError> {
    state.storage.get()?.commit_checkin_event(request)
}

#[tauri::command]
fn commit_csv_import_batch(
    state: State<'_, AppState>,
    request: CommitCsvBatchRequest,
) -> Result<CommitCsvBatchOutcome, CommandError> {
    state.storage.get()?.commit_csv_import_batch(request)
}

#[tauri::command]
fn restore_backup(
    state: State<'_, AppState>,
    request: RestoreBackupRequest,
) -> Result<RestoreBackupOutcome, CommandError> {
    state.storage.get()?.restore_backup(request)
}

#[tauri::command]
fn set_draft_guard_state(
    state: State<'_, AppState>,
    guard_state: DraftGuardState,
) -> Result<DraftGuardState, CommandError> {
    let mut guard = state.draft_guard.lock().map_err(|_| {
        CommandError::new("GUARD_LOCK_FAILED", "Could not update close guard state.")
    })?;
    *guard = guard_state.clone();
    Ok(guard_state)
}

#[tauri::command]
fn confirm_close_application(app: tauri::AppHandle, state: State<'_, AppState>) {
    state.allow_close_once.store(true, Ordering::SeqCst);
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.close();
    } else {
        app.exit(0);
    }
}

#[tauri::command]
fn save_export_file(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    default_file_name: String,
    filter_name: String,
    extensions: Vec<String>,
    content: String,
) -> FileWriteOutcome {
    let hooks = state.storage.get().map(|db| db.get_hooks()).unwrap_or_default();
    if let Some(ref sim) = hooks.simulate_file_outcome {
        match sim.as_str() {
            "cancelled" => {
                return FileWriteOutcome {
                    status: "cancelled".to_string(),
                    path: None,
                    bytes_written: None,
                    message: Some("File save was cancelled.".to_string()),
                }
            }
            "permission_refused" => {
                return FileWriteOutcome {
                    status: "permission_refused".to_string(),
                    path: Some(default_file_name),
                    bytes_written: None,
                    message: Some("File access wasn't granted for the selected folder.".to_string()),
                }
            }
            "error" => {
                return FileWriteOutcome {
                    status: "error".to_string(),
                    path: Some(default_file_name),
                    bytes_written: None,
                    message: Some("A completed file was not confirmed.".to_string()),
                }
            }
            _ => {}
        }
    }

    let ext_refs: Vec<&str> = extensions.iter().map(|s| s.as_str()).collect();
    let picked = app
        .dialog()
        .file()
        .set_file_name(&default_file_name)
        .add_filter(&filter_name, &ext_refs)
        .blocking_save_file();

    match picked {
        None => FileWriteOutcome {
            status: "cancelled".to_string(),
            path: None,
            bytes_written: None,
            message: Some("File picker closed before saving.".to_string()),
        },
        Some(file_path) => match file_path.into_path() {
            Ok(path_buf) => write_text_to_path(&path_buf, &content),
            Err(err) => FileWriteOutcome {
                status: "error".to_string(),
                path: None,
                bytes_written: None,
                message: Some(err.to_string()),
            },
        },
    }
}

#[tauri::command]
fn open_import_file(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    filter_name: String,
    extensions: Vec<String>,
) -> FileReadOutcome {
    let hooks = state.storage.get().map(|db| db.get_hooks()).unwrap_or_default();
    if let Some(ref sim) = hooks.simulate_file_outcome {
        match sim.as_str() {
            "cancelled" => {
                return FileReadOutcome {
                    status: "cancelled".to_string(),
                    path: None,
                    file_name: None,
                    content: None,
                    message: Some("File open was cancelled.".to_string()),
                }
            }
            "permission_refused" => {
                return FileReadOutcome {
                    status: "permission_refused".to_string(),
                    path: None,
                    file_name: None,
                    content: None,
                    message: Some("File access wasn't granted.".to_string()),
                }
            }
            "error" => {
                return FileReadOutcome {
                    status: "error".to_string(),
                    path: None,
                    file_name: None,
                    content: None,
                    message: Some("Could not read selected file.".to_string()),
                }
            }
            _ => {}
        }
    }

    let ext_refs: Vec<&str> = extensions.iter().map(|s| s.as_str()).collect();
    let picked = app
        .dialog()
        .file()
        .add_filter(&filter_name, &ext_refs)
        .blocking_pick_file();

    match picked {
        None => FileReadOutcome {
            status: "cancelled".to_string(),
            path: None,
            file_name: None,
            content: None,
            message: Some("File selection was cancelled.".to_string()),
        },
        Some(file_path) => match file_path.into_path() {
            Ok(path_buf) => read_text_from_path(&path_buf),
            Err(err) => FileReadOutcome {
                status: "error".to_string(),
                path: None,
                file_name: None,
                content: None,
                message: Some(err.to_string()),
            },
        },
    }
}

#[tauri::command]
fn open_external_url(app: tauri::AppHandle, url: String) -> Result<(), CommandError> {
    let validated = validate_external_https_url(&url)?;
    app.opener()
        .open_url(validated, None::<&str>)
        .map_err(|e| {
            CommandError::with_detail(
                "OPEN_EXTERNAL_FAILED",
                "Could not open external reference in your default browser.",
                e.to_string(),
            )
        })
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Never panic on storage problems: Help and recovery must stay reachable.
            let storage = match app.path().app_data_dir() {
                Ok(dir) => StorageSlot::open(Some(dir.join("crewsignal.db")), None),
                Err(e) => StorageSlot::open(
                    None,
                    Some(CommandError::with_detail(
                        "APP_DATA_DIR_UNAVAILABLE",
                        "The app data folder could not be found.",
                        e.to_string(),
                    )),
                ),
            };

            app.manage(AppState {
                storage,
                draft_guard: Mutex::new(DraftGuardState {
                    has_unfinished_draft: false,
                    has_unretained_draft: false,
                    draft_summary: None,
                }),
                allow_close_once: AtomicBool::new(false),
            });
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let state = window.state::<AppState>();
                if state.allow_close_once.swap(false, Ordering::SeqCst) {
                    return;
                }
                let guard = state
                    .draft_guard
                    .lock()
                    .map(|g| g.clone())
                    .unwrap_or(DraftGuardState {
                        has_unfinished_draft: false,
                        has_unretained_draft: false,
                        draft_summary: None,
                    });
                if guard.has_unretained_draft || guard.has_unfinished_draft {
                    api.prevent_close();
                    let _ = window.emit("crewsignal://close-requested", guard);
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_runtime_info,
            get_storage_status,
            retry_open_storage,
            get_diagnostic_hooks,
            set_diagnostic_hooks,
            ensure_demo_seed,
            load_app_snapshot,
            load_profile_bundle,
            reset_demo_profile,
            create_personal_profile,
            set_active_profile,
            delete_personal_profile,
            update_preferences,
            update_profile_clock,
            update_profile_settings,
            upsert_personal_reference,
            lock_fallback_reference,
            upsert_schedule,
            record_action_review,
            save_draft,
            delete_draft,
            commit_observation,
            check_observation_status,
            commit_checkin_event,
            commit_csv_import_batch,
            restore_backup,
            set_draft_guard_state,
            confirm_close_application,
            save_export_file,
            open_import_file,
            open_external_url,
        ])
        .run(tauri::generate_context!())
        .expect("error while running CrewSignal desktop application");
}
