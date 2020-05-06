use crate::config::{Config, ConfigError};
use crate::localization::Localize;
use crate::{ClientContainer, ClientError};

use std::borrow::Cow;

use serde_json::Value;
use serenity::framework::standard::{Args, CheckResult, CommandOptions, CommandResult, Delimiter};
use thiserror::Error;

cfg_if::cfg_if! {
    if #[cfg(test)] {
        use crate::test_doubles::serenity::{
            client::Context,
            model::{channel::Message},
        };
    } else {
        use serenity::{
            client::Context,
            model::{channel::Message},
        };
    }
}

fn has_giphy_api_key_check(
    ctx: &mut Context,
    _: &Message,
    _: &mut Args,
    _: &CommandOptions,
) -> CheckResult {
    let data = ctx.data.read();
    match data.get::<Config>() {
        Some(config) => config.read().get_creds().giphy_api_key.is_some(),
        None => false,
    }
    .into()
}

#[derive(Error, Debug)]
enum GifError {
    #[error("No giphy api key in config")]
    MissingApiKey,
}

/// Get the different endpoints for the type of search (with and without a tag)
enum GifSearchType {
    Trending,
    Random,
}

const BASE_URL: &str = "https://api.giphy.com/v1/gifs/";
const COMMON_QUERY: &str = "&limit=1&rating=g";

impl GifSearchType {
    fn url_without_tag(&self, key: &str) -> String {
        let middle = match self {
            Self::Trending => "trending",
            Self::Random => "random",
        };

        format!("{}{}?{}&api_key={}", BASE_URL, middle, COMMON_QUERY, key)
    }
    fn url_with_tag(&self, key: &str, tag: &str) -> String {
        let middle = match self {
            Self::Trending => "search?q=",
            Self::Random => "random?tag=",
        };

        format!(
            "{}{}{}{}&api_key={}",
            BASE_URL, middle, tag, COMMON_QUERY, key
        )
    }

    fn parse_returned_url<'a>(&self, response: &'a Value) -> &'a Value {
        match self {
            Self::Trending => &response["data"][0]["url"],
            Self::Random => &response["data"]["url"],
        }
    }
}

fn get_gif(ctx: &mut Context, msg: &Message, search_type: GifSearchType) -> CommandResult {
    let mut args = Args::new(msg.content.as_str(), &[Delimiter::Single(' ')]);
    // Skip cmd
    args.advance();

    let data = ctx.data.read();

    let config = data
        .get::<Config>()
        .ok_or(ConfigError::MissingFromShareMap)?
        .read();

    let client = data
        .get::<ClientContainer>()
        .ok_or(ClientError::MissingFromShareMap)?;

    // Should never fail because of check before
    let api_key = config
        .get_creds()
        .giphy_api_key
        .as_ref()
        .ok_or(GifError::MissingApiKey)?;

    let url = match args.remains() {
        Some(tag) => search_type.url_with_tag(api_key, tag),
        None => search_type.url_without_tag(api_key),
    };

    let response = client.get(url.as_str()).send()?;

    let json_value: Value = serde_json::from_str(response.text()?.as_str())?;

    let msg_to_send = match search_type.parse_returned_url(&json_value) {
        Value::String(url) => Cow::Borrowed(url.as_str()),
        Value::Null => ctx.localize_msg("no-gif", None)?,
        _ => {
            // This should no happen unless GIPHY changes the API
            warn!("Couldn't parse the GIPHY response. The returned url was not null nor a string.");
            ctx.localize_msg("giphy-response-parsing", None)?
        }
    };

    msg.channel_id.say(&ctx.http, msg_to_send)?;

    Ok(())
}

#[cfg(not(test))]
pub mod commands {
    use super::GifSearchType;

    use serenity::{
        framework::standard::{
            macros::{check, command},
            Args, CheckResult, CommandOptions, CommandResult,
        },
        model::prelude::*,
        prelude::*,
    };

