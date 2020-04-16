pub mod offset {
    pub use MockUtc as Utc;

    mockall::mock! {
        pub Utc {
            fn now() -> chrono::DateTime<chrono::offset::Utc>;
        }
    }
}
