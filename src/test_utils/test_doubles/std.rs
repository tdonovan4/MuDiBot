pub mod time {
    use std::time::{Duration, SystemTime as StdSystemTime, SystemTimeError};

    pub use MockSystemTime as SystemTime;

    mockall::mock! {
        pub SystemTime {
            fn now() -> Self;
            fn duration_since(&self, earlier: StdSystemTime) -> Result<Duration, SystemTimeError>;
        }
    }
}

pub mod path {
    use std::{
        fmt::{Debug, Formatter, Result},
        ops::Deref,
    };

    pub use MockPath as Path;

    mockall::mock! {
        pub Path {
            fn join(&self, path: &str) -> MockPathBuf;
            /*
             * https://github.com/asomers/mockall/issues/85
             * fn parent<'a>(&self) -> Option<&'a Self>;
             */
             fn parent(&self) -> Option<Self>;
        }
    }

    // Won't work in mock!
    impl AsRef<MockPath> for MockPath {
        fn as_ref(&self) -> &MockPath {
            self
        }
    }

    pub use MockPathBuf as PathBuf;

    mockall::mock! {
        pub PathBuf {
            fn exists(&self) -> bool;
        }

        trait Debug {
            fn fmt<'a>(&self, f: &mut Formatter<'a>) -> Result;
        }

        trait Deref {
            type Target = MockPath;

            fn deref(&self) -> &MockPath;
        }
    }
}

pub mod fs {
    use super::path::Path;
    use std::io::{Read, Result, Write};

    pub use MockFile as File;

    mockall::mock! {
        pub File {
            fn create(path: &Path) -> Result<File>;
            fn open(path: &Path) -> Result<File>;
        }

        trait Write {
            fn write(&mut self, buf: &[u8]) -> Result<usize>;
            fn flush(&mut self) -> Result<()>;
        }

        trait Read {
            fn read(&mut self, buf: &mut [u8]) -> Result<usize>;
        }
    }

    pub fn create_dir_all<P: AsRef<Path>>(_path: P) -> Result<()> {
        // Black hole
        Ok(())
    }
}
