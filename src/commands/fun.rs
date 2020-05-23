mod gif;
mod random;

#[cfg(not(test))]
pub mod commands {
    use super::gif::{self, GifSearchType};
    use super::random;

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
        gif::has_giphy_api_key_check(ctx, msg, args, options)
    }

    #[command]
    #[checks(has_giphy_api_key)]
    #[description("Get the most popular gif with an optional tag")]
    #[usage("[tags]")]
    fn gif(ctx: &mut Context, msg: &Message) -> CommandResult {
        gif::get_gif(ctx, msg, GifSearchType::Trending)
    }

    #[command]
    #[checks(has_giphy_api_key)]
    #[description("Get a random gif with an optional tag")]
    #[usage("[tags]")]
    fn gifrandom(ctx: &mut Context, msg: &Message) -> CommandResult {
        gif::get_gif(ctx, msg, GifSearchType::Random)
    }

    #[command]
    #[description("Flip a virtual coin")]
    fn flipcoin(ctx: &mut Context, msg: &Message) -> CommandResult {
        random::flip_coin(ctx, msg)
    }

    #[command]
    #[description("Roll virtual dice")]
    #[usage("[num of dice]d<num of sides>[modifier (+ or - a number)]")]
    fn roll(ctx: &mut Context, msg: &Message) -> CommandResult {
        random::roll(ctx, msg)
    }
}
