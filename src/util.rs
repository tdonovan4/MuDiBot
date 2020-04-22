cfg_if::cfg_if! {
    if #[cfg(test)] {
        use crate::test_doubles::directories::ProjectDirs;
    } else {
        use directories::ProjectDirs;
    }
}

pub fn get_project_dir() -> Option<ProjectDirs> {
    ProjectDirs::from("dev", "tdonovan", "MuDiBot")
}
