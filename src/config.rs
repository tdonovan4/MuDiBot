use crate::util;

use std::{
    default::Default,
    io::{self, ErrorKind, Read, Write},
    path::PathBuf,
};

use serde::{Deserialize, Serialize};
use serenity::prelude::*;
use thiserror::Error;

cfg_if::cfg_if! {
    if #[cfg(test)] {
        use crate::test_doubles::std::{fs::{self, File}, path::Path};
    } else {
        use std::{fs::{self, File}, path::Path};
    }
}

#[derive(Error, Debug)]
pub enum ConfigError {
    #[error(transparent)]
    Io(#[from] io::Error),
    #[error("The config file could not be serialized: {0}")]
    Seserialize(#[from] toml::ser::Error),
    #[error("The config file could not be deserialized: {0}")]
    Deserialize(#[from] toml::de::Error),
    #[error("The config could not be extracted from the ShareMap")]
    MissingFromShareMap,
}

type Result<T> = std::result::Result<T, ConfigError>;

/// A table to store all the tokens of the different APIs used by to bot.
#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub struct Credentials {
    /// The main token used to connect to the Discord API.
    /// Create or get it here: https://discordapp.com/developers/applications.
    ///
    /// This field is not mandatory because it can be overwrited by the `DISCORD_TOKEN` environment variable.
    /// If the field and the environment variable are not set, the bot will not launch.
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
    pub fn new() -> Result<Self> {
        // Get the path to the config file
        let project_dir = util::get_project_dir()
            .ok_or(io::Error::new(ErrorKind::NotFound, "Project dir not found"))?;
        let config_path = project_dir.config_dir().join("config.toml");
        // Check if the config file exists
        if config_path.exists() {
            // Read it
            Ok(Self::read_config_file(&config_path)?)
        } else {
            // We create the file and use the default

            // This message is not localized because english is the default language
            info!("Creating the configuration file at {:?}", config_path);
            let default = Self::default();
            Self::write_config_file(&config_path, &default)?;
            Ok(default)
        }
    }

    pub fn get_creds(&self) -> &Credentials {
        &self.credentials
    }

    pub fn get_prefix(&self) -> &str {
        self.server_specific.prefix.as_str()
    }

    pub fn get_locale(&self) -> &str {
        self.server_specific.locale.as_str()
    }

    fn write_config_file(path: &Path, config: &Self) -> Result<()> {
        // Before writing, create folder for config
        fs::create_dir_all(
            path.parent()
                .ok_or(io::Error::new(ErrorKind::NotFound, "Config dir not found"))?,
        )?;
        File::create(path)?.write_all(toml::to_string(&config)?.as_ref())?;
        Ok(())
    }

    fn read_config_file(path: &Path) -> Result<Self> {
        let mut file = File::open(path)?;
        let mut data = String::new();
        file.read_to_string(&mut data)?;
        Ok(toml::from_str(data.as_str())?)
    }
}

impl TypeMapKey for Config {
    type Value = Config;
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_doubles::directories::ProjectDirs;
    use crate::test_doubles::{std::path::PathBuf, CONTEXT_SYNCHRONIZER};

    use std::cell::RefCell;

    thread_local! {
        static READ_INDEX: RefCell<usize> = RefCell::new(0);
    }

    #[test]
    fn create_new_config() -> Result<()> {
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
            config_path_buf.expect_exists().once().return_const(false);
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

        Config::new()?;

        Ok(())
    }

    #[test]
    fn read_config() -> Result<()> {
        // Mock config dir
        let mut config_dir = Path::default();
        config_dir.expect_join().once().returning(|_| {
            // Mock config path
            // As PathBuf
            let mut config_path_buf = PathBuf::new();
            config_path_buf.expect_exists().once().return_const(true);
            config_path_buf
                .expect_deref()
                .once()
                .return_const(Path::default());
            config_path_buf
        });

        // Guards for mock contexts
        let _guards = CONTEXT_SYNCHRONIZER.get_ctx_guards(vec!["project_dirs_from", "file_open"]);

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
        let toml_string = toml::to_string(&Config::default())?;
        let file_ctx = File::open_context();
        file_ctx.expect().once().return_once(|_| {
            let mut config_file = File::new();

            config_file.expect_read().returning(move |buf| {
                let bytes = toml_string.as_bytes();
                let mut index = READ_INDEX.with(|x| *x.borrow());
                let mut total = 0;

                for byte in buf.iter_mut() {
                    if index < toml_string.len() {
                        *byte = bytes[index];
                        total += 1;
                    } else {
                        *byte = 0;
                    }
                    index += 1;
                }

                // Update index
                READ_INDEX.with(|x| *x.borrow_mut() = index);

                Ok(total)
            });
            Ok(config_file)
        });

        Config::new()?;

        Ok(())
    }

    #[test]
    fn borrow_creds() {
        let config = Config::default();

        assert_eq!(config.get_creds(), &config.credentials);
    }

    #[test]
    fn borrow_prefix() {
        let config = Config::default();

        assert_eq!(config.get_prefix(), config.server_specific.prefix.as_str());
    }

    #[test]
    fn borrow_locale() {
        let config = Config::default();

        assert_eq!(config.get_locale(), config.server_specific.locale.as_str());
    }
}
