use std::{borrow::Cow, io};

use fluent::{concurrent::FluentBundle, FluentArgs, FluentError, FluentMessage, FluentResource};
use serenity::prelude::{RwLock, TypeMapKey};
use thiserror::Error;
use unic_langid::{LanguageIdentifier, LanguageIdentifierError};

cfg_if::cfg_if! {
    if #[cfg(test)] {
        use crate::test_doubles::serenity::client::{Client, Context};
    } else {
        use serenity::client::{Client, Context};
    }
}

// This includes the consts containing the localization data built by the build script
include!(concat!(env!("OUT_DIR"), "/l10n_res.rs"));

#[derive(Error, Debug)]
pub enum L10NError {
    #[error(transparent)]
    Io(#[from] io::Error),
    #[error("Error(s) while parsing localization file: {0:?}")]
    Fluent(Vec<FluentError>),
    #[error("The localization bundle could not be extracted from the ShareMap")]
    MissingFromShareMap,
    #[error("The message \"{0}\" was not found")]
    MissingMsg(String),
    #[error("The message \"{0}\" does not have a value")]
    MissingValue(String),
    #[error("The message \"{0}\" does not have the \"{1}\" attribute")]
    MissingAttribute(String, String),
    #[error("Wrong locale: {0}")]
    LanguageIdentifierError(#[from] LanguageIdentifierError),
    #[error("Locale not translated: {0}")]
    NotLocalizedLocale(String),
}

impl From<Vec<FluentError>> for L10NError {
    fn from(errors: Vec<FluentError>) -> Self {
        Self::Fluent(errors)
    }
}

type Result<T> = std::result::Result<T, L10NError>;

pub struct L10NMessage<'a> {
    pub name: &'a str,
    pub msg: FluentMessage<'a>,
}

pub trait Localize {
    fn localize_msg<'bundle>(
        &'bundle self,
        msg_id: &'bundle str,
        args: Option<&'bundle FluentArgs>,
    ) -> Result<Cow<str>>;
}

fn str_to_locale(locale: &str) -> Option<&[&str]> {
    Some(match locale {
        "en-US" => &EN_US,
        "fr" => &FR,
        _ => return None,
    })
}

pub struct L10NBundle {
    bundle: FluentBundle<FluentResource>,
}

impl L10NBundle {
    pub fn new(locale: &str) -> Result<Self> {
        let langid: LanguageIdentifier = locale.parse()?;
        let mut bundle = FluentBundle::new(&[langid]);

        // Add ressources
        for res in str_to_locale(locale)
            .ok_or_else(|| L10NError::NotLocalizedLocale(locale.to_string()))?
            .iter()
        {
            bundle.add_resource(Self::load_res_file((*res).to_string())?)?;
        }

        Ok(Self { bundle })
    }

    pub fn get_message<'a>(&'a self, msg_id: &'a str) -> Result<L10NMessage> {
        Ok(L10NMessage::<'a> {
            name: msg_id,
            msg: self
                .bundle
                .get_message(msg_id)
                .ok_or_else(|| L10NError::MissingMsg(msg_id.to_string()))?,
        })
    }

    pub fn get_msg_value<'bundle>(
        &'bundle self,
        msg: &L10NMessage<'bundle>,
        args: Option<&'bundle FluentArgs>,
    ) -> Result<Cow<str>> {
        let mut errors = vec![];
        let pattern = msg
            .msg
            .value
            .ok_or_else(|| L10NError::MissingValue(msg.name.to_string()))?;
        let localized_msg = self.bundle.format_pattern(&pattern, args, &mut errors);

        //Only log the errors, since they are non fatal
        for error in errors {
            warn!("{:?}", error);
        }

        Ok(localized_msg)
    }

    pub fn get_msg_attribute<'bundle>(
        &'bundle self,
        msg: &L10NMessage<'bundle>,
        attribute: &'bundle str,
        args: Option<&'bundle FluentArgs>,
    ) -> Result<Cow<str>> {
        let mut errors = vec![];
        let pattern = msg.msg.attributes.get(attribute).ok_or_else(|| {
            L10NError::MissingAttribute(msg.name.to_string(), attribute.to_string())
        })?;
        let localized_msg = self.bundle.format_pattern(&pattern, args, &mut errors);

        //Only log the errors, since they are non fatal
        for error in errors {
            warn!("{:?}", error);
        }

        Ok(localized_msg)
    }

    fn load_res_file(contents: String) -> Result<FluentResource> {
        let res = FluentResource::try_new(contents).map_err(|(_, e)| {
            // Convert Vec<ParserError> into Vec<FluentError> because ParserError is not public
            e.into_iter()
                .map(FluentError::ParserError)
                .collect::<Vec<FluentError>>()
        })?;
        Ok(res)
    }
}

impl Localize for L10NBundle {
    fn localize_msg<'bundle>(
        &'bundle self,
        msg_id: &'bundle str,
        args: Option<&'bundle FluentArgs>,
    ) -> Result<Cow<str>> {
        Ok(self.get_msg_value(&self.get_message(msg_id)?, args)?)
    }
}

