use serde::Serialize;
use std::{fs, io::Read, path::Path, time::UNIX_EPOCH};
use tauri::Manager;
use tauri_plugin_opener::OpenerExt;

// 同步目录扫描命令，只读取指定目录的当前层文件。

const IMAGE_EXTENSIONS: &[&str] = &["jpg", "jpeg", "png", "webp", "gif", "avif", "tif", "tiff"];

#[derive(Serialize)]
pub struct FileMetadata {
    name: String,
    path: String,
    #[serde(rename = "type")]
    file_type: String,
    size: u64,
    #[serde(rename = "modifiedAt")]
    modified_at: u64,
}

#[derive(Serialize)]
pub struct DirectoryMetadata {
    name: String,
    path: String,
}

/// 读取文件开头并判断是否为 image 支持的图片格式。
fn has_valid_image_header(path: &Path) -> Result<bool, String> {
    let mut file = fs::File::open(path)
        .map_err(|error| format!("无法打开文件 {}: {error}", path.display()))?;
    let mut buffer = [0_u8; 64];
    let length = file
        .read(&mut buffer)
        .map_err(|error| format!("无法读取文件头 {}: {error}", path.display()))?;
    let header = &buffer[..length];

    Ok(image::guess_format(header).is_ok())
}

/// 读取指定目录下的第一层子目录。
#[tauri::command]
pub fn read_subdirectories(path: String) -> Result<Vec<DirectoryMetadata>, String> {
    let entries = fs::read_dir(&path).map_err(|error| format!("无法读取目录 {path}: {error}"))?;
    let mut directories = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|error| format!("无法读取目录项 {path}: {error}"))?;
        let file_type = entry
            .file_type()
            .map_err(|error| format!("无法读取文件类型 {}: {error}", entry.path().display()))?;

        if !file_type.is_dir() {
            continue;
        }

        directories.push(DirectoryMetadata {
            name: entry.file_name().to_string_lossy().into_owned(),
            path: entry.path().to_string_lossy().into_owned(),
        });
    }

    Ok(directories)
}

/// 读取当前目录中的全部文件元数据。
#[tauri::command]
pub fn read_directory_files(path: String) -> Result<Vec<FileMetadata>, String> {
    let entries = fs::read_dir(&path).map_err(|error| format!("无法读取目录 {path}: {error}"))?;
    let mut files = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|error| format!("无法读取目录项 {path}: {error}"))?;
        let file_type = entry
            .file_type()
            .map_err(|error| format!("无法读取文件类型 {}: {error}", entry.path().display()))?;

        if !file_type.is_file() {
            continue;
        }

        let metadata = entry
            .metadata()
            .map_err(|error| format!("无法读取文件元数据 {}: {error}", entry.path().display()))?;
        let name = entry.file_name().to_string_lossy().into_owned();
        let extension = Path::new(&name)
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or_default()
            .to_lowercase();

        if !IMAGE_EXTENSIONS.contains(&extension.as_str()) {
            continue;
        }

        if !has_valid_image_header(&entry.path())? {
            continue;
        }

        files.push(FileMetadata {
            name,
            path: entry.path().to_string_lossy().into_owned(),
            file_type: extension,
            size: metadata.len(),
            modified_at: metadata
                .modified()
                .map_err(|error| {
                    format!("无法读取文件修改时间 {}: {error}", entry.path().display())
                })?
                .duration_since(UNIX_EPOCH)
                .map_err(|error| format!("文件修改时间无效 {}: {error}", entry.path().display()))?
                .as_millis() as u64,
        });
    }

    Ok(files)
}

/// 读取当前目录中的指定普通文件并返回原始字节。
#[tauri::command]
pub fn read_file(path: String, name: String) -> Result<tauri::ipc::Response, String> {
    let root = Path::new(&path);
    let file_path = root.join(&name);

    // 文件名必须是单个路径段，避免通过相对路径读取目录外文件。
    if Path::new(&name)
        .file_name()
        .and_then(|value| value.to_str())
        != Some(name.as_str())
    {
        return Err("文件名无效".to_string());
    }

    let metadata = file_path
        .metadata()
        .map_err(|error| format!("无法读取文件元数据 {}: {error}", file_path.display()))?;
    if !metadata.is_file() {
        return Err(format!("不是普通文件: {}", file_path.display()));
    }

    fs::read(&file_path)
        .map(tauri::ipc::Response::new)
        .map_err(|error| format!("无法读取文件 {}: {error}", file_path.display()))
}

/// 校验目录后使用系统文件管理器打开它。
#[tauri::command]
pub fn open_directory(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let metadata = fs::metadata(&path).map_err(|error| format!("无法读取目录 {path}: {error}"))?;
    if !metadata.is_dir() {
        return Err(format!("不是目录: {path}"));
    }

    app.opener()
        .open_path(&path, None::<&str>)
        .map_err(|error| format!("无法打开目录 {path}: {error}"))
}

/// 使用系统文件管理器打开应用数据库所在目录。
#[tauri::command]
pub fn open_data_directory(app: tauri::AppHandle) -> Result<(), String> {
    let path = app
        .path()
        .app_config_dir()
        .map_err(|error| format!("无法获取数据目录: {error}"))?;
    fs::create_dir_all(&path)
        .map_err(|error| format!("无法创建数据目录 {}: {error}", path.display()))?;
    let directory = path.to_string_lossy().into_owned();

    app.opener()
        .open_path(directory, None::<&str>)
        .map_err(|error| format!("无法打开数据目录 {}: {error}", path.display()))
}
