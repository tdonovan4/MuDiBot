use crate::localization::{L10NBundle, L10NError, Localize};
use crate::util::{BoundedInteger, BoundedIntegerError};

use std::{borrow::Cow, fmt, str::FromStr};

use ::rand::distributions::Distribution;
use fluent::fluent_args;
use serenity::framework::standard::{Args, CommandResult, Delimiter};
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

pub fn flip_coin(ctx: &mut Context, msg: &Message) -> CommandResult {
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
    #[error("Out of bound dice number: {0}")]
    OutOfBoundDiceNum(BoundedIntegerError),
    #[error("Out of bound sides number: {0}")]
    OutOfBoundSidesNum(BoundedIntegerError),
    #[error("Out of bound modifier: {0}")]
    OutOfBoundModifier(BoundedIntegerError),
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

    fn new(dice: u16, sides: u16, modifier: Option<i16>) -> Result<Self, DiceRollParseError> {
        // A way to convert modifier because map() can't use the '?' operator
        let modifier = if let Some(modifier) = modifier {
            Some(
                BoundedInteger::new(modifier, -Self::MAX_MODIFIER, Self::MAX_MODIFIER)
                    .map_err(DiceRollParseError::OutOfBoundModifier)?,
            )
        } else {
            None
        };

        Ok(Self {
            dice: BoundedInteger::new(dice, 1, Self::MAX_DICE)
                .map_err(DiceRollParseError::OutOfBoundDiceNum)?,
            sides: BoundedInteger::new(sides, 1, Self::MAX_SIZE)
                .map_err(DiceRollParseError::OutOfBoundSidesNum)?,
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

pub fn roll(ctx: &mut Context, msg: &Message) -> CommandResult {
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
        Err(e) => match e {
            DiceRollParseError::OutOfBoundDiceNum(BoundedIntegerError::TooSmall(_)) => {
                // Can only be 0 die because -1 won't parse into u16 and 1 is in bound
                ctx.localize_msg("roll-no-die", None)?
            }
            DiceRollParseError::OutOfBoundSidesNum(BoundedIntegerError::TooSmall(_)) => {
                // Can only be 0 side because -1 won't parse into u16 and 1 is in bound
                ctx.localize_msg("roll-no-side", None)?
            }
            _ => {
                log::debug!("{}", e);
                ctx.localize_msg("roll-parsing-error", None)?
            }
        },
    };

    msg.channel_id.say(&ctx.http, message_to_send)?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    use crate::localization::L10NBundle;

    use crate::test_doubles::rand::MockRandom;
    use crate::test_doubles::serenity::http::client::Http;

    use crate::test_doubles::CONTEXT_SYNCHRONIZER;
    use crate::test_utils;

    use serenity::prelude::RwLock;

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

    #[test]
    fn roll_no_die() -> CommandResult {
        test_roll(
            "$roll 0d0+5",
            "Alright then, no virtual die for you. :game_die:",
            None,
        )
    }

    #[test]
    fn roll_no_sides() -> CommandResult {
        test_roll(
            "$roll 2d0",
            "*Throws a die but it keeps rolling forever because it doesn't have a face to land on.*",
            None,
        )
    }
}
