use crate::localization::{L10NBundle, Localize};
use crate::ShardManagerContainer;

use std::{
    env,
    time::{Duration, UNIX_EPOCH},
};

use chrono::DateTime;
use fluent::fluent_args;
use serenity::{client::bridge::gateway::ShardId, framework::standard::CommandResult};

cfg_if::cfg_if! {
    if #[cfg(test)] {
        use crate::test_doubles::serenity::{model::channel::Message, client::Context};
        use crate::test_doubles::chrono::offset::Utc;
        use crate::test_doubles::sysinfo::{ProcessExt, System, SystemExt};
        use crate::test_doubles::std::time::SystemTime;
    } else {
        use serenity::{model::channel::Message, client::Context};
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

fn duration_to_str(duration: chrono::Duration) -> String {
    let days = duration.num_days();
    let hours = duration.num_hours() - duration.num_days() * 24;
    let minutes = duration.num_minutes() - duration.num_hours() * 60;
    let seconds = duration.num_seconds() - duration.num_minutes() * 60;

    format!("{}d:{}h:{}m:{}s", days, hours, minutes, seconds)
}

fn ping(ctx: &mut Context, msg: &Message) -> CommandResult {
    let ping = DateTime::from(Utc::now()) - msg.id.created_at();
    let msg_str = if let Some(heartbeat) = get_heartbeat_latency(ctx) {
        let args = fluent_args![
            "ping" => ping.num_milliseconds(),
            "heartbeat" => heartbeat.as_millis()
        ];
        ctx.localize_msg("ping-msg-heartbeat", Some(&args))
            .unwrap()
            .into_owned()
    } else {
        let args = fluent_args!["ping" => ping.num_milliseconds()];
        ctx.localize_msg("ping-msg", Some(&args))
            .unwrap()
            .into_owned()
    };

    let _ = msg.channel_id.say(&ctx.http, msg_str.as_str());
    Ok(())
}

fn info(ctx: &mut Context, msg: &Message) -> CommandResult {
    let version = env::var("CARGO_PKG_VERSION")?;

    let mut sys = System::new();
    sys.refresh_all();
    // TODO: Remove unwrap()
    let process = sys
        .get_process(sysinfo::get_current_pid().unwrap())
        .unwrap();
    let now = SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs();
    let uptime = chrono::Duration::seconds((now - process.start_time()) as i64);

    let bot = &(*ctx.cache).read().user;

    let data = ctx.data.read();
    let l10n = data.get::<L10NBundle>().unwrap().lock();
    let bundle = (*l10n).get_bundle();

    let embed_text = bundle.get_message("info-embed").unwrap();
    let args_general = fluent_args![
        "version" => version,
        "uptime" => duration_to_str(uptime)
    ];
    let args_footer = fluent_args![
        "id" => bot.id.to_string()
    ];
    let mut errors = vec![];

    let _ = msg.channel_id.send_message(&ctx.http, |m| {
        m.embed(|e| {
            e.title(bundle.format_pattern(embed_text.value.unwrap(), None, &mut errors));
            e.colour(0x0000_80c0);
            e.field(
                bundle.format_pattern(
                    embed_text.attributes.get("general-title").unwrap(),
                    None,
                    &mut errors,
                ),
                bundle.format_pattern(
                    embed_text.attributes.get("general-body").unwrap(),
                    Some(&args_general),
                    &mut errors,
                ),
                false,
            );
            e.field(
                bundle.format_pattern(
                    embed_text.attributes.get("config-title").unwrap(),
                    None,
                    &mut errors,
                ),
                bundle.format_pattern(
                    embed_text.attributes.get("config-body").unwrap(),
                    None,
                    &mut errors,
                ),
                false,
            );
            e.footer(|f| {
                f.text(bundle.format_pattern(
                    embed_text.attributes.get("footer").unwrap(),
                    Some(&args_footer),
                    &mut errors,
                ))
            });
            e
        })
    });
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
    fn ping(ctx: &mut Context, msg: &Message) -> CommandResult {
        super::ping(ctx, msg)
    }

    #[command]
    fn info(ctx: &mut Context, msg: &Message) -> CommandResult {
        super::info(ctx, msg)
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
        model::id::{MessageData, MessageId},
    };
    use crate::test_doubles::sysinfo::MockProcess;
    use crate::test_doubles::CONTEXT_SYNCHRONIZER;

    use serenity::builder::CreateEmbed;
    use std::{
        collections::HashMap,
        sync::{mpsc::channel, Arc},
    };

    #[test]
    fn send_ping_without_heartbeat() {
        // Mock context
        let (sender, receiver) = channel();
        let mut ctx = Context::_new(sender);
        {
            let mut data = ctx.data.write();
            let map = HashMap::new();
            data.insert::<ShardManagerContainer>(Arc::new(serenity::prelude::Mutex::new(
                ShardManager::_new(map),
            )));
            data.insert::<L10NBundle>(serenity::prelude::Mutex::new(L10NBundle::new("en-US")));
        }

        // Mock message
        let mut msg_id = MessageId::new();
        msg_id
            .expect_created_at()
            .times(1)
            .return_const(DateTime::parse_from_rfc3339("1999-12-31T23:59:59.9-05:00").unwrap());
        let msg = Message::_new(msg_id);

        // Guards for mock contexts
        let _guards = CONTEXT_SYNCHRONIZER.get_ctx_guards(vec!["utc_now"]);

        // Mock Utc::now()
        let utc_now_ctx = Utc::now_context();
        utc_now_ctx
            .expect()
            .return_const(DateTime::parse_from_rfc3339("2000-01-01T00:00:00-05:00").unwrap());

        ping(&mut ctx, &msg).unwrap();

        assert_eq!(
            receiver.recv().unwrap(),
            MessageData::StrMsg("Pong! *Ping received after \u{2068}100\u{2069} ms.*".to_string())
        );
    }

    #[test]
    fn send_ping_with_heartbeat() {
        // Mock context
        let (sender, receiver) = channel();
        let mut ctx = Context::_new(sender);
        {
            let mut data = ctx.data.write();
            let mut map = HashMap::new();
            map.insert(
                ShardId(0),
                ShardRunnerInfo {
                    latency: Some(Duration::from_millis(64)),
                },
            );
            data.insert::<ShardManagerContainer>(Arc::new(serenity::prelude::Mutex::new(
                ShardManager::_new(map),
            )));
            data.insert::<L10NBundle>(serenity::prelude::Mutex::new(L10NBundle::new("en-US")));
        }

        // Mock message
        let mut msg_id = MessageId::new();
        msg_id
            .expect_created_at()
            .once()
            .return_const(DateTime::parse_from_rfc3339("1999-12-31T23:59:59.9-05:00").unwrap());
        let msg = Message::_new(msg_id);

        // Guards for mock contexts
        let _guards = CONTEXT_SYNCHRONIZER.get_ctx_guards(vec!["utc_now"]);

        // Mock Utc::now()
        let utc_now_ctx = Utc::now_context();
        utc_now_ctx
            .expect()
            .return_const(DateTime::parse_from_rfc3339("2000-01-01T00:00:01-05:00").unwrap());

        ping(&mut ctx, &msg).unwrap();

        assert_eq!(
            receiver.recv().unwrap(),
            MessageData::StrMsg(
                "Pong! *Ping received after \u{2068}1100\u{2069} ms.* *Current shard heartbeat ping of \u{2068}64\u{2069} ms.*"
                    .to_string()
            )
        );
    }

    #[test]
    fn send_info() {
        // Mock context
        let (sender, receiver) = channel();
        let mut ctx = Context::_new(sender);
        {
            let mut data = ctx.data.write();
            let map = HashMap::new();
            data.insert::<ShardManagerContainer>(Arc::new(serenity::prelude::Mutex::new(
                ShardManager::_new(map),
            )));
            data.insert::<L10NBundle>(serenity::prelude::Mutex::new(L10NBundle::new("en-US")));
        }

        // Mock message
        let msg = Message::_new(MessageId::new());

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
            **Uptime:** \u{2068}1d:3h:45m:0s\u{2069}",
                env::var("CARGO_PKG_VERSION").unwrap(),
            ),
            false,
        );
        embed.field("**Config**", "**Language:** TODO", false);
        embed.footer(|f| f.text("Client ID: \u{2068}0\u{2069}"));

        info(&mut ctx, &msg).unwrap();

        assert_eq!(
            receiver.recv().unwrap(),
            MessageData::CreateMessage(CreateMessage {
                _embed: Some(embed),
            })
        );
    }
}