    #[check]
    #[name = "has_giphy_api_key"]
    #[check_in_help(true)]
    #[display_in_help(true)]
    fn has_giphy_api_key_check(
        ctx: &mut Context,
        msg: &Message,
        args: &mut Args,
        options: &CommandOptions,
    ) -> CheckResult {
        super::has_giphy_api_key_check(ctx, msg, args, options)
    }

    #[command]
    #[checks(has_giphy_api_key)]
    #[description("Get the most popular gif with an optional tag")]
    #[usage("[tags]")]
    fn gif(ctx: &mut Context, msg: &Message) -> CommandResult {
        super::get_gif(ctx, msg, GifSearchType::Trending)
    }

    #[command]
    #[checks(has_giphy_api_key)]
    #[description("Get a random gif with an optional tag")]
    #[usage("[tags]")]
    fn gifrandom(ctx: &mut Context, msg: &Message) -> CommandResult {
        super::get_gif(ctx, msg, GifSearchType::Random)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    use crate::config;
    use crate::localization::L10NBundle;

    use crate::test_doubles::reqwest::blocking::{Client, RequestBuilder, Response};
    use crate::test_doubles::serenity::{
        http::client::Http,
        model::{id::MessageData, id::MessageId},
    };

    use mockall::predicate::{always, eq};
    use serde_json::json;
    use serenity::prelude::RwLock;

    fn config_with_giphy_api() -> Config {
        // Change default config
        let mut config = Config::default();
        let creds = config::Credentials {
            bot_token: None,
            youtube_api_key: None,
            giphy_api_key: Some("1234".to_string()),
        };
        config::test_utils::modify_creds(&mut config, creds);
        config
    }

    #[test]
    fn no_giphy_api_key() {
        // Mock context
        let mut ctx = Context::_new_bare();
        {
            let mut data = ctx.data.write();
            data.insert::<Config>(RwLock::new(Config::default()));
        }

        // Mock message
        let msg = Message::_new(MessageId::new(), 0, "$gif".to_string(), 0);

        let result = has_giphy_api_key_check(
            &mut ctx,
            &msg,
            &mut Args::new("$gif", &[Delimiter::Single(' ')]),
            &CommandOptions::default(),
        );

        assert!(!result.is_success())
    }

    #[test]
    fn has_giphy_api_key() {
        // Mock context
        let mut ctx = Context::_new_bare();
        {
            let mut data = ctx.data.write();
            data.insert::<Config>(RwLock::new(config_with_giphy_api()));
        }

        // Mock message
        let msg = Message::_new(MessageId::new(), 0, "$gif".to_string(), 0);

        let result = has_giphy_api_key_check(
            &mut ctx,
            &msg,
            &mut Args::new("$gif", &[Delimiter::Single(' ')]),
            &CommandOptions::default(),
        );

        assert!(result.is_success())
    }

    #[test]
    fn giphy_api_key_no_config() {
        // Mock context
        let mut ctx = Context::_new_bare();

        // Mock message
        let msg = Message::_new(MessageId::new(), 0, "$gif".to_string(), 0);

        let result = has_giphy_api_key_check(
            &mut ctx,
            &msg,
            &mut Args::new("$gif", &[Delimiter::Single(' ')]),
            &CommandOptions::default(),
        );

        assert!(!result.is_success())
    }

    #[test]
    fn gif_alone() -> CommandResult {
        // Main mock
        let mut http = Http::new();
        http.expect_mock_send()
            .with(always(), eq(MessageData::StrMsg("the.url".to_string())))
            .return_const(());
        http.expect_mock_get_channel()
            .returning(|| Err(serenity::Error::Other("Not important for test")));

        // Mock reqwest client
        let mut client = Client::new();
        client
            .expect_get()
            .once()
            .with(eq(
                "https://api.giphy.com/v1/gifs/trending?&limit=1&rating=g&api_key=1234",
            ))
            .returning(|_| {
                let mut builder = RequestBuilder::new();
                builder.expect_send().once().returning(|| {
                    let mut response = Response::new();
                    response.expect_text().once().returning(|| {
                        let json = json!({
                            "data": [{
                                "url": "the.url"
                            }]
                        });
                        Ok(json.to_string())
                    });
                    Ok(response)
                });
                builder
            });

        // Mock context
        let mut ctx = Context::_new(None, http);
        {
            let mut data = ctx.data.write();
            data.insert::<Config>(RwLock::new(config_with_giphy_api()));
            data.insert::<L10NBundle>(RwLock::new(L10NBundle::new("en-US")?));
            data.insert::<ClientContainer>(client);
        }

        // Mock message
        let msg = Message::_new(MessageId::new(), 0, "$gif".to_string(), 0);

        get_gif(&mut ctx, &msg, GifSearchType::Trending)?;

        Ok(())
    }

    #[test]
    fn gif_with_tag() -> CommandResult {
        // Main mock
        let mut http = Http::new();
        http.expect_mock_send()
            .with(always(), eq(MessageData::StrMsg("the.url".to_string())))
            .return_const(());
        http.expect_mock_get_channel()
            .returning(|| Err(serenity::Error::Other("Not important for test")));

        // Mock reqwest client
        let mut client = Client::new();
        client
            .expect_get()
            .once()
            .with(eq(
                "https://api.giphy.com/v1/gifs/search?q=test&limit=1&rating=g&api_key=1234",
            ))
            .returning(|_| {
                let mut builder = RequestBuilder::new();
                builder.expect_send().once().returning(|| {
                    let mut response = Response::new();
                    response.expect_text().once().returning(|| {
                        let json = json!({
                            "data": [{
                                "url": "the.url"
                            }]
                        });
                        Ok(json.to_string())
                    });
                    Ok(response)
                });
                builder
            });

        // Mock context
        let mut ctx = Context::_new(None, http);
        {
            let mut data = ctx.data.write();
            data.insert::<Config>(RwLock::new(config_with_giphy_api()));
            data.insert::<L10NBundle>(RwLock::new(L10NBundle::new("en-US")?));
            data.insert::<ClientContainer>(client);
        }

        // Mock message
        let msg = Message::_new(MessageId::new(), 0, "$gif test".to_string(), 0);

        get_gif(&mut ctx, &msg, GifSearchType::Trending)?;

        Ok(())
    }

    #[test]
    fn gif_random_alone() -> CommandResult {
        // Main mock
        let mut http = Http::new();
        http.expect_mock_send()
            .with(always(), eq(MessageData::StrMsg("the.url".to_string())))
            .return_const(());
        http.expect_mock_get_channel()
            .returning(|| Err(serenity::Error::Other("Not important for test")));

        // Mock reqwest client
        let mut client = Client::new();
        client
            .expect_get()
            .once()
            .with(eq(
                "https://api.giphy.com/v1/gifs/random?&limit=1&rating=g&api_key=1234",
            ))
            .returning(|_| {
                let mut builder = RequestBuilder::new();
                builder.expect_send().once().returning(|| {
                    let mut response = Response::new();
                    response.expect_text().once().returning(|| {
                        let json = json!({
                            "data": {
                                "url": "the.url"
                            }
                        });
                        Ok(json.to_string())
                    });
                    Ok(response)
                });
                builder
            });

        // Mock context
        let mut ctx = Context::_new(None, http);
        {
            let mut data = ctx.data.write();
            data.insert::<Config>(RwLock::new(config_with_giphy_api()));
            data.insert::<L10NBundle>(RwLock::new(L10NBundle::new("en-US")?));
            data.insert::<ClientContainer>(client);
        }

        // Mock message
        let msg = Message::_new(MessageId::new(), 0, "$gifrandom".to_string(), 0);

        get_gif(&mut ctx, &msg, GifSearchType::Random)?;

        Ok(())
    }

    #[test]
    fn gif_random_tag() -> CommandResult {
        // Main mock
        let mut http = Http::new();
        http.expect_mock_send()
            .with(always(), eq(MessageData::StrMsg("the.url".to_string())))
            .return_const(());
        http.expect_mock_get_channel()
            .returning(|| Err(serenity::Error::Other("Not important for test")));

        // Mock reqwest client
        let mut client = Client::new();
        client
            .expect_get()
            .once()
            .with(eq(
                "https://api.giphy.com/v1/gifs/random?tag=test&limit=1&rating=g&api_key=1234",
            ))
            .returning(|_| {
                let mut builder = RequestBuilder::new();
                builder.expect_send().once().returning(|| {
                    let mut response = Response::new();
                    response.expect_text().once().returning(|| {
                        let json = json!({
                            "data": {
                                "url": "the.url"
                            }
                        });
                        Ok(json.to_string())
                    });
                    Ok(response)
                });
                builder
            });

        // Mock context
        let mut ctx = Context::_new(None, http);
        {
            let mut data = ctx.data.write();
            data.insert::<Config>(RwLock::new(config_with_giphy_api()));
            data.insert::<L10NBundle>(RwLock::new(L10NBundle::new("en-US")?));
            data.insert::<ClientContainer>(client);
        }

        // Mock message
        let msg = Message::_new(MessageId::new(), 0, "$gifrandom test".to_string(), 0);

        get_gif(&mut ctx, &msg, GifSearchType::Random)?;

        Ok(())
    }

    #[test]
    fn gif_no_result() -> CommandResult {
        // Main mock
        let mut http = Http::new();
        http.expect_mock_send()
            .with(
                always(),
                eq(MessageData::StrMsg(
                    "Couldn't find any matching GIF.".to_string(),
                )),
            )
            .return_const(());
        http.expect_mock_get_channel()
            .returning(|| Err(serenity::Error::Other("Not important for test")));

        // Mock reqwest client
        let mut client = Client::new();
        client
            .expect_get()
            .once()
            .with(eq(
                "https://api.giphy.com/v1/gifs/trending?&limit=1&rating=g&api_key=1234",
            ))
            .returning(|_| {
                let mut builder = RequestBuilder::new();
                builder.expect_send().once().returning(|| {
                    let mut response = Response::new();
                    response.expect_text().once().returning(|| {
                        let json = json!({
                            "data": []
                        });
                        Ok(json.to_string())
                    });
                    Ok(response)
                });
                builder
            });

        // Mock context
        let mut ctx = Context::_new(None, http);
        {
            let mut data = ctx.data.write();
            data.insert::<Config>(RwLock::new(config_with_giphy_api()));
            data.insert::<L10NBundle>(RwLock::new(L10NBundle::new("en-US")?));
            data.insert::<ClientContainer>(client);
        }

        // Mock message
        let msg = Message::_new(MessageId::new(), 0, "$gif".to_string(), 0);

        get_gif(&mut ctx, &msg, GifSearchType::Trending)?;

        Ok(())
    }

    #[test]
    fn gif_url_not_string() -> CommandResult {
        // Main mock
        let mut http = Http::new();
        http.expect_mock_send()
            .with(
                always(),
                eq(MessageData::StrMsg(
                    "Couldn't parse the GIPHY response.".to_string(),
                )),
            )
            .return_const(());
        http.expect_mock_get_channel()
            .returning(|| Err(serenity::Error::Other("Not important for test")));

        // Mock reqwest client
        let mut client = Client::new();
        client
            .expect_get()
            .once()
            .with(eq(
                "https://api.giphy.com/v1/gifs/trending?&limit=1&rating=g&api_key=1234",
            ))
            .returning(|_| {
                let mut builder = RequestBuilder::new();
                builder.expect_send().once().returning(|| {
                    let mut response = Response::new();
                    response.expect_text().once().returning(|| {
                        let json = json!({
                            "data": [{
                                "url": 1
                            }]
                        });
                        Ok(json.to_string())
                    });
                    Ok(response)
                });
                builder
            });

        // Mock context
        let mut ctx = Context::_new(None, http);
        {
            let mut data = ctx.data.write();
            data.insert::<Config>(RwLock::new(config_with_giphy_api()));
            data.insert::<L10NBundle>(RwLock::new(L10NBundle::new("en-US")?));
            data.insert::<ClientContainer>(client);
        }

        // Mock message
        let msg = Message::_new(MessageId::new(), 0, "$gif".to_string(), 0);

        get_gif(&mut ctx, &msg, GifSearchType::Trending)?;

        Ok(())
    }
}
