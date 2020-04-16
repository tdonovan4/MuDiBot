pub mod chrono;
pub mod directories;
pub mod serenity;
pub mod std;
pub mod sysinfo;

use once_cell::sync::Lazy;
use parking_lot::{Mutex, MutexGuard};

pub static CONTEXT_SYNCHRONIZER: Lazy<ContextSynchronizer> =
    Lazy::new(|| ContextSynchronizer::new());

pub struct ContextSynchronizer {
    meta_lock: Mutex<()>,
    utc_now: Mutex<()>,
    project_dirs_from: Mutex<()>,
    file_create: Mutex<()>,
    file_open: Mutex<()>,
    system_new: Mutex<()>,
    system_time_now: Mutex<()>,
}

impl ContextSynchronizer {
    fn new() -> Self {
        Self {
            meta_lock: Mutex::new(()),
            utc_now: Mutex::new(()),
            project_dirs_from: Mutex::new(()),
            file_create: Mutex::new(()),
            file_open: Mutex::new(()),
            system_new: Mutex::new(()),
            system_time_now: Mutex::new(()),
        }
    }

    fn from_name(&self, name: &str) -> Option<MutexGuard<()>> {
        Some(match name {
            "utc_now" => self.utc_now.lock(),
            "project_dirs_from" => self.project_dirs_from.lock(),
            "file_create" => self.file_create.lock(),
            "file_open" => self.file_open.lock(),
            "system_new" => self.system_new.lock(),
            "system_time_now" => self.system_time_now.lock(),
            _ => return None,
        })
    }

    pub fn get_ctx_guards(&self, names: Vec<&str>) -> Vec<MutexGuard<()>> {
        let _meta_guard = self.meta_lock.lock();
        let mut guards = Vec::new();
        for name in names {
            if let Some(guard) = self.from_name(name) {
                guards.push(guard);
            } else {
                panic!("Wrong name: {}", name);
            }
        }
        guards
    }
}
