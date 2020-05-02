use crate::config::{Config, ConfigError};
use crate::localization::{L10NBundle, L10NError, Localize};
use crate::ShardManagerContainer;

use std::{
    env,
    time::{Duration, UNIX_EPOCH},
};

use chrono::DateTime;
use fluent::fluent_args;
use serenity::{
    client::bridge::gateway::ShardId,
    framework::standard::{Args, CommandResult, Delimiter},
};

cfg_if::cfg_if! {
    if #[cfg(test)] {
        use crate::test_doubles::serenity::{
            client::Context,
            model::{channel::{Channel, Message}, id::ChannelId},
        };
        use crate::test_doubles::chrono::offset::Utc;
        use crate::test_doubles::sysinfo::{ProcessExt, System, SystemExt};
        use crate::test_doubles::std::time::SystemTime;
    } else {
        use serenity::{
            client::Context,
            model::{channel::{Channel, Message}, id::ChannelId},
        };
        use chrono::offset::Utc;
        use sysinfo::{ProcessExt, System, SystemExt};
        use std::time::SystemTime;
    }
}

fn get_heartbeat_latency(ctx: &Context) -> Option<Duration> {
    ctx.data
        .read()
        .get::<ShardManagerContainer>()?
        .lock()
        .runners
        .lock()
        .get(&ShardId(ctx.shard_id))?
        .latency
}

fn duration_to_str(bundle: &L10NBundle, duration: chrono::Duration) -> Result<String, L10NError> {
    let args = fluent_args![
        "days" => duration.num_days(),
        "hours" => duration.num_hours() - duration.num_days() * 24,
        "mins" => duration.num_minutes() - duration.num_hours() * 60,
        "secs" => duration.num_seconds() - duration.num_minutes() * 60
    ];

    bundle
        .localize_msg("info-uptime", Some(&args))
        .map(|cow| cow.into_owned())
}

fn ping(ctx: &mut Context, msg: &Message) -> CommandResult {
    let ping = DateTime::from(Utc::now()) - msg.id.created_at();
    let msg_str = if let Some(heartbeat) = get_heartbeat_latency(ctx) {
        let args = fluent_args![
            "ping" => ping.num_milliseconds(),
            "heartbeat" => heartbeat.as_millis()
        ];
        ctx.localize_msg("ping-msg-heartbeat", Some(&args))?
            .into_owned()
    } else {
        let args = fluent_args!["ping" => ping.num_milliseconds()];
        ctx.localize_msg("ping-msg", Some(&args))?.into_owned()
    };

    msg.channel_id.say(&ctx.http, msg_str.as_str())?;
    Ok(())
}

#[derive(thiserror::Error, Debug)]
#[error("{msg}")]
struct ProcessError {
    msg: String,
}

fn info(ctx: &mut Context, msg: &Message) -> CommandResult {
    let version = env::var("CARGO_PKG_VERSION")?;

    let mut sys = System::new();
    sys.refresh_all();
    let process = sys
        .get_process(sysinfo::get_current_pid()?)
        .ok_or(ProcessError {
            msg: "Alright, so somehow we cannot get info about this current process. \
                I mean this really should not happen."
                .to_string(),
        })?;
    let now = SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs();
    let uptime = chrono::Duration::seconds((now - process.start_time()) as i64);

    let bot = &(*ctx.cache).read().user;

    let data = ctx.data.read();
    let config = data
        .get::<Config>()
        .ok_or(ConfigError::MissingFromShareMap)?
        .read();

    let l10n = data
        .get::<L10NBundle>()
        .ok_or(L10NError::MissingFromShareMap)?
        .read();

    let embed_msg = l10n.get_message("info-embed")?;

    let embed_title = l10n.get_msg_value(&embed_msg, None)?;

    let general_title = l10n.get_msg_attribute(&embed_msg, "general-title", None)?;
    let args_general = fluent_args![
        "version" => version,
        "uptime" => duration_to_str(&*l10n, uptime)?
    ];
    let general_body = l10n.get_msg_attribute(&embed_msg, "general-body", Some(&args_general))?;

    let config_title = l10n.get_msg_attribute(&embed_msg, "config-title", None)?;
    let args_config = fluent_args![
        "langid" => config.get_locale()
    ];
    let config_body = l10n.get_msg_attribute(&embed_msg, "config-body", Some(&args_config))?;

    let args_footer = fluent_args![
        "id" => bot.id.to_string()
    ];
    let footer = l10n.get_msg_attribute(&embed_msg, "footer", Some(&args_footer))?;

    msg.channel_id.send_message(&ctx.http, |m| {
        m.embed(|e| {
            e.title(embed_title);
            e.colour(0x0000_80c0);
            e.field(general_title, general_body, false);
            e.field(config_title, config_body, false);
            e.footer(|f| f.text(footer));
            e
        })
    })?;

    Ok(())
}

