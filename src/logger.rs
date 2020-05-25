use std::{
    fmt::Arguments,
    io::{self, Write},
};

use env_logger::{
    fmt::{Color, Formatter},
    Builder, Env, Target,
};
use log::Record;
use once_cell::sync::Lazy;
use regex::Regex;
use thiserror::Error;

// This is based on the default format of env_logger
fn gen_header(buf: &mut Formatter, record: &Record) -> io::Result<()> {
    let mut black_style = buf.style();
    black_style.set_color(Color::Black).set_intense(true);

    let module_path = record.module_path().unwrap_or("");

    write!(
        buf,
        "{}{} {} {}{} ",
        black_style.value("["),
        buf.timestamp(),
        format_args!("{:<5}", buf.default_styled_level(record.level())),
        module_path,
        black_style.value("]"),
    )
}

// Slight modification of https://github.com/sebasmagri/env_logger/blob/master/src/fmt/mod.rs#L318
fn write_args(buf: &mut Formatter, args: &Arguments, done: bool) -> io::Result<()> {
    struct IndentWrapper<'a> {
        buf: &'a mut Formatter,
        indent_count: usize,
    }

    impl<'a> Write for IndentWrapper<'a> {
        fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
            let mut first = true;
            for chunk in buf.split(|&x| x == b'\n') {
                if !first {
                    write!(self.buf, "\n{:width$}", "", width = self.indent_count)?;
                }
                self.buf.write_all(chunk)?;
                first = false;
            }

            Ok(buf.len())
        }

        fn flush(&mut self) -> io::Result<()> {
            self.buf.flush()
        }
    }

    // The explicit scope here is just to make older versions of Rust happy
    {
        let mut wrapper = IndentWrapper {
            buf,
            indent_count: 4,
        };
        write!(wrapper, "{}", args)?;
    }

    if done {
        writeln!(buf)?;
    }

    Ok(())
}

