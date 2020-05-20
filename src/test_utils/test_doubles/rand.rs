use rand::distributions::{Distribution, Standard};

mockall::mock! {
    pub Random {
        fn random<T: 'static>() -> T where
        Standard: Distribution<T>;
    }
}

pub fn random<T: 'static>() -> T
where
    Standard: Distribution<T>,
{
    MockRandom::random()
}
