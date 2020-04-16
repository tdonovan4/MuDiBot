pub use MockSystem as System;

mockall::mock! {
    pub System {
        fn new() -> Self;
    }

    trait SystemExt {
        fn refresh_all(&mut self);
        /*
        * https://github.com/asomers/mockall/issues/85
        * fn get_process<'a>(&self, pid: i32) -> Option<&'a MockProcess>;
        */
        fn get_process(&self, pid: i32) -> Option<MockProcess>;
    }
}

pub trait SystemExt {
    fn refresh_all(&mut self);
    /*
     * https://github.com/asomers/mockall/issues/85
     * fn get_process<'a>(&self, pid: i32) -> Option<&'a MockProcess>;
     */
    fn get_process(&self, pid: i32) -> Option<MockProcess>;
}

mockall::mock! {
    pub Process {}

    trait ProcessExt {
        fn start_time(&self) -> u64;
    }
}

pub trait ProcessExt {
    fn start_time(&self) -> u64;
}