impl TypeMapKey for L10NBundle {
    type Value = RwLock<L10NBundle>;
}

impl Localize for Context {
    fn localize_msg<'bundle>(
        &'bundle self,
        msg_id: &'bundle str,
        args: Option<&'bundle FluentArgs>,
    ) -> Result<Cow<str>> {
        Ok(Cow::Owned(
            self.data
                .read()
                .get::<L10NBundle>()
                .ok_or(L10NError::MissingFromShareMap)?
                .read()
                .localize_msg(msg_id, args)?
                .into_owned(),
        ))
    }
}

impl Localize for Client {
    fn localize_msg<'bundle>(
        &'bundle self,
        msg_id: &'bundle str,
        args: Option<&'bundle FluentArgs>,
    ) -> Result<Cow<str>> {
        Ok(Cow::Owned(
            self.data
                .read()
                .get::<L10NBundle>()
                .ok_or(L10NError::MissingFromShareMap)?
                .read()
                .localize_msg(msg_id, args)?
                .into_owned(),
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    use fluent::fluent_args;

    #[test]
    fn create_bundle_and_get_msg() -> Result<()> {
        let bundle = L10NBundle::new("en-US")?;
        assert_eq!(bundle.localize_msg("info-embed", None)?, "__**~Info~**__");

        Ok(())
    }

    #[test]
    fn create_bundle_and_get_msg_but_in_french() -> Result<()> {
        let bundle = L10NBundle::new("fr")?;
        assert_eq!(bundle.localize_msg("info-embed", None)?, "__**~Infos~**__");

        Ok(())
    }

    #[test]
    fn get_message_and_its_value() -> Result<()> {
        let bundle = L10NBundle::new("en-US")?;
        let msg = bundle.get_message("info-embed")?;
        assert_eq!(bundle.get_msg_value(&msg, None)?, "__**~Info~**__");

        Ok(())
    }

    #[test]
    fn get_message_and_an_attribute() -> Result<()> {
        let bundle = L10NBundle::new("en-US")?;
        let msg = bundle.get_message("info-embed")?;
        assert_eq!(
            bundle.get_msg_attribute(&msg, "general-title", None)?,
            "**General**"
        );

        Ok(())
    }

    #[test]
    fn message_with_placeable() -> Result<()> {
        let bundle = L10NBundle::new("en-US")?;
        assert_eq!(
            bundle.localize_msg("ping-msg", Some(&fluent_args!["ping" => "15"]))?,
            "Pong! *Ping received after \u{2068}15\u{2069} ms.*"
        );

        Ok(())
    }

    #[test]
    fn context_localize_msg() -> Result<()> {
        let ctx = Context::_new_bare();
        {
            let mut data = ctx.data.write();
            data.insert::<L10NBundle>(RwLock::new(L10NBundle::new("en-US")?));
        }
        assert_eq!(ctx.localize_msg("info-embed", None)?, "__**~Info~**__");

        Ok(())
    }

    #[test]
    fn client_localize_msg() -> Result<()> {
        let client = Client::_new();
        {
            let mut data = client.data.write();
            data.insert::<L10NBundle>(RwLock::new(L10NBundle::new("en-US")?));
        }
        assert_eq!(client.localize_msg("info-embed", None)?, "__**~Info~**__");

        Ok(())
    }

    #[test]
    fn wrong_message_id() -> Result<()> {
        let bundle = L10NBundle::new("en-US")?;
        assert!(bundle.localize_msg("awsxc", None).is_err());

        Ok(())
    }

    #[test]
    fn wrong_message_attribute() -> Result<()> {
        let bundle = L10NBundle::new("en-US")?;
        let msg = bundle.get_message("info-embed")?;
        assert!(bundle.get_msg_attribute(&msg, "cxswa", None).is_err());

        Ok(())
    }

    #[test]
    fn parse_wrong_text() {
        assert!(L10NBundle::load_res_file("incomplete = ".to_string()).is_err());
    }

    #[test]
    fn value_recover_from_small_errors() -> Result<()> {
        let langid: LanguageIdentifier = "en-US".parse()?;
        let mut bundle = FluentBundle::new(&[langid]);
        // Cyclic
        bundle.add_resource(L10NBundle::load_res_file("test = { test }".to_string())?)?;

        assert!(L10NBundle { bundle }.localize_msg("test", None).is_ok());

        Ok(())
    }

    #[test]
    fn attribute_recover_from_small_errors() -> Result<()> {
        let langid: LanguageIdentifier = "en-US".parse()?;
        let mut bundle = FluentBundle::new(&[langid]);
        // Cyclic
        bundle.add_resource(L10NBundle::load_res_file(
            "test = { test }\n    .cyclic = { test }".to_string(),
        )?)?;
        let l10n = L10NBundle { bundle };

        assert!(l10n
            .get_msg_attribute(&l10n.get_message("test")?, "cyclic", None)
            .is_ok());

        Ok(())
    }

    #[test]
    fn locale_not_localized() {
        assert!(L10NBundle::new("sr-Latn-ME").is_err());
    }
}
