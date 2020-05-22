use thiserror::Error;

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

#[derive(Error, Debug, PartialEq)]
pub enum BoundedIntegerError {
    #[error("The lower bound is bigger than the upper bound")]
    InvalidBound,
    #[error("Integer '{0}' is smaller than lower bound")]
    TooSmall(String),
    #[error("Integer '{0}' is bigger than upper bound")]
    TooBig(String),
}

#[derive(Debug, Copy, Clone, PartialEq)]
pub struct BoundedInteger<T: PartialOrd + Copy> {
    int: T,
    lower_bound: T,
    upper_bound: T,
}

impl<T: PartialOrd + Copy + std::fmt::Display> BoundedInteger<T> {
    pub fn new(int: T, lower: T, upper: T) -> Result<Self, BoundedIntegerError> {
        // First let's make sure the lower bound is actually lower than the upper
        if lower <= upper {
            // Make sure int is in bound
            if int >= lower {
                if int <= upper {
                    Ok(Self {
                        int,
                        lower_bound: lower,
                        upper_bound: upper,
                    })
                } else {
                    Err(BoundedIntegerError::TooBig(int.to_string()))
                }
            } else {
                Err(BoundedIntegerError::TooSmall(int.to_string()))
            }
        } else {
            Err(BoundedIntegerError::InvalidBound)
        }
    }

    pub fn value(&self) -> T {
        // Type is copy
        self.int
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn get_value_in_bound() {
        assert_eq!(BoundedInteger::new(13, 0, 13).unwrap().value(), 13,);
    }

    #[test]
    fn smaller_lower_bound() {
        assert_eq!(
            BoundedInteger::new(14, 14, 13),
            Err(BoundedIntegerError::InvalidBound),
        );
    }

    #[test]
    fn too_small() {
        assert_eq!(
            BoundedInteger::new(-1, 0, 1),
            Err(BoundedIntegerError::TooSmall("-1".to_string())),
        );
    }

    #[test]
    fn too_big() {
        assert_eq!(
            BoundedInteger::new(2, 1, 1),
            Err(BoundedIntegerError::TooBig("2".to_string())),
        );
    }
}
