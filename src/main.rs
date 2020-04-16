mod commands;
mod config;
#[cfg(test)]
mod test_doubles;

use std::sync::Arc;

use serenity::{
    model::{event::ResumedEvent, gateway::Ready},
    prelude::*,
};

cfg_if::cfg_if! {
    if #[cfg(test)] {
        use test_doubles::serenity::client::bridge::gateway::ShardManager;
    } else {
        use std::{collections::HashSet, env};

        use serenity::{
            client::bridge::gateway::ShardManager,
            framework::{standard::macros::group, StandardFramework}
        };

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
    fn ready(&self, _: Context, ready: Ready) {
        println!("{} is connected!", ready.user.name);
    }

    fn resume(&self, _: Context, _: ResumedEvent) {
        println!("Resumed");
    }
}

#[cfg(not(test))]
fn main() {
    let env_var_token = env::var("DISCORD_TOKEN");
    let config = config::Config::new();
    let token = env_var_token
        .as_ref()
        .map(|x| x.as_str())
        .unwrap_or_else(|_| {
            config
                .get_creds()
                .bot_token
                .as_ref()
                .expect("Bot token expected")
                .as_str()
        });

    let prefix = config.get_prefix().to_string();

    let mut client = Client::new(token, Handler).expect("Err creating client");

    {
        let mut data = client.data.write();
        data.insert::<ShardManagerContainer>(Arc::clone(&client.shard_manager));
        data.insert::<config::Config>(config);
    }

    let owners = match client.cache_and_http.http.get_current_application_info() {
        Ok(info) => {
            let mut set = HashSet::new();
            set.insert(info.owner.id);

            set
        }
        Err(why) => panic!("Couldn't get application info: {:?}", why),
    };

    client.with_framework(
        StandardFramework::new()
            .configure(|c| c.owners(owners).prefix(prefix.as_str()))
            .group(&GENERAL_GROUP)
            .help(&HELP),
    );

    if let Err(why) = client.start() {
        println!("Client error: {:?}", why);
    }
}
