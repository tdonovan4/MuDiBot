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
    model::gateway::Activity,
};

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

fn set_activity(ctx: &mut Context, msg: &Message) -> CommandResult {
    let mut args = Args::new(msg.content.as_str(), &[Delimiter::Single(' ')]);
    // Skip cmd
    args.advance();
    let activity = args.remains();

    // Update config
    let data = ctx.data.read();
    let mut config = data
        .get::<Config>()
        .ok_or(ConfigError::MissingFromShareMap)?
        .write();
    config.change_activity(activity.map(|s| s.to_string()))?;

    // Set new activity and generate the message
    let success_msg = match activity {
        Some(activity_text) => {
            ctx.set_activity(Activity::playing(activity_text));
            ctx.localize_msg("set-activity-some", None)?
        }
        None => {
            ctx.reset_presence();
            ctx.localize_msg("set-activity-none", None)?
        }
    };

    msg.channel_id.say(&ctx.http, success_msg.as_ref())?;

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
    #[owners_only]
    #[description(
        "Set a new activity (playing ...) for the bot. \
        Running this command without an argument will remove any activity."
    )]
    #[usage("[activity]")]
    fn setactivity(ctx: &mut Context, msg: &Message) -> CommandResult {
        super::set_activity(ctx, msg)
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

    use crate::test_doubles::directories::ProjectDirs;
    use crate::test_doubles::serenity::{
        builder::CreateMessage,
        client::bridge::gateway::{ShardManager, ShardRunnerInfo},
        client::MockContext,
        model::id::{MessageData, MessageId},
    };
    use crate::test_doubles::std::{
        fs::File,
        path::{Path, PathBuf},
    };
    use crate::test_doubles::sysinfo::MockProcess;
    use crate::test_doubles::CONTEXT_SYNCHRONIZER;

    use serenity::{
        builder::CreateEmbed,
        prelude::{Mutex, RwLock},
    };
    use std::{
        collections::HashMap,
        sync::{mpsc::channel, Arc},
    };

    #[test]
    fn send_ping_without_heartbeat() -> CommandResult {
        // Mock context
        let (sender, receiver) = channel();
        let mut ctx = Context::_new(Some(sender), None);
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
        let msg = Message::_new(msg_id, "$ping".to_string());

        // Guards for mock contexts
        let _guards = CONTEXT_SYNCHRONIZER.get_ctx_guards(vec!["utc_now"]);

        // Mock Utc::now()
        let utc_now_ctx = Utc::now_context();
        utc_now_ctx
            .expect()
            .return_const(DateTime::parse_from_rfc3339("2000-01-01T00:00:00-05:00")?);

        ping(&mut ctx, &msg)?;

        assert_eq!(
            receiver.recv()?,
            MessageData::StrMsg("Pong! *Ping received after \u{2068}100\u{2069} ms.*".to_string())
        );

        Ok(())
    }

    #[test]
    fn send_ping_with_heartbeat() -> CommandResult {
        // Mock context
        let (sender, receiver) = channel();
        let mut ctx = Context::_new(Some(sender), None);
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
        let msg = Message::_new(msg_id, "$ping".to_string());

        // Guards for mock contexts
        let _guards = CONTEXT_SYNCHRONIZER.get_ctx_guards(vec!["utc_now"]);

        // Mock Utc::now()
        let utc_now_ctx = Utc::now_context();
        utc_now_ctx
            .expect()
            .return_const(DateTime::parse_from_rfc3339("2000-01-01T00:00:01-05:00")?);

        ping(&mut ctx, &msg)?;

        assert_eq!(
            receiver.recv()?,
            MessageData::StrMsg(
                "Pong! *Ping received after \u{2068}1100\u{2069} ms.* *Current shard heartbeat ping of \u{2068}64\u{2069} ms.*"
                    .to_string()
            )
        );

        Ok(())
    }

    #[test]
    fn send_info() -> CommandResult {
        // Mock context
        let (sender, receiver) = channel();
        let mut ctx = Context::_new(Some(sender), None);
        {
            let mut data = ctx.data.write();
            let map = HashMap::new();
            data.insert::<ShardManagerContainer>(Arc::new(Mutex::new(ShardManager::_new(map))));
            data.insert::<Config>(RwLock::new(Config::default()));
            data.insert::<L10NBundle>(RwLock::new(L10NBundle::new("en-US")?));
        }

        // Mock message
        let msg = Message::_new(MessageId::new(), "$info".to_string());

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
            **Uptime:** \u{2068}\u{2068}1\u{2069}d:\u{2068}3\u{2069}h:\u{2068}45\u{2069}m:\u{2068}0\u{2069}s\u{2069}\u{2069}",
                env::var("CARGO_PKG_VERSION")?,
            ),
            false,
        );
        embed.field("**Config**", "**Language:** \u{2068}en-US\u{2069}", false);
        embed.footer(|f| f.text("Client ID: \u{2068}0\u{2069}"));

        info(&mut ctx, &msg)?;

        assert_eq!(
            receiver.recv()?,
            MessageData::CreateMessage(CreateMessage {
                _embed: Some(embed),
            })
        );

        Ok(())
    }

    #[test]
    fn set_activity_to_none() -> CommandResult {
        // Mock context
        let (sender, receiver) = channel();
        let mut inner_ctx = MockContext::new();
        inner_ctx.expect_reset_presence().once().return_const(());
        let mut ctx = Context::_new(Some(sender), Some(inner_ctx));
        {
            let mut data = ctx.data.write();
            data.insert::<Config>(RwLock::new(Config::default()));
            data.insert::<L10NBundle>(RwLock::new(L10NBundle::new("en-US")?));
        }

        // Mock message
        let msg = Message::_new(MessageId::new(), "$setactivity".to_string());

        // Mock config dir
        let mut config_dir = Path::default();
        config_dir.expect_join().once().returning(|_| {
            // Mock config path
            // As Path
            let mut config_path = Path::default();
            config_path
                .expect_parent()
                .once()
                .returning(|| Some(Path::default()));

            // As PathBuf
            let mut config_path_buf = PathBuf::new();
            config_path_buf
                .expect_deref()
                .once()
                .return_const(config_path);
            config_path_buf
        });

        // Guards for mock contexts
        let _guards = CONTEXT_SYNCHRONIZER.get_ctx_guards(vec!["project_dirs_from", "file_create"]);

        // Mock project dir
        let project_dirs_ctx = ProjectDirs::from_context();
        project_dirs_ctx.expect().once().return_once(|_, _, _| {
            let mut project_dir = ProjectDirs::new();
            project_dir
                .expect_config_dir()
                .once()
                .return_const(config_dir);
            Some(project_dir)
        });

        // Mock config file
        let file_ctx = File::create_context();
        file_ctx.expect().once().return_once(|_| {
            let mut config_file = File::new();
            config_file
                .expect_write()
                .once()
                .return_once(|x| Ok(x.len()));
            Ok(config_file)
        });

        set_activity(&mut ctx, &msg)?;

        assert_eq!(
            ctx.data
                .read()
                .get::<Config>()
                .unwrap()
                .read()
                .get_activity(),
            None
        );

        assert_eq!(
            receiver.recv()?,
            MessageData::StrMsg("Activity successfully removed!".to_string())
        );

        Ok(())
    }

    #[test]
    fn set_activity_to_some() -> CommandResult {
        // Mock context
        let (sender, receiver) = channel();
        let mut inner_ctx = MockContext::new();
        inner_ctx.expect_set_activity().once().return_const(());
        let mut ctx = Context::_new(Some(sender), Some(inner_ctx));
        {
            let mut data = ctx.data.write();
            data.insert::<Config>(RwLock::new(Config::default()));
            data.insert::<L10NBundle>(RwLock::new(L10NBundle::new("en-US")?));
        }

        // Mock message
        let msg = Message::_new(
            MessageId::new(),
            "$setactivity Hello, this is a test!".to_string(),
        );

        // Mock config dir
        let mut config_dir = Path::default();
        config_dir.expect_join().once().returning(|_| {
            // Mock config path
            // As Path
            let mut config_path = Path::default();
            config_path
                .expect_parent()
                .once()
                .returning(|| Some(Path::default()));

            // As PathBuf
            let mut config_path_buf = PathBuf::new();
            config_path_buf
                .expect_deref()
                .once()
                .return_const(config_path);
            config_path_buf
        });

        // Guards for mock contexts
        let _guards = CONTEXT_SYNCHRONIZER.get_ctx_guards(vec!["project_dirs_from", "file_create"]);

        // Mock project dir
        let project_dirs_ctx = ProjectDirs::from_context();
        project_dirs_ctx.expect().once().return_once(|_, _, _| {
            let mut project_dir = ProjectDirs::new();
            project_dir
                .expect_config_dir()
                .once()
                .return_const(config_dir);
            Some(project_dir)
        });

        // Mock config file
        let file_ctx = File::create_context();
        file_ctx.expect().once().return_once(|_| {
            let mut config_file = File::new();
            config_file
                .expect_write()
                .once()
                .return_once(|x| Ok(x.len()));
            Ok(config_file)
        });

        set_activity(&mut ctx, &msg)?;

        assert_eq!(
            ctx.data
                .read()
                .get::<Config>()
                .unwrap()
                .read()
                .get_activity(),
            Some("Hello, this is a test!")
        );

        assert_eq!(
            receiver.recv()?,
            MessageData::StrMsg("Activity successfully modified!".to_string())
        );

        Ok(())
    }
}
