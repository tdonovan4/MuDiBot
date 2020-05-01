use crate::config::{Config, ConfigError};
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
}

#[cfg(test)]
mod tests {
    use super::*;

    use crate::localization::L10NBundle;

    use crate::test_doubles::directories::ProjectDirs;
    use crate::test_doubles::serenity::{
        client::MockContext,
        model::id::{MessageData, MessageId},
    };
    use crate::test_doubles::std::{
        fs::File,
        path::{Path, PathBuf},
    };
    use crate::test_doubles::CONTEXT_SYNCHRONIZER;

    use serenity::prelude::RwLock;
    use std::sync::mpsc::channel;

    #[test]
    fn set_activity_to_none() -> CommandResult {
        // Mock context
        let (sender, receiver) = channel();
        let mut inner_ctx = MockContext::new();
        inner_ctx.expect_reset_presence().once().return_const(());
        let mut ctx = Context::_new(Some(sender), Some(inner_ctx), None);
        {
            let mut data = ctx.data.write();
            data.insert::<Config>(RwLock::new(Config::default()));
            data.insert::<L10NBundle>(RwLock::new(L10NBundle::new("en-US")?));
        }

        // Mock message
        let msg = Message::_new(MessageId::new(), 0, "$setactivity".to_string(), 0);

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

        let (_, content) = receiver.recv()?;
        assert_eq!(
            content,
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
        let mut ctx = Context::_new(Some(sender), Some(inner_ctx), None);
        {
            let mut data = ctx.data.write();
            data.insert::<Config>(RwLock::new(Config::default()));
            data.insert::<L10NBundle>(RwLock::new(L10NBundle::new("en-US")?));
        }

        // Mock message
        let msg = Message::_new(
            MessageId::new(),
            0,
            "$setactivity Hello, this is a test!".to_string(),
            0,
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

        let (_, content) = receiver.recv()?;
        assert_eq!(
            content,
            MessageData::StrMsg("Activity successfully modified!".to_string())
        );

        Ok(())
    }
}
