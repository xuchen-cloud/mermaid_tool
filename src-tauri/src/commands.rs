use arboard::{Clipboard, ImageData};
use image::GenericImageView;
use rfd::FileDialog;
use serde::{Deserialize, Serialize};
use std::borrow::Cow;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

const DEFAULT_MERMAID_FILE_CONTENT: &str = "flowchart TD\n";
const DEFAULT_DRAWIO_FILE_CONTENT: &str = include_str!("../../assets/blank.drawio");
const SKIPPED_WORKSPACE_DIRECTORY_NAMES: &[&str] = &[
    "node_modules",
    "vendor",
    "dist",
    "dist-tauri",
    "target",
    "build",
    "out",
    "coverage",
];

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSortOptions {
    pub sort_mode: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenWorkspaceOptions {
    pub root_path: String,
    pub sort_mode: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadWorkspaceChildrenOptions {
    pub directory_path: String,
    pub sort_mode: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateWorkspaceEntryOptions {
    pub parent_path: String,
    pub kind: String,
    pub name: Option<String>,
    pub file_type: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenameWorkspaceEntryOptions {
    pub path: String,
    pub next_name: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MoveWorkspaceEntryOptions {
    pub path: String,
    pub target_parent_path: String,
    pub root_path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteWorkspaceEntryOptions {
    pub path: String,
    pub root_path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteTextFileOptions {
    pub file_path: String,
    pub text: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadTextFileOptions {
    pub file_path: String,
}

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FileFilter {
    pub name: String,
    pub extensions: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveTextFileOptions {
    pub default_path: Option<String>,
    pub filters: Option<Vec<FileFilter>>,
    pub text: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenTextFileOptions {
    pub filters: Option<Vec<FileFilter>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveBinaryFileOptions {
    pub default_path: Option<String>,
    pub filters: Option<Vec<FileFilter>>,
    pub bytes: Vec<u8>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CopyImageToClipboardOptions {
    pub bytes: Vec<u8>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSelectionResult {
    pub canceled: bool,
    pub root_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub root: Option<WorkspaceNode>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<WorkspaceNode>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub suggested_file_path: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceOpenResult {
    pub root_path: String,
    pub root: WorkspaceNode,
    pub children: Vec<WorkspaceNode>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub suggested_file_path: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceChildrenResult {
    pub directory_path: String,
    pub children: Vec<WorkspaceNode>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceEntryResult {
    pub kind: String,
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_type: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BasicPathResult {
    pub path: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteWorkspaceEntryResult {
    pub ok: bool,
    pub path: String,
    pub archived_path: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenTextFileResult {
    pub canceled: bool,
    pub file_path: Option<String>,
    pub text: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadTextFileResult {
    pub file_path: String,
    pub text: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveFileResult {
    pub canceled: bool,
    pub file_path: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceNode {
    #[serde(rename = "type")]
    pub node_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_type: Option<String>,
    pub name: String,
    pub path: String,
    pub updated_at: f64,
    pub created_at: f64,
    pub file_count: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<WorkspaceNode>>,
}

#[tauri::command]
pub fn choose_workspace_directory(
    options: WorkspaceSortOptions,
) -> Result<WorkspaceSelectionResult, String> {
    let dialog = FileDialog::new();
    let Some(path) = dialog.pick_folder() else {
        return Ok(WorkspaceSelectionResult {
            canceled: true,
            root_path: None,
            root: None,
            children: None,
            suggested_file_path: None,
        });
    };

    let sort_mode = normalize_workspace_sort_mode(options.sort_mode.as_deref());
    let metadata = fs::metadata(&path).map_err(error_to_string)?;
    let root = build_workspace_directory_stub(&path, true, &metadata);
    let children = read_workspace_children_internal(&path, sort_mode)?;
    let suggested_file_path = find_first_workspace_file_path(&path)?;

    Ok(WorkspaceSelectionResult {
        canceled: false,
        root_path: Some(path_to_string(&path)),
        root: Some(root),
        children: Some(children),
        suggested_file_path,
    })
}

#[tauri::command]
pub fn open_workspace(options: OpenWorkspaceOptions) -> Result<WorkspaceOpenResult, String> {
    let root_path = PathBuf::from(&options.root_path);
    let metadata = fs::metadata(&root_path).map_err(error_to_string)?;
    if !metadata.is_dir() {
        return Err("Selected workspace path is not a directory.".into());
    }

    let sort_mode = normalize_workspace_sort_mode(options.sort_mode.as_deref());
    let root = build_workspace_directory_stub(&root_path, true, &metadata);
    let children = read_workspace_children_internal(&root_path, sort_mode)?;
    let suggested_file_path = find_first_workspace_file_path(&root_path)?;

    Ok(WorkspaceOpenResult {
        root_path: options.root_path,
        root,
        children,
        suggested_file_path,
    })
}

#[tauri::command]
pub fn read_workspace_children(
    options: ReadWorkspaceChildrenOptions,
) -> Result<WorkspaceChildrenResult, String> {
    let directory_path = PathBuf::from(&options.directory_path);
    let metadata = fs::metadata(&directory_path).map_err(error_to_string)?;
    if !metadata.is_dir() {
        return Err("Requested workspace path is not a directory.".into());
    }

    let sort_mode = normalize_workspace_sort_mode(options.sort_mode.as_deref());
    let children = read_workspace_children_internal(&directory_path, sort_mode)?;
    Ok(WorkspaceChildrenResult {
        directory_path: options.directory_path,
        children,
    })
}

#[tauri::command]
pub fn create_workspace_entry(
    options: CreateWorkspaceEntryOptions,
) -> Result<WorkspaceEntryResult, String> {
    let parent_path = PathBuf::from(&options.parent_path);
    if !parent_path.is_dir() {
        return Err("Parent path is not a directory.".into());
    }

    if options.kind == "directory" {
        let base_name = options
            .name
            .as_deref()
            .map(str::trim)
            .filter(|name| !name.is_empty())
            .unwrap_or("New Folder");
        let directory_name = resolve_available_directory_name(&parent_path, base_name)?;
        let directory_path = parent_path.join(directory_name);
        fs::create_dir_all(&directory_path).map_err(error_to_string)?;
        return Ok(WorkspaceEntryResult {
            kind: "directory".into(),
            path: path_to_string(&directory_path),
            file_type: None,
        });
    }

    let file_type = normalize_workspace_file_type(options.file_type.as_deref());
    let base_name = options
        .name
        .as_deref()
        .map(str::trim)
        .filter(|name| !name.is_empty())
        .unwrap_or("untitled");
    let extension = workspace_file_extension(file_type);
    let file_name = resolve_available_file_name(&parent_path, base_name, extension)?;
    let file_path = parent_path.join(file_name);
    fs::write(&file_path, default_workspace_file_contents(file_type)).map_err(error_to_string)?;

    Ok(WorkspaceEntryResult {
        kind: "file".into(),
        path: path_to_string(&file_path),
        file_type: Some(file_type.as_str().to_string()),
    })
}

#[tauri::command]
pub fn rename_workspace_entry(
    options: RenameWorkspaceEntryOptions,
) -> Result<BasicPathResult, String> {
    let current_path = PathBuf::from(&options.path);
    let metadata = fs::metadata(&current_path).map_err(error_to_string)?;
    let parent_path = current_path
        .parent()
        .ok_or_else(|| "Workspace entry has no parent path.".to_string())?;
    let next_name = options.next_name.trim();

    if next_name.is_empty() {
        return Err("New file name cannot be empty.".into());
    }

    let next_file_name = if metadata.is_dir() {
        next_name.to_string()
    } else {
        let current_file_type = resolve_workspace_file_type_from_path(&current_path)
            .unwrap_or(WorkspaceFileType::Mermaid);
        let extension = workspace_file_extension(current_file_type);

        if next_name.ends_with(extension) {
            next_name.to_string()
        } else {
            format!("{next_name}{extension}")
        }
    };

    let target_path = parent_path.join(next_file_name);
    if target_path == current_path {
        return Ok(BasicPathResult {
            path: path_to_string(&current_path),
        });
    }

    fs::rename(&current_path, &target_path).map_err(error_to_string)?;
    Ok(BasicPathResult {
        path: path_to_string(&target_path),
    })
}

#[tauri::command]
pub fn move_workspace_entry(options: MoveWorkspaceEntryOptions) -> Result<BasicPathResult, String> {
    let root_path = PathBuf::from(&options.root_path);
    let source_path = PathBuf::from(&options.path);
    let target_parent_path = PathBuf::from(&options.target_parent_path);
    let metadata = fs::metadata(&source_path).map_err(error_to_string)?;
    let target_parent_metadata = fs::metadata(&target_parent_path).map_err(error_to_string)?;

    if !target_parent_metadata.is_dir() {
        return Err("Move target must be a directory.".into());
    }

    if !is_within_workspace(&root_path, &source_path)
        || !is_within_workspace(&root_path, &target_parent_path)
    {
        return Err("Move must stay within the current workspace.".into());
    }

    if source_path.parent() == Some(target_parent_path.as_path()) {
        return Ok(BasicPathResult {
            path: path_to_string(&source_path),
        });
    }

    if metadata.is_dir() {
        let relative_target = target_parent_path.strip_prefix(&source_path).ok();
        if relative_target.is_some() {
            return Err("Cannot move a folder into itself.".into());
        }
    }

    let target_path = target_parent_path.join(
        source_path
            .file_name()
            .ok_or_else(|| "Workspace entry is missing a file name.".to_string())?,
    );

    if target_path.exists() {
        return Err(format!(
            "\"{}\" already exists in {}.",
            source_path
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or("entry"),
            target_parent_path
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or("target")
        ));
    }

    fs::rename(&source_path, &target_path).map_err(error_to_string)?;
    Ok(BasicPathResult {
        path: path_to_string(&target_path),
    })
}

#[tauri::command]
pub fn delete_workspace_entry(
    options: DeleteWorkspaceEntryOptions,
) -> Result<DeleteWorkspaceEntryResult, String> {
    let root_path = PathBuf::from(&options.root_path);
    let target_path = PathBuf::from(&options.path);
    let archived_path = move_workspace_entry_to_archive(&root_path, &target_path)?;

    Ok(DeleteWorkspaceEntryResult {
        ok: true,
        path: options.path,
        archived_path: path_to_string(&archived_path),
    })
}

#[tauri::command]
pub fn write_text_file(options: WriteTextFileOptions) -> Result<BasicPathResult, String> {
    fs::write(&options.file_path, options.text).map_err(error_to_string)?;
    Ok(BasicPathResult {
        path: options.file_path,
    })
}

#[tauri::command]
pub fn read_text_file(options: ReadTextFileOptions) -> Result<ReadTextFileResult, String> {
    let text = fs::read_to_string(&options.file_path).map_err(error_to_string)?;
    Ok(ReadTextFileResult {
        file_path: options.file_path,
        text,
    })
}

#[tauri::command]
pub fn save_text_file(options: SaveTextFileOptions) -> Result<SaveFileResult, String> {
    let Some(file_path) =
        prompt_save_path(options.default_path.as_deref(), options.filters.as_deref())
    else {
        return Ok(SaveFileResult {
            canceled: true,
            file_path: None,
        });
    };

    fs::write(&file_path, options.text).map_err(error_to_string)?;
    Ok(SaveFileResult {
        canceled: false,
        file_path: Some(path_to_string(&file_path)),
    })
}

#[tauri::command]
pub fn open_text_file(options: OpenTextFileOptions) -> Result<OpenTextFileResult, String> {
    let mut dialog = FileDialog::new();
    apply_filters(&mut dialog, options.filters.as_deref());

    let Some(file_path) = dialog.pick_file() else {
        return Ok(OpenTextFileResult {
            canceled: true,
            file_path: None,
            text: None,
        });
    };

    let text = fs::read_to_string(&file_path).map_err(error_to_string)?;
    Ok(OpenTextFileResult {
        canceled: false,
        file_path: Some(path_to_string(&file_path)),
        text: Some(text),
    })
}

#[tauri::command]
pub fn save_binary_file(options: SaveBinaryFileOptions) -> Result<SaveFileResult, String> {
    let Some(file_path) =
        prompt_save_path(options.default_path.as_deref(), options.filters.as_deref())
    else {
        return Ok(SaveFileResult {
            canceled: true,
            file_path: None,
        });
    };

    fs::write(&file_path, options.bytes).map_err(error_to_string)?;
    Ok(SaveFileResult {
        canceled: false,
        file_path: Some(path_to_string(&file_path)),
    })
}

#[tauri::command]
pub fn copy_image_to_clipboard(options: CopyImageToClipboardOptions) -> Result<bool, String> {
    if options.bytes.is_empty() {
        return Err("Clipboard image bytes cannot be empty.".into());
    }

    let decoded = image::load_from_memory(&options.bytes).map_err(error_to_string)?;
    let rgba = decoded.to_rgba8();
    let (width, height) = decoded.dimensions();

    let mut clipboard = Clipboard::new().map_err(error_to_string)?;
    clipboard
        .set_image(ImageData {
            width: width as usize,
            height: height as usize,
            bytes: Cow::Owned(rgba.into_raw()),
        })
        .map_err(error_to_string)?;

    Ok(true)
}

fn read_workspace_children_internal(
    directory_path: &Path,
    sort_mode: WorkspaceSortMode,
) -> Result<Vec<WorkspaceNode>, String> {
    let mut children = Vec::new();

    for entry in fs::read_dir(directory_path).map_err(error_to_string)? {
        let entry = entry.map_err(error_to_string)?;
        let file_name = entry.file_name();
        let name = file_name.to_string_lossy();

        if name.starts_with('.') {
            continue;
        }

        let entry_path = entry.path();
        let entry_file_type = entry.file_type().map_err(error_to_string)?;

        if entry_file_type.is_dir() {
            if should_skip_workspace_directory(&name) {
                continue;
            }

            let entry_metadata = entry.metadata().map_err(error_to_string)?;
            children.push(build_workspace_directory_stub(&entry_path, false, &entry_metadata));
            continue;
        }

        if !entry_file_type.is_file() {
            continue;
        }

        let Some(file_type) = resolve_workspace_file_type_from_name(&name) else {
            continue;
        };

        let entry_metadata = entry.metadata().map_err(error_to_string)?;
        children.push(WorkspaceNode {
            node_type: "file".into(),
            file_type: Some(file_type.as_str().to_string()),
            name: name.into_owned(),
            path: path_to_string(&entry_path),
            updated_at: get_entry_updated_at(&entry_metadata),
            created_at: get_entry_created_at(&entry_metadata),
            file_count: 1,
            children: None,
        });
    }

    sort_workspace_nodes(&mut children, sort_mode);
    Ok(children)
}

fn build_workspace_directory_stub(
    directory_path: &Path,
    is_root: bool,
    metadata: &fs::Metadata,
) -> WorkspaceNode {
    WorkspaceNode {
        node_type: "directory".into(),
        file_type: None,
        name: if is_root {
            directory_path
                .file_name()
                .map(|value| value.to_string_lossy().into_owned())
                .unwrap_or_else(|| path_to_string(directory_path))
        } else {
            directory_path
                .file_name()
                .map(|value| value.to_string_lossy().into_owned())
                .unwrap_or_else(|| path_to_string(directory_path))
        },
        path: path_to_string(directory_path),
        updated_at: get_entry_updated_at(metadata),
        created_at: get_entry_created_at(metadata),
        file_count: 0,
        children: None,
    }
}

fn find_first_workspace_file_path(root_path: &Path) -> Result<Option<String>, String> {
    for entry in fs::read_dir(root_path).map_err(error_to_string)? {
        let entry = entry.map_err(error_to_string)?;
        let file_name = entry.file_name();
        let name = file_name.to_string_lossy();

        if name.starts_with('.') {
            continue;
        }

        let entry_path = entry.path();
        let entry_file_type = entry.file_type().map_err(error_to_string)?;

        if entry_file_type.is_dir() {
            if should_skip_workspace_directory(&name) {
                continue;
            }

            if let Some(path) = find_first_workspace_file_path(&entry_path)? {
                return Ok(Some(path));
            }
            continue;
        }

        if entry_file_type.is_file() && resolve_workspace_file_type_from_name(&name).is_some() {
            return Ok(Some(path_to_string(&entry_path)));
        }
    }

    Ok(None)
}

fn sort_workspace_nodes(children: &mut [WorkspaceNode], sort_mode: WorkspaceSortMode) {
    children.sort_by(|left, right| {
        if sort_mode == WorkspaceSortMode::Name && left.node_type != right.node_type {
            return if left.node_type == "directory" {
                std::cmp::Ordering::Less
            } else {
                std::cmp::Ordering::Greater
            };
        }

        if sort_mode == WorkspaceSortMode::Updated || sort_mode == WorkspaceSortMode::Created {
            let left_time = if sort_mode == WorkspaceSortMode::Updated {
                left.updated_at
            } else {
                left.created_at
            };
            let right_time = if sort_mode == WorkspaceSortMode::Updated {
                right.updated_at
            } else {
                right.created_at
            };

            let diff = right_time
                .partial_cmp(&left_time)
                .unwrap_or(std::cmp::Ordering::Equal);
            if diff != std::cmp::Ordering::Equal {
                return diff;
            }
        }

        left.name.to_lowercase().cmp(&right.name.to_lowercase())
    });
}

fn move_workspace_entry_to_archive(
    root_path: &Path,
    target_path: &Path,
) -> Result<PathBuf, String> {
    let metadata = fs::metadata(target_path).map_err(error_to_string)?;
    let archive_path = root_path.join(".Archive");
    fs::create_dir_all(&archive_path).map_err(error_to_string)?;

    let target_name = target_path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "Workspace entry is missing a file name.".to_string())?;

    let archived_name = if metadata.is_dir() {
        resolve_available_directory_name(&archive_path, target_name)?
    } else {
        let target_path_buf = PathBuf::from(target_name);
        let extension = target_path_buf
            .extension()
            .and_then(|ext| ext.to_str())
            .map(|ext| format!(".{ext}"))
            .unwrap_or_else(|| workspace_file_extension(WorkspaceFileType::Mermaid).into());
        let stem = target_path_buf
            .file_stem()
            .and_then(|stem| stem.to_str())
            .unwrap_or(target_name);
        resolve_available_file_name(&archive_path, stem, &extension)?
    };

    let archived_path = archive_path.join(archived_name);
    fs::rename(target_path, &archived_path).map_err(error_to_string)?;
    Ok(archived_path)
}

fn should_skip_workspace_directory(name: &str) -> bool {
    SKIPPED_WORKSPACE_DIRECTORY_NAMES
        .iter()
        .any(|candidate| candidate.eq_ignore_ascii_case(name))
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum WorkspaceFileType {
    Mermaid,
    Drawio,
}

impl WorkspaceFileType {
    fn as_str(self) -> &'static str {
        match self {
            WorkspaceFileType::Mermaid => "mermaid",
            WorkspaceFileType::Drawio => "drawio",
        }
    }
}

fn normalize_workspace_file_type(file_type: Option<&str>) -> WorkspaceFileType {
    match file_type {
        Some("drawio") => WorkspaceFileType::Drawio,
        _ => WorkspaceFileType::Mermaid,
    }
}

fn workspace_file_extension(file_type: WorkspaceFileType) -> &'static str {
    match file_type {
        WorkspaceFileType::Mermaid => ".mmd",
        WorkspaceFileType::Drawio => ".drawio",
    }
}

fn default_workspace_file_contents(file_type: WorkspaceFileType) -> &'static str {
    match file_type {
        WorkspaceFileType::Mermaid => DEFAULT_MERMAID_FILE_CONTENT,
        WorkspaceFileType::Drawio => DEFAULT_DRAWIO_FILE_CONTENT,
    }
}

fn resolve_workspace_file_type_from_path(path: &Path) -> Option<WorkspaceFileType> {
    path.file_name()
        .and_then(|name| name.to_str())
        .and_then(resolve_workspace_file_type_from_name)
}

fn resolve_workspace_file_type_from_name(name: &str) -> Option<WorkspaceFileType> {
    let lowered = name.to_ascii_lowercase();

    if lowered.ends_with(".drawio") {
        return Some(WorkspaceFileType::Drawio);
    }

    if lowered.ends_with(".mmd") {
        return Some(WorkspaceFileType::Mermaid);
    }

    None
}

fn resolve_available_directory_name(parent_path: &Path, base_name: &str) -> Result<String, String> {
    for attempt in 0.. {
        let candidate = if attempt == 0 {
            base_name.to_string()
        } else {
            format!("{base_name} {}", attempt + 1)
        };

        if !parent_path.join(&candidate).exists() {
            return Ok(candidate);
        }
    }

    unreachable!()
}

fn resolve_available_file_name(
    parent_path: &Path,
    base_name: &str,
    extension: &str,
) -> Result<String, String> {
    let normalized_base = base_name.strip_suffix(extension).unwrap_or(base_name);
    for attempt in 0.. {
        let candidate = if attempt == 0 {
            format!("{normalized_base}{extension}")
        } else {
            format!("{normalized_base} {}{extension}", attempt + 1)
        };

        if !parent_path.join(&candidate).exists() {
            return Ok(candidate);
        }
    }

    unreachable!()
}

fn is_within_workspace(root_path: &Path, candidate_path: &Path) -> bool {
    candidate_path
        .strip_prefix(root_path)
        .map(|_| true)
        .unwrap_or(false)
}

fn get_entry_updated_at(metadata: &fs::Metadata) -> f64 {
    system_time_to_millis(metadata.modified().unwrap_or(SystemTime::UNIX_EPOCH))
}

fn get_entry_created_at(metadata: &fs::Metadata) -> f64 {
    let created = metadata.created().or_else(|_| metadata.modified());
    system_time_to_millis(created.unwrap_or(SystemTime::UNIX_EPOCH))
}

fn system_time_to_millis(time: SystemTime) -> f64 {
    time.duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as f64)
        .unwrap_or(0.0)
}

fn path_to_string(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

fn apply_filters(dialog: &mut FileDialog, filters: Option<&[FileFilter]>) {
    if let Some(filters) = filters {
        for filter in filters {
            let extensions: Vec<&str> = filter.extensions.iter().map(String::as_str).collect();
            if !extensions.is_empty() {
                let new_dialog = std::mem::replace(dialog, FileDialog::new());
                *dialog = new_dialog.add_filter(&filter.name, &extensions);
            }
        }
    }
}

fn prompt_save_path(default_path: Option<&str>, filters: Option<&[FileFilter]>) -> Option<PathBuf> {
    let mut dialog = FileDialog::new();
    apply_filters(&mut dialog, filters);

    if let Some(default_path) = default_path {
        let default_path = PathBuf::from(default_path);
        if let Some(parent) = default_path.parent() {
            dialog = dialog.set_directory(parent);
        }
        if let Some(file_name) = default_path.file_name().and_then(|value| value.to_str()) {
            dialog = dialog.set_file_name(file_name);
        }
    }

    dialog.save_file()
}

fn error_to_string(error: impl std::fmt::Display) -> String {
    error.to_string()
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum WorkspaceSortMode {
    Name,
    Updated,
    Created,
}

fn normalize_workspace_sort_mode(sort_mode: Option<&str>) -> WorkspaceSortMode {
    match sort_mode {
        Some("updated") => WorkspaceSortMode::Updated,
        Some("created") => WorkspaceSortMode::Created,
        _ => WorkspaceSortMode::Name,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn temp_workspace(name: &str) -> PathBuf {
        let unique = format!(
            "mermaid-tool-{}-{}-{}",
            name,
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos()
        );
        let path = std::env::temp_dir().join(unique);
        fs::create_dir_all(&path).unwrap();
        path
    }

    #[test]
    fn workspace_tree_filters_hidden_and_unsupported_files() {
        let root = temp_workspace("tree");
        fs::create_dir_all(root.join("flows")).unwrap();
        fs::create_dir_all(root.join("node_modules").join("pkg")).unwrap();
        fs::write(root.join("visible.mmd"), "flowchart TD\n").unwrap();
        fs::write(root.join("board.drawio"), DEFAULT_DRAWIO_FILE_CONTENT).unwrap();
        fs::write(root.join("notes.txt"), "ignore").unwrap();
        fs::write(root.join("plain.xml"), "<xml />").unwrap();
        fs::write(root.join(".hidden.mmd"), "hidden").unwrap();
        fs::write(root.join("flows").join("child.mmd"), "flowchart TD\n").unwrap();
        fs::write(
            root.join("node_modules").join("pkg").join("ignored.mmd"),
            "flowchart TD\n",
        )
        .unwrap();

        let children = read_workspace_children_internal(&root, WorkspaceSortMode::Name).unwrap();
        let names: Vec<String> = children.into_iter().map(|node| node.name).collect();

        assert!(names.contains(&"flows".to_string()));
        assert!(names.contains(&"visible.mmd".to_string()));
        assert!(names.contains(&"board.drawio".to_string()));
        assert!(!names.contains(&"node_modules".to_string()));
        assert!(!names.contains(&"notes.txt".to_string()));
        assert!(!names.contains(&"plain.xml".to_string()));
        assert!(!names.contains(&".hidden.mmd".to_string()));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn resolve_available_file_name_adds_numeric_suffix() {
        let root = temp_workspace("file-name");
        fs::write(root.join("untitled.mmd"), "flowchart TD\n").unwrap();

        let next = resolve_available_file_name(&root, "untitled", ".mmd").unwrap();
        assert_eq!(next, "untitled 2.mmd");

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn delete_moves_entry_to_hidden_archive() {
        let root = temp_workspace("archive");
        let file_path = root.join("draft.mmd");
        fs::write(&file_path, "flowchart TD\n").unwrap();

        let archived_path = move_workspace_entry_to_archive(&root, &file_path).unwrap();
        assert!(!file_path.exists());
        assert!(archived_path.exists());
        assert!(archived_path.to_string_lossy().contains(".Archive"));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn create_workspace_entry_creates_default_mmd_file() {
        let root = temp_workspace("create-file");
        let result = create_workspace_entry(CreateWorkspaceEntryOptions {
            parent_path: path_to_string(&root),
            kind: "file".into(),
            name: None,
            file_type: None,
        })
        .unwrap();

        assert_eq!(result.kind, "file");
        assert!(result.path.ends_with("untitled.mmd"));
        assert_eq!(result.file_type.as_deref(), Some("mermaid"));
        let text = fs::read_to_string(&result.path).unwrap();
        assert_eq!(text, "flowchart TD\n");

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn create_workspace_entry_creates_default_drawio_file() {
        let root = temp_workspace("create-drawio");
        let result = create_workspace_entry(CreateWorkspaceEntryOptions {
            parent_path: path_to_string(&root),
            kind: "file".into(),
            name: Some("board".into()),
            file_type: Some("drawio".into()),
        })
        .unwrap();

        assert_eq!(result.kind, "file");
        assert!(result.path.ends_with("board.drawio"));
        assert_eq!(result.file_type.as_deref(), Some("drawio"));
        let text = fs::read_to_string(&result.path).unwrap();
        assert_eq!(text, DEFAULT_DRAWIO_FILE_CONTENT);

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn rename_workspace_entry_preserves_mmd_suffix() {
        let root = temp_workspace("rename-file");
        let file_path = root.join("draft.mmd");
        fs::write(&file_path, "flowchart TD\n").unwrap();

        let result = rename_workspace_entry(RenameWorkspaceEntryOptions {
            path: path_to_string(&file_path),
            next_name: "renamed".into(),
        })
        .unwrap();

        assert!(result.path.ends_with("renamed.mmd"));
        assert!(PathBuf::from(&result.path).exists());
        assert!(!file_path.exists());

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn rename_workspace_entry_preserves_drawio_suffix() {
        let root = temp_workspace("rename-drawio");
        let file_path = root.join("draft.drawio");
        fs::write(&file_path, DEFAULT_DRAWIO_FILE_CONTENT).unwrap();

        let result = rename_workspace_entry(RenameWorkspaceEntryOptions {
            path: path_to_string(&file_path),
            next_name: "renamed".into(),
        })
        .unwrap();

        assert!(result.path.ends_with("renamed.drawio"));
        assert!(PathBuf::from(&result.path).exists());
        assert!(!file_path.exists());

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn move_workspace_entry_moves_file_within_workspace() {
        let root = temp_workspace("move-file");
        let source_dir = root.join("source");
        let target_dir = root.join("target");
        fs::create_dir_all(&source_dir).unwrap();
        fs::create_dir_all(&target_dir).unwrap();
        let source_file = source_dir.join("diagram.mmd");
        fs::write(&source_file, "flowchart TD\n").unwrap();

        let result = move_workspace_entry(MoveWorkspaceEntryOptions {
            path: path_to_string(&source_file),
            target_parent_path: path_to_string(&target_dir),
            root_path: path_to_string(&root),
        })
        .unwrap();

        let moved_path = target_dir.join("diagram.mmd");
        assert_eq!(result.path, path_to_string(&moved_path));
        assert!(moved_path.exists());
        assert!(!source_file.exists());

        fs::remove_dir_all(root).unwrap();
    }
}
