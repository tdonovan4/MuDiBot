use crate::config::{Config, ConfigError};
use crate::containers::ShardManagerContainer;
use crate::localization::Localize;

use serenity::{
    framework::standard::{Args, CommandResult, Delimiter},
    model::gateway::Activity,
};

cfg_if::cfg_if! {
    if #[cfg(test)] {
        use crate::test_doubles::serenity::{model::channel::Message, client::Context};
    } else {
        use serenity::{model::channel::Message, client::Context};
    }
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

fn kill(ctx: &mut Context, msg: &Message) -> CommandResult {
    msg.channel_id
        .say(&ctx.http, ctx.localize_msg("shutting-down", None)?)?;

    let data = ctx.data.read();
    // If we can't get ShardManager, we panic to exit
    let mut manager = data
        .get::<ShardManagerContainer>()
        .expect("Could not tell ShardManager to exit gracefully")
        .lock();

    manager.shutdown_all();

    Ok(())
}

fn restart_shards(ctx: &mut Context, msg: &Message) -> CommandResult {
    msg.channel_id
        .say(&ctx.http, ctx.localize_msg("restarting-shards", None)?)?;

    let data = ctx.data.read();

    let mut manager = data
        .get::<ShardManagerContainer>()
        .ok_or(crate::containers::ShardManagerError::MissingFromShareMap)?
        .lock();

    for shard_id in manager.shards_instantiated() {
        manager.restart(shard_id);
    }

    Ok(())
}

#[cfg(not(test))]
pub mod commands {
    use serenity::{
        framework::standard::{macros::command, CommandResult},
        model::prelude::*,
        prelude::*,
    };

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

    #[command]
    #[owners_only]
    #[description("Shutdown the bot")]
    fn kill(ctx: &mut Context, msg: &Message) -> CommandResult {
        super::kill(ctx, msg)
    }

    #[command]
    #[owners_only]
    #[description("Restart the shards. This will not restart the main process.")]
    fn restart(ctx: &mut Context, msg: &Message) -> CommandResult {
        super::restart_shards(ctx, msg)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    use crate::localization::L10NBundle;

    use crate::test_doubles::directories::ProjectDirs;
    use crate::test_doubles::serenity::{
        client::{
            bridge::gateway::{MockShardManager, ShardManager},
            MockContext,
        },
        http::client::Http,
    };
    use crate::test_doubles::std::{
        fs::File,
        path::{Path, PathBuf},
    };
    use crate::test_doubles::CONTEXT_SYNCHRONIZER;
    use crate::test_utils;

    use std::{collections::HashMap, sync::Arc};

    use serenity::{
        client::bridge::gateway::ShardId,
        prelude::{Mutex, RwLock},
    };

    fn test_activity(
        msg: &str,
        response_msg: &str,
        inner_ctx: MockContext,
        activity: Option<&str>,
    ) -> CommandResult {
        // Main mock
        let mut http = Http::new();
        test_utils::check_response_msg(&mut http, response_msg);

        // Mock context
        let mut ctx = Context::_new(Some(inner_ctx), http);
        {
            let mut data = ctx.data.write();
            data.insert::<Config>(RwLock::new(Config::default()));
            data.insert::<L10NBundle>(RwLock::new(L10NBundle::new("en-US")?));
        }

        // Mock message
        let msg = Message::_from_str(msg);

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
            activity
        );

        Ok(())
    }

    #[test]
    fn set_activity_to_none() -> CommandResult {
        // Mock context
        let mut inner_ctx = MockContext::new();
        inner_ctx.expect_reset_presence().once().return_const(());

        test_activity(
            "$setactivity",
            "Activity successfully removed!",
            inner_ctx,
            None,
        )
    }

    #[test]
    fn set_activity_to_some() -> CommandResult {
        // Mock context
        let mut inner_ctx = MockContext::new();
        inner_ctx.expect_set_activity().once().return_const(());

        test_activity(
            "$setactivity Hello, this is a test!",
            "Activity successfully modified!",
            inner_ctx,
            Some("Hello, this is a test!"),
        )
    }

    #[test]
    fn should_shutdown_shards() -> CommandResult {
        // Main mock
        let mut http = Http::new();
        test_utils::check_response_msg(&mut http, "Shutting down...");
        // Mock context
        let mut ctx = Context::_new(None, http);
        {
            let mut data = ctx.data.write();
            data.insert::<L10NBundle>(RwLock::new(L10NBundle::new("en-US")?));

            let mut manager = MockShardManager::new();
            manager.expect_shutdown_all().once().return_const(());
            data.insert::<ShardManagerContainer>(Arc::new(Mutex::new(ShardManager::_new(
                HashMap::new(),
                Some(manager),
            ))));
        }

        let msg = Message::_from_str("$kill");

        kill(&mut ctx, &msg)
    }

    #[test]
    fn should_restart_shards() -> CommandResult {
        // Main mock
        let mut http = Http::new();
        test_utils::check_response_msg(&mut http, "Restarting shards...");
        // Mock context
        let mut ctx = Context::_new(None, http);
        {
            let mut data = ctx.data.write();
            data.insert::<L10NBundle>(RwLock::new(L10NBundle::new("en-US")?));

            let mut manager = MockShardManager::new();
            manager
                .expect_shards_instantiated()
                .once()
                .return_const(vec![ShardId(0), ShardId(1), ShardId(3), ShardId(4)]);
            manager.expect_restart().times(4).return_const(());
            data.insert::<ShardManagerContainer>(Arc::new(Mutex::new(ShardManager::_new(
                HashMap::new(),
                Some(manager),
            ))));
        }

        let msg = Message::_from_str("$restart");

        restart_shards(&mut ctx, &msg)
    }
}
