use std::{
    collections::HashSet,
    env,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use chrono::prelude::*;
use serenity::{
    client::bridge::gateway::ShardId,
    framework::standard::{
        help_commands,
        macros::{command, help},
        Args, CommandGroup, CommandResult, HelpOptions,
    },
    model::prelude::*,
    prelude::*,
};
use sysinfo::{ProcessExt, System, SystemExt};

use crate::ShardManagerContainer;

fn get_heartbeat_latency(ctx: &Context) -> Option<Duration> {
    ctx.data
        .read()
        .get::<ShardManagerContainer>()?
        .lock()
        .runners
        .lock()
        .get(&ShardId::from(ShardId(ctx.shard_id)))?
        .latency
}

fn duration_to_str(duration: chrono::Duration) -> String {
    let days = duration.num_days();
    let hours = duration.num_hours() - days * 24;
    let minutes = duration.num_minutes() - hours * 60;
    let seconds = duration.num_seconds() - minutes * 60;

    format!("{}d:{}h:{}m:{}s", days, hours, minutes, seconds)
}

#[command]
fn ping(ctx: &mut Context, msg: &Message) -> CommandResult {
    let ping = DateTime::from(Utc::now()) - msg.id.created_at();

    let mut msg_str = format!(
        "Pong! *Ping received after {} ms.*",
        ping.num_milliseconds(),
    );
    if let Some(heartbeat) = get_heartbeat_latency(ctx) {
        msg_str += &format!(
            " Current shard heartbeat ping of {} ms.",
            heartbeat.as_millis()
        )
    }

    let _ = msg.channel_id.say(&ctx.http, msg_str.as_str());
    Ok(())
}

#[command]
fn info(ctx: &mut Context, msg: &Message) -> CommandResult {
    let version = env::var("CARGO_PKG_VERSION")?;

    let mut sys = System::new();
    sys.refresh_all();
    let process = sys
        .get_process(sysinfo::get_current_pid().unwrap())
        .unwrap();
    let now = SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs();
    let uptime = chrono::Duration::seconds((now - process.start_time()) as i64);

    let bot = &(*ctx.cache).read().user;

    let _ = msg.channel_id.send_message(&ctx.http, |m| {
        m.embed(|e| {
            e.title("__**~Infos~**__");
            e.colour(0x0080c0);
            e.field(
                "**General**",
                format!(
                    "**Name:** MuDiBot\n\
                **Description:** A multipurpose Discord bot (MuDiBot) made using discord.js\n\
                **Author:** Thomas Donovan (tdonovan4)\n\
                **Version:** {}\n\
                **Uptime:** {}",
                    version,
                    duration_to_str(uptime)
                ),
                false,
            );
            e.field("**Config**", "**Language:** TODO", false);
            e.footer(|f| f.text(format!("Client ID: {}", bot.id)));
            e
        })
    });
    Ok(())
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
