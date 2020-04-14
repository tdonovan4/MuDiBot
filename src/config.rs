use std::{
    default::Default,
    fs::{self, File},
    io::{self, Read},
    path::{Path, PathBuf},
};

use directories::ProjectDirs;
use serde::{Deserialize, Serialize};
use serenity::prelude::*;

/// A table to store all the tokens of the different APIs used by to bot.
#[derive(Debug, Serialize, Deserialize)]
pub struct Credentials {
    /// The main token used to connect to the Discord API.
    /// Create or get it here: https://discordapp.com/developers/applications.
    ///
    /// This field is not mandatory because it can be overwrited by the `DISCORD_TOKEN` environment variable.
    /// If the field and the environment variable are not set, the bot will panic.
    pub bot_token: Option<String>,
    /// Token to connect to the Youtube v3 API.
    pub youtube_api_key: Option<String>,
    /// Token to connect to the Giphy API.
    pub giphy_api_key: Option<String>,
}

impl Default for Credentials {
    fn default() -> Self {
        Self {
            bot_token: None,
            youtube_api_key: None,
            giphy_api_key: None,
        }
    }
}

/// A table for the options of the prometheus metrics.
#[derive(Debug, Serialize, Deserialize)]
pub struct Metrics {
    /// Determines if the bot exports metrics to prometheus.
    pub activated: bool,
    /// If metrics are activated, what port to host the exporter.
    pub exporter_port: u32,
}

impl Default for Metrics {
    fn default() -> Self {
        Self {
            activated: false,
            exporter_port: 4444,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
/// A table containing options affecting the entire bot.
/// These options cannot be changed by a server configuration.
struct Global {
    /// What status should the bot display.
    current_status: String,
    /// The path to the SQLite database.
    path_database: PathBuf,
    /// A list of users that can bypass the permission checks. This field uses user ids.
    superusers: Option<Vec<u32>>,
    /// The cooldown between messages in ms before a user can get experience again.
    xp_cooldown: u32,
    /// Prometheus metrics configuration.
    metrics: Metrics,
}

impl Default for Global {
    fn default() -> Self {
        Self {
            current_status: "Type $help".to_string(),
            path_database: PathBuf::from("./storage/data.db"),
            superusers: None,
            xp_cooldown: 3000,
            metrics: Metrics::default(),
        }
    }
}

/// A table describing a permission group.
#[derive(Debug, Serialize, Deserialize)]
pub struct PermissionGroup {
    /// The name of the group.
    name: String,
    /// The permission level for commands.
    perm_lvl: u32,
    /// The maximum number of custom commands a user of this group can create.
    max_custom_cmds: u32,
}

/// A table for options that can be overwritten by a server configuration.
#[derive(Debug, Serialize, Deserialize)]
struct ServerSpecific {
    /// The prefix before commands.
    prefix: String,
    /// The locale for the localization.
    locale: String,
    /// A list of permission groups.
    permission_groups: Vec<PermissionGroup>,
}

impl Default for ServerSpecific {
    fn default() -> Self {
        Self {
            prefix: "$".to_string(),
            locale: "en-US".to_string(),
            permission_groups: vec![
                PermissionGroup {
                    name: "User".to_string(),
                    perm_lvl: 0,
                    max_custom_cmds: 0,
                },
                PermissionGroup {
                    name: "Member".to_string(),
                    perm_lvl: 1,
                    max_custom_cmds: 5,
                },
                PermissionGroup {
                    name: "Mod".to_string(),
                    perm_lvl: 2,
                    max_custom_cmds: 10,
                },
                PermissionGroup {
                    name: "Admin".to_string(),
                    perm_lvl: 3,
                    max_custom_cmds: 15,
                },
            ],
        }
    }
}

/// The configuration of this bot. It has default settings that are overwritten by the configuration file.
/// Settings that have the [Option](https://doc.rust-lang.org/std/option/enum.Option.html) type can be omitted from the file.
/// The server specific settings can also be overwritten by a server configuration stored in the database.
#[derive(Debug, Default, Serialize, Deserialize)]
pub struct Config {
    /// All the tokens for the APIs used by the bot.
    credentials: Credentials,
    /// Settings that cannot be overwritten by servers.
    global: Global,
    /// Settings that can be overwritten by servers.
    server_specific: ServerSpecific,
}

impl Config {
    pub fn new() -> Self {
        // Get the path to the config file
        let project_dir = ProjectDirs::from("dev", "tdonovan", "MuDiBot").unwrap();
        let config_path = project_dir.config_dir().join("config.toml");
        // Check if the config file exists
        if config_path.exists() {
            println!("Configuration file found at {:?}", config_path);
            // Read it
            Self::read_config_file(&config_path).unwrap()
        } else {
            // We create the file and use the default
            println!("Creating the configuration file at {:?}", config_path);
            let default = Self::default();
            Self::write_config_file(&config_path, &default).unwrap();
            default
        }
    }

    pub fn get_creds(&self) -> &Credentials {
        &self.credentials
    }

    pub fn get_prefix(&self) -> &str {
        self.server_specific.prefix.as_str()
    }

    fn write_config_file(path: &Path, config: &Self) -> io::Result<()> {
        // Before writing, create folder for config
        fs::create_dir_all(path.parent().unwrap())?;
        fs::write(path, toml::to_string(&config).unwrap())?;
        Ok(())
    }

    fn read_config_file(path: &Path) -> io::Result<Self> {
        let mut file = File::open(path)?;
        let mut data = String::new();
        file.read_to_string(&mut data)?;
        Ok(toml::from_str(data.as_str()).unwrap())
    }
}

impl TypeMapKey for Config {
    type Value = Config;
}