fn say(ctx: &mut Context, msg: &Message) -> CommandResult {
    let mut args = Args::new(msg.content.as_str(), &[Delimiter::Single(' ')]);
    // Skip cmd (we know we have at least one argument)
    args.advance();
    // Try to parse the channel id
    let channel_id = match args.parse::<ChannelId>() {
        Ok(id) => {
            // First, check if the chosen channel is in a guild
            if let Channel::Guild(guild_channel) = id.to_channel(&ctx.http)? {
                // Then check if it is not in the same guild
                if msg.guild_id != Some(guild_channel.read().guild_id) {
                    // Lastly, we need to check if the user has permission to use
                    // this command in this guild.

                    //TODO: implement when permission groups are done
                    msg.channel_id
                        .say(&ctx.http, ctx.localize_msg("external-guild-channel", None)?)?;

                    return Ok(());
                }

                // We don't want to include the id in the message
                args.advance();
                id
            } else {
                msg.channel_id
                    .say(&ctx.http, ctx.localize_msg("not-guild-channel", None)?)?;

                return Ok(());
            }
        }
        Err(_) => msg.channel_id,
    };
    // Try to get the message and send it
    match args.remains() {
        Some(message_to_send) => channel_id.say(&ctx.http, message_to_send),
        None => msg
            .channel_id
            .say(&ctx.http, ctx.localize_msg("missing-message", None)?),
    }?;

    Ok(())
}

#[cfg(not(test))]
pub mod commands {
    use std::collections::HashSet;

    use serenity::{
        framework::standard::{
            help_commands,
            macros::{command, help},
            Args, CommandGroup, CommandResult, HelpOptions,
        },
        model::prelude::*,
        prelude::*,
    };

    #[command]
    #[description("Replies `Pong!` with some information about the latency")]
    fn ping(ctx: &mut Context, msg: &Message) -> CommandResult {
        super::ping(ctx, msg)
    }

    #[command]
    #[description("Get information on the bot and it's current state")]
    fn info(ctx: &mut Context, msg: &Message) -> CommandResult {
        super::info(ctx, msg)
    }