#[derive(Error, Debug)]
pub enum CmdLogParseError {
    #[error("{0}")]
    IO(#[from] io::Error),
    #[error("Regex compile error: {0}")]
    Regex(#[from] &'static regex::Error),
    #[error("Could not get the capture groups")]
    NoCaptures,
    #[error("Could not get a capture group")]
    MissingCapture,
}

fn format_author_and_msg(buf: &mut Formatter, rest: &str) -> Result<(), CmdLogParseError> {
    //Capture groups order is:
    // 0: Entire string
    // 1: Author
    // 2: User_id
    // 3: Command
    // 4: Option<Arguments>
    static REGEX: Lazy<Result<Regex, regex::Error>> =
        Lazy::new(|| Regex::new(r"(.+)<(\d+)> -> (\S+)(.*)"));
    let caps = REGEX
        .as_ref()?
        .captures(rest)
        .ok_or(CmdLogParseError::NoCaptures)?;

    let mut black_style = buf.style();
    black_style.set_color(Color::Black).set_intense(true);

    let mut user_id_style = buf.style();
    user_id_style.set_color(Color::Red).set_intense(true);

    let mut cmd_style = buf.style();
    cmd_style.set_color(Color::Cyan).set_intense(true);

    let author = caps
        .get(1)
        .ok_or(CmdLogParseError::MissingCapture)?
        .as_str();

    let less_than = black_style.value("<");

    let user_id = user_id_style.value(
        caps.get(2)
            .ok_or(CmdLogParseError::MissingCapture)?
            .as_str(),
    );

    let more_than = black_style.value(">");

    let cmd = cmd_style.value(
        caps.get(3)
            .ok_or(CmdLogParseError::MissingCapture)?
            .as_str(),
    );

    let args = caps.get(4).map(|v| v.as_str()).unwrap_or("");

    Ok(write_args(
        buf,
        &format_args!(
            "{}{}{}{} -> {}{}",
            author, less_than, user_id, more_than, cmd, args
        ),
        true,
    )?)
}

fn format_cmd_guild(buf: &mut Formatter, log: &str) -> Result<(), CmdLogParseError> {
    //Capture groups order is:
    // 0: Entire string
    // 1: Guild_id
    // 2: Channed_id
    // 3: Rest

    static REGEX: Lazy<Result<Regex, regex::Error>> =
        Lazy::new(|| Regex::new(r"\[(\d+)-(\d+)\] (.+)"));
    let caps = REGEX
        .as_ref()?
        .captures(log)
        .ok_or(CmdLogParseError::NoCaptures)?;

    let mut black_style = buf.style();
    black_style.set_color(Color::Black).set_intense(true);

    let mut guild_id_style = buf.style();
    guild_id_style.set_color(Color::Green);

    let mut channel_id_style = buf.style();
    channel_id_style.set_color(Color::Green).set_intense(true);

    let opening_bracket = black_style.value("[");

    let guild_id = guild_id_style.value(
        caps.get(1)
            .ok_or(CmdLogParseError::MissingCapture)?
            .as_str(),
    );

    let separator = black_style.value("-");

    let channel_id = channel_id_style.value(
        caps.get(2)
            .ok_or(CmdLogParseError::MissingCapture)?
            .as_str(),
    );

    let closing_bracket = black_style.value("]");

    let rest = caps
        .get(3)
        .ok_or(CmdLogParseError::MissingCapture)?
        .as_str();

    write_args(
        buf,
        &format_args!(
            "{}{}{}{}{} ",
            opening_bracket, guild_id, separator, channel_id, closing_bracket,
        ),
        false,
    )?;

    if let Err(e) = format_author_and_msg(buf, rest) {
        // Avoid duplication of header
        error!("{}", e);
        write_args(buf, &format_args!("{}", rest), true)?
    }

    Ok(())
}

fn format_cmd_not_guild(buf: &mut Formatter, log: &str) -> Result<(), CmdLogParseError> {
    //Capture groups order is:
    // 0: Entire string
    // 1: Channed_id
    // 2: Rest
    static REGEX: Lazy<Result<Regex, regex::Error>> = Lazy::new(|| Regex::new(r"\[(\d+)\] (.+)"));
    let caps = REGEX
        .as_ref()?
        .captures(log)
        .ok_or(CmdLogParseError::NoCaptures)?;

    let mut black_style = buf.style();
    black_style.set_color(Color::Black).set_intense(true);

    let mut channel_id_style = buf.style();
    channel_id_style.set_color(Color::Green).set_intense(true);

    let opening_bracket = black_style.value("[");

    let channel_id = channel_id_style.value(
        caps.get(1)
            .ok_or(CmdLogParseError::MissingCapture)?
            .as_str(),
    );

    let closing_bracket = black_style.value("]");

    let rest = caps
        .get(2)
        .ok_or(CmdLogParseError::MissingCapture)?
        .as_str();

    write_args(
        buf,
        &format_args!("{}{}{} ", opening_bracket, channel_id, closing_bracket,),
        false,
    )?;

    if let Err(e) = format_author_and_msg(buf, rest) {
        // Avoid duplication of header
        error!("{}", e);
        write_args(buf, &format_args!("{}", rest), true)?
    }

    Ok(())
}

pub fn init() {
    let env = Env::default()
        .filter_or("RUST_LOG", "info")
        .write_style_or("RUST_LOG_STYLE", "auto");

    Builder::from_env(env)
        .target(Target::Stderr)
        .format(|buf, record| {
            gen_header(buf, record)?;

            let args_string = record.args().to_string();
            match record.target() {
                "cmd-not-guild" => {
                    if let Err(e) = format_cmd_not_guild(buf, args_string.as_str()) {
                        error!("{}", e);
                        write_args(buf, record.args(), true)
                    } else {
                        Ok(())
                    }
                }
                "cmd-guild" => {
                    if let Err(e) = format_cmd_guild(buf, args_string.as_str()) {
                        error!("{}", e);
                        write_args(buf, record.args(), true)
                    } else {
                        Ok(())
                    }
                }
                // Default format
                _ => write_args(buf, record.args(), true),
            }
        })
        .init();
}
