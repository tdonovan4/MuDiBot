mod logger;

use std::{collections::HashSet, env, sync::Arc};

use mudibot::commands::{
    fun::commands::*, general::commands::*, owner::commands::*, user::commands::*,
};
use mudibot::{
    config,
    containers::{ClientContainer, ShardManagerContainer},
    event_handler::Handler,
    localization, util,
};

use reqwest::blocking::Client as ReqwestClient;
use serenity::{
    client::Client,
    framework::{standard::macros::group, StandardFramework},
    prelude::RwLock,
};
use thiserror::Error;

#[macro_use]
extern crate log;

#[group]
#[commands(ping, info, say)]
struct General;

#[group]
#[commands(avatar)]
struct User;

#[group]
#[owners_only]
#[commands(setactivity, kill, restart)]
struct Owner;

#[group]
#[commands(gif, gifrandom, flipcoin, roll)]
struct Fun;

#[derive(Error, Debug)]
enum BotError {
    #[error(transparent)]
    Config(#[from] config::ConfigError),
    #[error(transparent)]
    L10N(#[from] localization::L10NError),
    #[error(
        "Please provide a Discord token for the bot in the environment \
        variable DISCORD_TOKEN or the config file"
    )]
    MissingToken,
    #[error("Error from serenity: {0}")]
    Serenity(#[from] serenity::Error),
    #[error("Error with client: {0}")]
    Client(#[from] serenity::client::ClientError),
}

fn main() {
    // Ensure destructors are run bo moving main logic to run_bot()
    if let Err(e) = run_bot() {
        error!("{}", e);
        std::process::exit(1);
    }
}

fn run_bot() -> Result<(), BotError> {
    logger::init();

    let config = config::Config::new()?;
    // Init localization
    let bundle = localization::L10NBundle::new(config.get_locale())?;

    // Print that we're starting up
    info!("MuDiBot is starting up...");

    // Print configuration file location
    match util::get_project_dir() {
        Some(project_dir) => {
            info!(
                "Configuration file loaded from {}/config.toml",
                project_dir.config_dir().to_string_lossy()
            );
        }
        None => {
            // Most likely will never happen because config won't load without project dir
            warn!("Config was loaded, but cannot find the project directory")
        }
    }

    // Load token from env var (with priority) or config
    let token = match env::var("DISCORD_TOKEN") {
        Ok(token) => token,
        Err(_) => config
            .get_creds()
            .bot_token
            .as_ref()
            .ok_or(BotError::MissingToken)?
            .to_string(),
    };

    let prefix = config.get_prefix().to_string();

    let mut client = Client::new(token, Handler)?;

    {
        let mut data = client.data.write();
        data.insert::<ShardManagerContainer>(Arc::clone(&client.shard_manager));
        data.insert::<config::Config>(RwLock::new(config));
        data.insert::<localization::L10NBundle>(RwLock::new(bundle));
        data.insert::<ClientContainer>(ReqwestClient::new());
    }

    let info = client.cache_and_http.http.get_current_application_info()?;
    let mut owners = HashSet::new();
    owners.insert(info.owner.id);

    client.with_framework(
        StandardFramework::new()
            .configure(|c| c.owners(owners).prefix(prefix.as_str()))
            .before(|_ctx, msg, _cmd_name| {
                let base_msg = format!("{}<{}> -> {}", msg.author.name, msg.author.id, msg.content);

                if let Some(guild_id) = msg.guild_id {
                    info!(target: "cmd-guild","[{}-{}] {}", guild_id, msg.channel_id, base_msg);
                } else {
                    info!(target: "cmd-not-guild", "[{}] {}", msg.channel_id, base_msg);
                }
                true
            })
            .after(|_ctx, _msg, cmd_name, error| {
                if let Err(e) = error {
                    warn!("Error in {}: {:?}", cmd_name, e);
                }
            })
            .group(&GENERAL_GROUP)
            .group(&OWNER_GROUP)
            .group(&USER_GROUP)
            .group(&FUN_GROUP)
            .help(&HELP),
    );

    //Setup done, actually start
    client.start()?;

    Ok(())
}
