use crate::config::{Config, ConfigError};
use crate::localization::{L10NBundle, L10NError, Localize};
use crate::util::{BoundedInteger, BoundedIntegerError};
use crate::{ClientContainer, ClientError};

use std::{borrow::Cow, fmt, str::FromStr};

use ::rand::distributions::Distribution;
use fluent::fluent_args;
use serde_json::Value;
use serenity::framework::standard::{Args, CheckResult, CommandOptions, CommandResult, Delimiter};
use thiserror::Error;

cfg_if::cfg_if! {
    if #[cfg(test)] {
        use crate::test_doubles::serenity::{
            client::Context,
            model::{channel::Message},
        };
        use crate::test_doubles::rand::{self, distributions::uniform::Uniform};
    } else {
        use serenity::{
            client::Context,
            model::{channel::Message},
        };
        use rand::distributions::uniform::Uniform;
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

fn flip_coin(ctx: &mut Context, msg: &Message) -> CommandResult {
    let data = ctx.data.read();
    let l10n = data
        .get::<L10NBundle>()
        .ok_or(L10NError::MissingFromShareMap)?
        .read();

    let flip_msg = l10n.get_message("flipcoin")?;
    // 50% chance
    let side = if rand::random() {
        l10n.get_msg_attribute(&flip_msg, "tails", None)
    } else {
        l10n.get_msg_attribute(&flip_msg, "heads", None)
    }?;

    msg.channel_id.say(
        &ctx.http,
        l10n.get_msg_value(&flip_msg, Some(&fluent_args!["side" => side]))?,
    )?;

    Ok(())
}

#[derive(Clone, Debug)]
struct DiceRollResult {
    rolls: Vec<u32>,
    modifier: Option<BoundedInteger<i16>>,
    sum: i32,
}

impl fmt::Display for DiceRollResult {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        // After 30 rolls displayed, put a "..."
        const MAX_ROLLS: usize = 30;

        // Iterator over the limit of rolls
        let mut iterator = self.rolls.iter().take(MAX_ROLLS);

        // The first roll is simply displayed
        let mut display_rolls = iterator.next().ok_or(fmt::Error)?.to_string();
        // The others are added
        display_rolls += iterator
            .enumerate()
            .map(|(i, r)| {
                // If we're at the last roll and they're others after the limit, add a "..."
                // -2 because we start at 0 and the first one is not counted
                if i == MAX_ROLLS - 2 && self.rolls.len() > MAX_ROLLS {
                    // We cut some rolls
                    format!(" + {}...", r)
                } else {
                    // Just another roll
                    format!(" + {}", r)
                }
            })
            .collect::<String>()
            .as_str();

        if let Some(modifier) = self.modifier {
            // We have modifier, print it
            write!(
                f,
                "({}) + {} = {}",
                display_rolls,
                modifier.value(),
                self.sum
            )
        } else {
            // We don't
            write!(f, "({}) = {}", display_rolls, self.sum)
        }
    }
}

// This uses u16 and i16 because I don't want it too fail when parsing
// a slighty out of bound number. The numbers are also bounded.
#[derive(Clone, Debug)]
struct DiceRoll {
    dice: BoundedInteger<u16>,
    sides: BoundedInteger<u16>,
    modifier: Option<BoundedInteger<i16>>,
}

impl DiceRoll {
    const MAX_DICE: u16 = 255;
    const MAX_SIZE: u16 = 255;
    const MAX_MODIFIER: i16 = 255;

    fn new(dice: u16, sides: u16, modifier: Option<i16>) -> Result<Self, BoundedIntegerError> {
        // A way to convert modifier because map() can't use the '?' operator
        let modifier = if let Some(modifier) = modifier {
            Some(BoundedInteger::new(
                modifier,
                -Self::MAX_MODIFIER,
                Self::MAX_MODIFIER,
            )?)
        } else {
            None
        };

        Ok(Self {
            dice: BoundedInteger::new(dice, 0, Self::MAX_DICE)?,
            sides: BoundedInteger::new(sides, 0, Self::MAX_SIZE)?,
            modifier,
        })
    }

