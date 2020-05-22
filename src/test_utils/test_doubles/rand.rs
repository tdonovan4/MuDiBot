use rand::distributions::{Distribution, Standard};

mockall::mock! {
    pub Random {
        fn random<T: 'static>() -> T;
    }
}

pub fn random<T: 'static>() -> T
where
    Standard: Distribution<T>,
{
    MockRandom::random()
}

pub fn thread_rng() -> rand::rngs::ThreadRng {
    ::rand::thread_rng()
}

pub mod distributions {

    pub mod uniform {
        use super::super::MockRandom;
        use rand::{distributions::Distribution, Rng};
        use std::ops::Range;

        pub struct Uniform<T> {
            _range: Range<T>,
        }

        impl<T> From<Range<T>> for Uniform<T> {
            fn from(range: Range<T>) -> Self {
                Self { _range: range }
            }
        }

        impl<T: 'static> Distribution<T> for Uniform<T> {
            fn sample<R: Rng + ?Sized>(&self, _rng: &mut R) -> T {
                MockRandom::random()
            }
        }
    }
}
