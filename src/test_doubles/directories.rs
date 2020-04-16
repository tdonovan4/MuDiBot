use super::std::path::MockPath;

pub use MockProjectDirs as ProjectDirs;

mockall::mock! {
    pub ProjectDirs {
        fn from(
            qualifier: &str,
            organization: &str,
            application: &str
        ) -> Option<Self>;
        fn config_dir(&self) -> &MockPath;
    }
}