    /// Compute the result
    fn roll(&self) -> DiceRollResult {
        let mut results = Vec::new();
        // Reused for performance when doing multiple rolls
        let mut rng = rand::thread_rng();

        // Spin some virtual dice and store the results
        let range = Uniform::from(1..self.sides.value() as u32 + 1);
        for _ in 0..self.dice.value() {
            results.push(range.sample(&mut rng));
        }

        // Iter through the results and add the modifier
        let sum = results.iter().sum::<u32>() as i32
            + self.modifier.map(|m| m.value()).unwrap_or(0) as i32;

        DiceRollResult {
            rolls: results,
            sum,
            modifier: self.modifier,
        }
    }
}

// TODO: better error message for number parsing (depends on https://github.com/rust-lang/rust/issues/22639)
#[derive(Error, Debug)]
enum DiceRollParseError {
    #[error("The 'd' is missing")]
    MissingD,
    #[error("Invalid number of dice: {0:?}")]
    InvalidDiceNum(String),
    #[error("Invalid number of sides: {0:?}")]
    InvalidSidesNum(String),
    #[error("Invalid modifier: {0:?}")]
    InvalidModifier(String),
    #[error("{0}")]
    BoundError(#[from] BoundedIntegerError),
}

impl FromStr for DiceRoll {
    type Err = DiceRollParseError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        // Try to find the 'd'
        let mut index = s.find('d').ok_or(DiceRollParseError::MissingD)?;
        // If the index is over 0, then the number of dice is specified
        let dice = if index > 0 {
            let dice_num_arg = &s[0..index];
            dice_num_arg
                .parse()
                .map_err(|_| DiceRollParseError::InvalidDiceNum(dice_num_arg.to_string()))?
        } else {
            // Default to one die
            1
        };

        // Pass the 'd'
        index += 1;

        // Next we iterate after the 'd' until the end or when the chars are no longer numbers
        let side_offset = s[index..]
            .chars()
            .take_while(|c| c.is_ascii_digit())
            .count();
        let sides_arg = &s[index..index + side_offset];
        // Parse the sides number
        let sides = sides_arg
            .parse()
            .map_err(|_| DiceRollParseError::InvalidSidesNum(sides_arg.to_string()))?;

        // Pass the sides number
        index += side_offset;

        // If we're not done yet, time to parse the modifier
        let modifier = if index < s.len() {
            let modifier_arg = &s[index..];
            Some(
                modifier_arg
                    .parse()
                    .map_err(|_| DiceRollParseError::InvalidModifier(modifier_arg.to_string()))?,
            )
        } else {
            // No modifier
            None
        };

        Ok(Self::new(dice, sides, modifier)?)
    }
}

