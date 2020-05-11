pub mod chrono;
pub mod directories;
pub mod reqwest;
pub mod serenity;
pub mod std;
pub mod sysinfo;

use once_cell::sync::Lazy;
use parking_lot::{Mutex, MutexGuard};

pub static CONTEXT_SYNCHRONIZER: Lazy<ContextSynchronizer> = Lazy::new(ContextSynchronizer::new);

pub struct ContextSynchronizer {
    meta_lock: Mutex<()>,
    utc_now: Mutex<()>,
    project_dirs_from: Mutex<()>,
    file_create: Mutex<()>,
    file_open: Mutex<()>,
    system_new: Mutex<()>,
    system_time_now: Mutex<()>,
    channel_id_from_str: Mutex<()>,
    user_id_from_str: Mutex<()>,
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
            channel_id_from_str: Mutex::new(()),
            user_id_from_str: Mutex::new(()),
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
            "channel_id_from_str" => self.channel_id_from_str.lock(),
            "user_id_from_str" => self.user_id_from_str.lock(),
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
                // Only for tests, panicking is ok
                panic!("Wrong name: {}", name);
            }
        }
        guards
    }
}
