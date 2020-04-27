mod commands;
mod config;
mod localization;
#[cfg(test)]
mod test_doubles;
mod util;

use std::sync::Arc;

use serenity::prelude::{Mutex, TypeMapKey};

#[macro_use]
extern crate log;

cfg_if::cfg_if! {
    if #[cfg(test)] {
        use test_doubles::serenity::{
            client::{bridge::gateway::ShardManager, Context, EventHandler},
            model::{gateway::Ready, event::ResumedEvent},
        };
    } else {
        use std::{collections::HashSet, env};

        use env_logger::{Env, Builder, Target};
        use serenity::{
            client::{bridge::gateway::ShardManager, Client, Context, EventHandler},
            framework::{standard::macros::group, StandardFramework},
            model::{gateway::Ready, event::ResumedEvent},
        };
        use thiserror::Error;

        use commands::meta::commands::*;

        #[group]
        #[commands(ping, info)]
        struct General;
    }
}
struct ShardManagerContainer;

impl TypeMapKey for ShardManagerContainer {
    type Value = Arc<Mutex<ShardManager>>;
}

struct Handler;

impl EventHandler for Handler {
    fn ready(&self, _ctx: Context, ready: Ready) {
        info!("{} is connected!", ready.user.name)
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
        data.insert::<config::Config>(config);
        data.insert::<localization::L10NBundle>(Mutex::new(bundle));
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
    use test_doubles::serenity::model::user::CurrentUser;

    #[test]
    fn ready_event() -> Result<(), L10NError> {
        let ctx = Context::_new(None);
        {
            let mut data = ctx.data.write();
            data.insert::<L10NBundle>(serenity::prelude::Mutex::new(L10NBundle::new("en-US")?));
        }
        Handler.ready(
            ctx,
            Ready {
                user: CurrentUser {
                    id: 0,
                    name: "TestBot".to_string(),
                },
            },
        );

        Ok(())
    }

    #[test]
    fn resume_event() -> Result<(), L10NError> {
        let ctx = Context::_new(None);
        {
            let mut data = ctx.data.write();
            data.insert::<L10NBundle>(serenity::prelude::Mutex::new(L10NBundle::new("en-US")?));
        }
        Handler.resume(ctx, ResumedEvent {});

        Ok(())
    }
}
