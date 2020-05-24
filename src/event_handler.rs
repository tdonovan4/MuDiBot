use crate::config;

use serenity::model::gateway::Activity;

cfg_if::cfg_if! {
    if #[cfg(test)] {
        use crate::test_doubles::serenity::{
            client::{Context, EventHandler},
            model::{gateway::Ready, event::ResumedEvent},
        };

        use serenity::prelude::RwLock;
    } else {
        use serenity::{
            client::{Context, EventHandler},
            model::{gateway::Ready, event::ResumedEvent},
        };
    }
}

pub struct Handler;

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

#[cfg(test)]
mod tests {
    use super::*;

    use crate::localization::{L10NBundle, L10NError};
    use crate::test_doubles::serenity::{
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
