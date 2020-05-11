mod commands;
mod config;
mod localization;
#[cfg(test)]
mod test_utils;
mod util;

use std::sync::Arc;

use serenity::{
    model::gateway::Activity,
    prelude::{Mutex, RwLock, TypeMapKey},
};
use thiserror::Error;

#[macro_use]
extern crate log;

cfg_if::cfg_if! {
    if #[cfg(test)] {
        pub use test_utils::test_doubles as test_doubles;

        use crate::test_doubles::reqwest::blocking::Client as ReqwestClient;
        use test_doubles::serenity::{
            client::{bridge::gateway::ShardManager, Context, EventHandler},
            model::{gateway::Ready, event::ResumedEvent},
        };
    } else {
        use std::{collections::HashSet, env};

        use env_logger::{Env, Builder, Target};
        use reqwest::blocking::Client as ReqwestClient;
        use serenity::{
            client::{bridge::gateway::ShardManager, Client, Context, EventHandler},
            framework::{standard::macros::group, StandardFramework},
            model::{gateway::Ready, event::ResumedEvent},
        };

        use commands::{general::commands::*, owner::commands::*, user::commands::*, fun::commands::*};

        #[group]
        #[commands(ping, info, say)]
        struct General;

        #[group]
        #[commands(avatar)]
        struct User;

        #[group]
        #[owners_only]
        #[commands(setactivity)]
        struct Owner;

        #[group]
        #[commands(gif, gifrandom)]
        struct Fun;
    }
}

struct ShardManagerContainer;

impl TypeMapKey for ShardManagerContainer {
    type Value = Arc<Mutex<ShardManager>>;
}

struct ClientContainer;

impl TypeMapKey for ClientContainer {
    type Value = ReqwestClient;
}

#[derive(Error, Debug)]
pub enum ClientError {
    #[error("Could not find client in share map.")]
    MissingFromShareMap,
}

struct Handler;

impl EventHandler for Handler {
    fn ready(&self, ctx: Context, ready: Ready) {
        //set activity
        let data = ctx.data.read();
        match data.get::<config::Config>() {
            Some(config) => {
                if let Some(activity) = config.read().get_activity() {
                    ctx.set_activity(Activity::playing(activity));
                }
            }
            None => warn!("{}", config::ConfigError::MissingFromShareMap),
        }

        info!("{} is connected!", ready.user.name);
    }

    fn resume(&self, _ctx: Context, _: ResumedEvent) {
        info!("Resumed");
    }
}

#[cfg(not(test))]
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

#[cfg(not(test))]
fn main() {
    // Ensure destructors are run bo moving main logic to run_bot()
    if let Err(e) = run_bot() {
        error!("{}", e);
        std::process::exit(1);
    } else {
        std::process::exit(0);
    }
}

#[cfg(not(test))]
fn run_bot() -> Result<(), BotError> {
    let env = Env::default()
        .filter_or("RUST_LOG", "info")
        .write_style_or("RUST_LOG_STYLE", "auto");

    Builder::from_env(env).target(Target::Stderr).init();

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
                    info!("[{}-{}] {}", guild_id, msg.channel_id, base_msg);
                } else {
                    info!("[{}] {}", msg.channel_id, base_msg);
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

#[cfg(test)]
mod tests {
    use super::*;

    use localization::{L10NBundle, L10NError};
    use test_doubles::serenity::{
        client::MockContext, http::client::Http, model::user::CurrentUser,
    };

    #[test]
    fn ready_event() -> Result<(), L10NError> {
        // Mock ctx
        let mut mock_context = MockContext::new();
        mock_context.expect_set_activity().once().return_const(());
        let ctx = Context::_new(Some(mock_context), Http::new());
        {
            let mut data = ctx.data.write();
            data.insert::<L10NBundle>(RwLock::new(L10NBundle::new("en-US")?));
            data.insert::<config::Config>(RwLock::new(config::Config::default()));
        }

        Handler.ready(
            ctx,
            Ready {
                user: CurrentUser::_new(0, "TestBot".to_string()),
            },
        );

        Ok(())
    }

    #[test]
    fn ready_event_but_missing_config() -> Result<(), L10NError> {
        let ctx = Context::_new_bare();
        {
            let mut data = ctx.data.write();
            data.insert::<L10NBundle>(RwLock::new(L10NBundle::new("en-US")?));
        }

        Handler.ready(
            ctx,
            Ready {
                user: CurrentUser::_new(0, "TestBot".to_string()),
            },
        );

        Ok(())
    }

    #[test]
    fn resume_event() -> Result<(), L10NError> {
        let ctx = Context::_new_bare();
        {
            let mut data = ctx.data.write();
            data.insert::<L10NBundle>(RwLock::new(L10NBundle::new("en-US")?));
        }
        Handler.resume(ctx, ResumedEvent {});

        Ok(())
    }
}
