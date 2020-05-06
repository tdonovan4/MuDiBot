pub mod blocking {
    use reqwest::Result;

    pub use MockResponse as Response;
    mockall::mock! {
        pub Response {
            fn text(self) -> Result<String>;
        }
    }

    pub use MockRequestBuilder as RequestBuilder;
    mockall::mock! {
        pub RequestBuilder {
            fn send(self) -> Result<Response>;
        }
    }

    pub use MockClient as Client;
    mockall::mock! {
        pub Client {
            fn get(&self, url: &str) -> RequestBuilder;
        }
    }
}