fn roll(ctx: &mut Context, msg: &Message) -> CommandResult {
    let mut args = Args::new(msg.content.as_str(), &[Delimiter::Single(' ')]);
    // Skip cmd
    args.advance();

    // First, we check that we actually have arguments
    let roll = if let Some(args_str) = args.remains() {
        DiceRoll::from_str(args_str)
    } else {
        // We defaults to 1d6
        Ok(DiceRoll::new(1, 6, None)?)
    };

    let message_to_send = match roll {
        Ok(roll) => Cow::Owned(roll.roll().to_string()),
        Err(e) => {
            log::debug!("{}", e);
            ctx.localize_msg("roll-parsing-error", None)?
        }
    };

    msg.channel_id.say(&ctx.http, message_to_send)?;

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

    #[command]
    #[description("Flip a virtual coin")]
    fn flipcoin(ctx: &mut Context, msg: &Message) -> CommandResult {
        super::flip_coin(ctx, msg)
    }

    #[command]
    #[description("Roll virtual dice")]
    #[usage("[num of dice]d<num of sides>[modifier (+ or - a number)]")]
    fn roll(ctx: &mut Context, msg: &Message) -> CommandResult {
        super::roll(ctx, msg)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    use crate::config;
    use crate::localization::L10NBundle;

    use crate::test_doubles::rand::MockRandom;
    use crate::test_doubles::reqwest::blocking::{Client, RequestBuilder, Response};
    use crate::test_doubles::serenity::http::client::Http;

    use crate::test_doubles::CONTEXT_SYNCHRONIZER;
    use crate::test_utils;

    use mockall::predicate::eq;
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

    fn test_giphy_api_key_check(config: Option<Config>) -> CheckResult {
        // Mock context
        let mut ctx = Context::_new_bare();
        if let Some(config) = config {
            let mut data = ctx.data.write();
            data.insert::<Config>(RwLock::new(config));
        }

        // Mock message
        let msg = Message::_from_str("$gif");
        has_giphy_api_key_check(
            &mut ctx,
            &msg,
            &mut Args::new("$gif", &[Delimiter::Single(' ')]),
            &CommandOptions::default(),
        )
    }

    #[test]
    fn no_giphy_api_key() {
        let result = test_giphy_api_key_check(Some(Config::default()));

        assert!(!result.is_success())
    }

    #[test]
    fn has_giphy_api_key() {
        let result = test_giphy_api_key_check(Some(config_with_giphy_api()));

        assert!(result.is_success())
    }

    #[test]
    fn giphy_api_key_no_config() {
        let result = test_giphy_api_key_check(None);

        assert!(!result.is_success())
    }

    fn test_gif_commands(
        msg: &str,
        url: &'static str,
        response_json: Value,
        response_msg: &str,
        search_type: GifSearchType,
    ) -> CommandResult {
        let mut http = Http::new();
        test_utils::check_response_msg(&mut http, response_msg);

        // Mock reqwest client
        let mut client = Client::new();
        client.expect_get().once().with(eq(url)).return_once(|_| {
            let mut builder = RequestBuilder::new();
            builder.expect_send().once().return_once(|| {
                let mut response = Response::new();
                response
                    .expect_text()
                    .once()
                    .return_once(move || Ok(response_json.to_string()));
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
        let msg = Message::_from_str(msg);

        get_gif(&mut ctx, &msg, search_type)?;

        Ok(())
    }

    #[test]
    fn gif_alone() -> CommandResult {
        let json = json!({
            "data": [{
                "url": "the.url"
            }]
        });

        test_gif_commands(
            "$gif",
            "https://api.giphy.com/v1/gifs/trending?&limit=1&rating=g&api_key=1234",
            json,
            "the.url",
            GifSearchType::Trending,
        )
    }

    #[test]
    fn gif_with_tag() -> CommandResult {
        let json = json!({
            "data": [{
                "url": "the.url"
            }]
        });

        test_gif_commands(
            "$gif test",
            "https://api.giphy.com/v1/gifs/search?q=test&limit=1&rating=g&api_key=1234",
            json,
            "the.url",
            GifSearchType::Trending,
        )
    }

    #[test]
    fn gif_random_alone() -> CommandResult {
        let json = json!({
            "data": {
                "url": "the.url"
            }
        });

        test_gif_commands(
            "$gifrandom",
            "https://api.giphy.com/v1/gifs/random?&limit=1&rating=g&api_key=1234",
            json,
            "the.url",
            GifSearchType::Random,
        )
    }

    #[test]
    fn gif_random_tag() -> CommandResult {
        let json = json!({
            "data": {
                "url": "the.url"
            }
        });

        test_gif_commands(
            "$gifrandom test",
            "https://api.giphy.com/v1/gifs/random?tag=test&limit=1&rating=g&api_key=1234",
            json,
            "the.url",
            GifSearchType::Random,
        )
    }

    #[test]
    fn gif_no_result() -> CommandResult {
        let json = json!({
            "data": []
        });

        test_gif_commands(
            "$gif",
            "https://api.giphy.com/v1/gifs/trending?&limit=1&rating=g&api_key=1234",
            json,
            "Couldn't find any matching GIF.",
            GifSearchType::Trending,
        )
    }

    #[test]
    fn gif_url_not_string() -> CommandResult {
        let json = json!({
            "data": [{
                "url": 1
            }]
        });

        test_gif_commands(
            "$gif",
            "https://api.giphy.com/v1/gifs/trending?&limit=1&rating=g&api_key=1234",
            json,
            "Couldn't parse the GIPHY response.",
            GifSearchType::Trending,
        )
    }

    fn test_flip_coin(random_bool: bool, side: &str) -> CommandResult {
        let mut http = Http::new();
        test_utils::check_response_msg(
            &mut http,
            format!("*The coin lands on \u{2068}{}\u{2069}.*", side).as_str(),
        );

        // Mock context
        let mut ctx = Context::_new(None, http);
        {
            let mut data = ctx.data.write();
            data.insert::<L10NBundle>(RwLock::new(L10NBundle::new("en-US")?));
        }

        // Mock message
        let msg = Message::_from_str("$flipcoin");

        // Guards for mock contexts
        let _guards = CONTEXT_SYNCHRONIZER.get_ctx_guards(vec!["random"]);

        let random_ctx = MockRandom::random_context();
        random_ctx.expect().returning(move || random_bool);

        flip_coin(&mut ctx, &msg)
    }

    #[test]
    fn flip_a_coin_tails() -> CommandResult {
        test_flip_coin(true, "tails")
    }

    #[test]
    fn flip_a_coin_heads() -> CommandResult {
        test_flip_coin(false, "heads")
    }

    // This is used so often
    const ROLL_INVALID_USE: &str = "This roll could not be parsed. Make sure to include numbers smaller than 256 and follow this syntax: `[num of dice]d<num of sides>[modifier (+ or - a number)]`";

    fn test_roll(
        msg: &str,
        response_msg: &str,
        random_values: Option<&'static [u32]>,
    ) -> CommandResult {
        let mut http = Http::new();
        test_utils::check_response_msg(&mut http, response_msg);

        // Mock context
        let mut ctx = Context::_new(None, http);
        {
            let mut data = ctx.data.write();
            data.insert::<L10NBundle>(RwLock::new(L10NBundle::new("en-US")?));
        }

        // Mock message
        let msg = Message::_from_str(msg);

        // Guards for mock contexts
        let _guards = CONTEXT_SYNCHRONIZER.get_ctx_guards(vec!["random"]);

        if let Some(random_values) = random_values {
            let mut random_iter = random_values.iter().cycle();

            let random_ctx = MockRandom::random_context();
            random_ctx
                .expect()
                .returning(move || *random_iter.next().unwrap());
            // The contexts need to be in context
            roll(&mut ctx, &msg)
        } else {
            roll(&mut ctx, &msg)
        }
    }

    #[test]
    fn roll_no_argument() -> CommandResult {
        test_roll("$roll", "(3) = 3", Some(&[3]))
    }

    #[test]
    fn roll_implicit_one() -> CommandResult {
        test_roll("$roll d6", "(6) = 6", Some(&[6]))
    }

    #[test]
    fn roll_explicit_one() -> CommandResult {
        test_roll("$roll 1d20", "(16) = 16", Some(&[16]))
    }

    #[test]
    fn roll_multiple_dice() -> CommandResult {
        test_roll("$roll 2d7", "(2 + 7) = 9", Some(&[2, 7]))
    }

    #[test]
    fn roll_modifier() -> CommandResult {
        test_roll(
            "$roll 5d3+5",
            "(1 + 2 + 3 + 2 + 1) + 5 = 14",
            Some(&[1, 2, 3, 2, 1]),
        )
    }

    #[test]
    fn roll_negative_response() -> CommandResult {
        test_roll("$roll 2d3-10", "(3 + 2) + -10 = -5", Some(&[3, 2]))
    }

    #[test]
    fn roll_max_dice_display_limit() -> CommandResult {
        test_roll("$roll 30d1+2", "(1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1) + 2 = 32", Some(&[1]))
    }

    #[test]
    fn roll_max_dice_display_limit_plus_one() -> CommandResult {
        test_roll("$roll 31d1+2", "(1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1...) + 2 = 33", Some(&[1]))
    }

    #[test]
    fn roll_missing_d() -> CommandResult {
        test_roll("$roll 2f3", ROLL_INVALID_USE, None)
    }

    #[test]
    fn roll_invalid_dice_num() -> CommandResult {
        test_roll("$roll 2%d3", ROLL_INVALID_USE, None)
    }

    #[test]
    fn roll_invalid_sides_num() -> CommandResult {
        // This is so huge that the parsing will fail before we can check it is out of bound
        test_roll("$roll 2d30000000000000", ROLL_INVALID_USE, None)
    }

    #[test]
    fn roll_invalid_modifier() -> CommandResult {
        test_roll("$roll 2d3d", ROLL_INVALID_USE, None)
    }

    #[test]
    fn roll_out_of_bound_dice_num() -> CommandResult {
        test_roll("$roll 300d3", ROLL_INVALID_USE, None)
    }

    #[test]
    fn roll_out_of_bound_sides_num() -> CommandResult {
        test_roll("$roll 2d300", ROLL_INVALID_USE, None)
    }

    #[test]
    fn roll_out_of_bound_modifier() -> CommandResult {
        test_roll("$roll 2d3-300", ROLL_INVALID_USE, None)
    }
}