    #[command]
    // TODO: remove when permission groups are done
    #[required_permissions("ADMINISTRATOR")]
    #[min_args(1)]
    #[description(
        "Makes the bot say a message in a channel. \
        If no channel is specified, it sends the message to the current channel."
    )]
    #[usage("[channel] <msg>")]
    fn say(ctx: &mut Context, msg: &Message) -> CommandResult {
        super::say(ctx, msg)
    }

    #[help]
    #[individual_command_tip = "Type the name of a command to get more info about it"]
    #[max_levenshtein_distance(3)]
    #[lacking_permissions = "Hide"]
    #[lacking_role = "Nothing"]
    #[wrong_channel = "Strike"]
    pub fn help(
        context: &mut Context,
        msg: &Message,
        args: Args,
        help_options: &'static HelpOptions,
        groups: &[&'static CommandGroup],
        owners: HashSet<UserId>,
    ) -> CommandResult {
        help_commands::with_embeds(context, msg, args, help_options, groups, owners)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    use crate::test_doubles::serenity::{
        builder::CreateMessage,
        client::bridge::gateway::{ShardManager, ShardRunnerInfo},
        http::client::Http,
        model::{
            channel::{GuildChannel, PrivateChannel},
            id::{ChannelId, MessageData, MessageId, MockChannelId},
        },
    };
    use crate::test_doubles::sysinfo::MockProcess;
    use crate::test_doubles::CONTEXT_SYNCHRONIZER;

    use std::{collections::HashMap, sync::Arc};

    use mockall::predicate::{always, eq};
    use serenity::{
        builder::CreateEmbed,
        model::misc::ChannelIdParseError,
        prelude::{Mutex, RwLock},
    };

    #[test]
    fn send_ping_without_heartbeat() -> CommandResult {
        // Main mock
        let mut http = Http::new();
        http.expect_mock_send()
            .with(
                always(),
                eq(MessageData::StrMsg(
                    "Pong! *Ping received after \u{2068}100\u{2069} ms.*".to_string(),
                )),
            )
            .return_const(());
        http.expect_mock_get_channel()
            .returning(|| Err(serenity::Error::Other("Not important for test")));

        // Mock context
        let mut ctx = Context::_new(None, http);
        {
            let mut data = ctx.data.write();
            let map = HashMap::new();
            data.insert::<ShardManagerContainer>(Arc::new(Mutex::new(ShardManager::_new(map))));
            data.insert::<L10NBundle>(RwLock::new(L10NBundle::new("en-US")?));
        }

        // Mock message
        let mut msg_id = MessageId::new();
        msg_id
            .expect_created_at()
            .times(1)
            .return_const(DateTime::parse_from_rfc3339("1999-12-31T23:59:59.9-05:00")?);
        let msg = Message::_new(msg_id, 0, "$ping".to_string(), 0);

        // Guards for mock contexts
        let _guards = CONTEXT_SYNCHRONIZER.get_ctx_guards(vec!["utc_now"]);

        // Mock Utc::now()
        let utc_now_ctx = Utc::now_context();
        utc_now_ctx
            .expect()
            .return_const(DateTime::parse_from_rfc3339("2000-01-01T00:00:00-05:00")?);

        ping(&mut ctx, &msg)?;

        Ok(())
    }

    #[test]
    fn send_ping_with_heartbeat() -> CommandResult {
        // Main mock
        let mut http = Http::new();
        http.expect_mock_send().with(
            always(),
            eq(MessageData::StrMsg(
                "Pong! *Ping received after \u{2068}1100\u{2069} ms.* *Current shard heartbeat ping of \u{2068}64\u{2069} ms.*"
                    .to_string()
            )),
        ).return_const(());
        http.expect_mock_get_channel()
            .returning(|| Err(serenity::Error::Other("Not important for test")));

        // Mock context
        let mut ctx = Context::_new(None, http);
        {
            let mut data = ctx.data.write();
            let mut map = HashMap::new();
            map.insert(
                ShardId(0),
                ShardRunnerInfo {
                    latency: Some(Duration::from_millis(64)),
                },
            );
            data.insert::<ShardManagerContainer>(Arc::new(Mutex::new(ShardManager::_new(map))));
            data.insert::<L10NBundle>(RwLock::new(L10NBundle::new("en-US")?));
        }

        // Mock message
        let mut msg_id = MessageId::new();
        msg_id
            .expect_created_at()
            .once()
            .return_const(DateTime::parse_from_rfc3339("1999-12-31T23:59:59.9-05:00")?);
        let msg = Message::_new(msg_id, 0, "$ping".to_string(), 0);

        // Guards for mock contexts
        let _guards = CONTEXT_SYNCHRONIZER.get_ctx_guards(vec!["utc_now"]);

        // Mock Utc::now()
        let utc_now_ctx = Utc::now_context();
        utc_now_ctx
            .expect()
            .return_const(DateTime::parse_from_rfc3339("2000-01-01T00:00:01-05:00")?);

        ping(&mut ctx, &msg)?;

        Ok(())
    }

    #[test]
    fn send_info() -> CommandResult {
        // The expected embed
        let mut embed = CreateEmbed(HashMap::new());
        embed.title("__**~Info~**__");
        embed.colour(0x0000_80c0);
        embed.field(
            "**General**",
            format!(
                "**Name:** MuDiBot\n\
            **Description:** A multipurpose Discord bot (MuDiBot) made using serenity\n\
            **Author:** Thomas Donovan (tdonovan4)\n\
            **Version:** \u{2068}{}\u{2069}\n\
            **Uptime:** \u{2068}\u{2068}1\u{2069}d:\u{2068}3\u{2069}h:\u{2068}45\u{2069}m:\u{2068}0\u{2069}s\u{2069}\u{2069}",
                env::var("CARGO_PKG_VERSION")?,
            ),
            false,
        );
        embed.field("**Config**", "**Language:** \u{2068}en-US\u{2069}", false);
        embed.footer(|f| f.text("Client ID: \u{2068}0\u{2069}"));

        // Main mock
        let mut http = Http::new();
        http.expect_mock_send()
            .with(
                always(),
                eq(MessageData::CreateMessage(CreateMessage {
                    _embed: Some(embed),
                })),
            )
            .return_const(());
        http.expect_mock_get_channel()
            .returning(|| Err(serenity::Error::Other("Not important for test")));

        // Mock context
        let mut ctx = Context::_new(None, http);
        {
            let mut data = ctx.data.write();
            let map = HashMap::new();
            data.insert::<ShardManagerContainer>(Arc::new(Mutex::new(ShardManager::_new(map))));
            data.insert::<Config>(RwLock::new(Config::default()));
            data.insert::<L10NBundle>(RwLock::new(L10NBundle::new("en-US")?));
        }

        // Mock message
        let msg = Message::_new(MessageId::new(), 0, "$info".to_string(), 0);

        // Mock current process
        let mut current_proc = MockProcess::new();
        current_proc
            .expect_start_time()
            .once()
            .return_const(100 as u64);

        // Guards for mock contexts
        let _guards = CONTEXT_SYNCHRONIZER.get_ctx_guards(vec!["system_new", "system_time_now"]);

        // Mock System
        let mut mock_sys = System::default();
        mock_sys.expect_refresh_all().once().return_const(());
        mock_sys
            .expect_get_process()
            .once()
            .return_once(|_| Some(current_proc));
        let system_ctx = System::new_context();
        system_ctx.expect().return_once(|| mock_sys);

        // Mock SystemTime
        let mut mock_sys_time = SystemTime::new();
        mock_sys_time
            .expect_duration_since()
            .once()
            .return_const(Ok(Duration::from_secs(100_000)));
        let sys_time_ctx = SystemTime::now_context();
        sys_time_ctx.expect().return_once(|| mock_sys_time);

        info(&mut ctx, &msg)?;

        Ok(())
    }

    /*
     * No need to test say for an empty channel and message, the command framework is
     * protecting us against this situation (min argument is 1)
     */

    #[test]
    fn say_something_current() -> CommandResult {
        // Main mock
        let mut http = Http::new();
        http.expect_mock_send()
            .with(eq(0), eq(MessageData::StrMsg("This is a test".to_string())))
            .return_const(());
        http.expect_mock_get_channel()
            .returning(|| Err(serenity::Error::Other("Not important for test")));

        // Mock context
        let mut ctx = Context::_new(None, http);
        {
            let mut data = ctx.data.write();
            data.insert::<L10NBundle>(RwLock::new(L10NBundle::new("en-US")?));
        }

        // Mock message
        let msg = Message::_new(MessageId::new(), 0, "$say This is a test".to_string(), 0);

        // Guards for mock contexts
        let _guards = CONTEXT_SYNCHRONIZER.get_ctx_guards(vec!["channel_id_from_str"]);

        let mock_channel_ctx = MockChannelId::from_str_context();
        mock_channel_ctx
            .expect()
            .return_once(|_| Err(ChannelIdParseError::InvalidFormat));

        say(&mut ctx, &msg)?;

        Ok(())
    }

    #[test]
    fn say_nothing_channel() -> CommandResult {
        // Main mock
        let mut http = Http::new();
        http.expect_mock_get_channel().returning(|| {
            Ok(Channel::Guild(Arc::new(RwLock::new(GuildChannel {
                guild_id: 0,
            }))))
        });
        http.expect_mock_send()
            .with(
                eq(0),
                eq(MessageData::StrMsg(
                    "Missing argument: message.".to_string(),
                )),
            )
            .return_const(());

        // Mock context
        let mut ctx = Context::_new(None, http);
        {
            let mut data = ctx.data.write();
            data.insert::<L10NBundle>(RwLock::new(L10NBundle::new("en-US")?));
        }

        // Mock message
        let msg = Message::_new(MessageId::new(), 0, "$say a_good_channel".to_string(), 0);

        // Guards for mock contexts
        let _guards = CONTEXT_SYNCHRONIZER.get_ctx_guards(vec!["channel_id_from_str"]);

        let mock_channel_ctx = MockChannelId::from_str_context();
        mock_channel_ctx.expect().return_once(|_| Ok(ChannelId(1)));

        say(&mut ctx, &msg)?;

        Ok(())
    }

    #[test]
    fn say_something_channel() -> CommandResult {
        // Main mock
        let mut http = Http::new();
        http.expect_mock_get_channel().returning(|| {
            Ok(Channel::Guild(Arc::new(RwLock::new(GuildChannel {
                guild_id: 0,
            }))))
        });
        http.expect_mock_send()
            .with(eq(1), eq(MessageData::StrMsg("test".to_string())))
            .return_const(());

        // Mock context
        let mut ctx = Context::_new(None, http);
        {
            let mut data = ctx.data.write();
            data.insert::<L10NBundle>(RwLock::new(L10NBundle::new("en-US")?));
        }

        // Mock message
        let msg = Message::_new(
            MessageId::new(),
            0,
            "$say a_good_channel test".to_string(),
            0,
        );

        // Guards for mock contexts
        let _guards = CONTEXT_SYNCHRONIZER.get_ctx_guards(vec!["channel_id_from_str"]);

        let mock_channel_ctx = MockChannelId::from_str_context();
        mock_channel_ctx.expect().return_once(|_| Ok(ChannelId(1)));

        say(&mut ctx, &msg)?;

        Ok(())
    }

    #[test]
    fn say_something_not_guild_channel() -> CommandResult {
        // Main mock
        let mut http = Http::new();
        http.expect_mock_get_channel()
            .returning(|| Ok(Channel::Private(Arc::new(RwLock::new(PrivateChannel)))));
        http.expect_mock_send()
            .with(
                eq(0),
                eq(MessageData::StrMsg(
                    "This channel is a not in a server!".to_string(),
                )),
            )
            .return_const(());

        // Mock context
        let mut ctx = Context::_new(None, http);
        {
            let mut data = ctx.data.write();
            data.insert::<L10NBundle>(RwLock::new(L10NBundle::new("en-US")?));
        }

        // Mock message
        let msg = Message::_new(
            MessageId::new(),
            0,
            "$say a_good_channel test".to_string(),
            0,
        );

        // Guards for mock contexts
        let _guards = CONTEXT_SYNCHRONIZER.get_ctx_guards(vec!["channel_id_from_str"]);

        let mock_channel_ctx = MockChannelId::from_str_context();
        mock_channel_ctx.expect().return_once(|_| Ok(ChannelId(1)));

        say(&mut ctx, &msg)?;

        Ok(())
    }

    #[test]
    fn say_something_external_channel() -> CommandResult {
        // Main mock
        let mut http = Http::new();
        http.expect_mock_get_channel().returning(|| {
            Ok(Channel::Guild(Arc::new(RwLock::new(GuildChannel {
                guild_id: 1,
            }))))
        });
        http.expect_mock_send().with(
            eq(0),
            eq(MessageData::StrMsg(
                "Sending a message in an external guild channel is not yet supported. :confused:"
                    .to_string(),
            )),
        ).return_const(());

        // Mock context
        let mut ctx = Context::_new(None, http);
        {
            let mut data = ctx.data.write();
            data.insert::<L10NBundle>(RwLock::new(L10NBundle::new("en-US")?));
        }

        // Mock message
        let msg = Message::_new(
            MessageId::new(),
            0,
            "$say a_good_channel test".to_string(),
            0,
        );

        // Guards for mock contexts
        let _guards = CONTEXT_SYNCHRONIZER.get_ctx_guards(vec!["channel_id_from_str"]);

        let mock_channel_ctx = MockChannelId::from_str_context();
        mock_channel_ctx.expect().return_once(|_| Ok(ChannelId(1)));

        say(&mut ctx, &msg)?;

        Ok(())
    }
}
