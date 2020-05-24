use std::sync::Arc;

use serenity::prelude::{Mutex, TypeMapKey};
use thiserror::Error;

cfg_if::cfg_if! {
    if #[cfg(test)] {

        use crate::test_doubles::reqwest::blocking::Client as ReqwestClient;
        use crate::test_doubles::serenity::{
            client::{bridge::gateway::ShardManager},
        };
    } else {

        use reqwest::blocking::Client as ReqwestClient;
        use serenity::{
            client::{bridge::gateway::ShardManager},
        };
    }
}

pub struct ShardManagerContainer;

impl TypeMapKey for ShardManagerContainer {
    type Value = Arc<Mutex<ShardManager>>;
}

#[derive(Error, Debug)]
pub enum ShardManagerError {
    #[error("Could not find shard manager in share map.")]
    MissingFromShareMap,
}

pub struct ClientContainer;

impl TypeMapKey for ClientContainer {
    type Value = ReqwestClient;
}

#[derive(Error, Debug)]
pub enum ClientError {
    #[error("Could not find client in share map.")]
    MissingFromShareMap,
}
