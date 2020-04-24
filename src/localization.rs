use std::{
    borrow::Cow,
    fs::File,
    io::{Read, Result},
};

use fluent::{concurrent::FluentBundle, FluentArgs, FluentResource};
use serenity::prelude::{Mutex, TypeMapKey};
use unic_langid::LanguageIdentifier;

cfg_if::cfg_if! {
    if #[cfg(test)] {
        use crate::test_doubles::serenity::client::{Client, Context};
    } else {
        use serenity::client::{Client, Context};
    }
}

pub trait Localize {
    fn localize_msg<'bundle>(
        &'bundle self,
        id: &'bundle str,
        args: Option<&'bundle FluentArgs>,
    ) -> Option<Cow<str>>;
}

pub struct L10NBundle {
    bundle: FluentBundle<FluentResource>,
}

impl L10NBundle {
    pub fn new(locale: &str) -> Self {
        let langid: LanguageIdentifier = locale.parse().expect("Wrong locale");
        let mut bundle = FluentBundle::new(&[langid]);

        // Add ressources
        bundle
            .add_resource(Self::load_res_file(locale, "general").unwrap())
            .expect("Failed to add FTL resources to the bundle.");
        bundle
            .add_resource(Self::load_res_file(locale, "errors").unwrap())
            .expect("Failed to add FTL resources to the bundle.");
        bundle
            .add_resource(Self::load_res_file(locale, "commands").unwrap())
            .expect("Failed to add FTL resources to the bundle.");

        Self { bundle }
    }

    pub fn get_bundle(&self) -> &FluentBundle<FluentResource> {
        &self.bundle
    }

    fn load_res_file(locale: &str, name: &str) -> Result<FluentResource> {
        let mut file = File::open(format!("resources/{}/{}.ftl", locale, name))?;
        let mut contents = String::new();
        file.read_to_string(&mut contents)?;
        let res = FluentResource::try_new(contents).expect("Failed to parse an FTL string.");
        Ok(res)
    }
}

impl Localize for L10NBundle {
    fn localize_msg<'bundle>(
        &'bundle self,
        id: &'bundle str,
        args: Option<&'bundle FluentArgs>,
    ) -> Option<Cow<str>> {
        let msg = self.bundle.get_message(id)?;
        let mut errors = vec![];
        let pattern = msg.value?;
        Some(self.bundle.format_pattern(&pattern, args, &mut errors))
    }
}

impl TypeMapKey for L10NBundle {
    type Value = Mutex<L10NBundle>;
}

impl Localize for Context {
    fn localize_msg<'bundle>(
        &'bundle self,
        id: &'bundle str,
        args: Option<&'bundle FluentArgs>,
    ) -> Option<Cow<str>> {
        Some(Cow::Owned(
            self.data
                .read()
                .get::<L10NBundle>()?
                .lock()
                .localize_msg(id, args)?
                .into_owned(),
        ))
    }
}

impl Localize for Client {
    fn localize_msg<'bundle>(
        &'bundle self,
        id: &'bundle str,
        args: Option<&'bundle FluentArgs>,
    ) -> Option<Cow<str>> {
        Some(Cow::Owned(
            self.data
                .read()
                .get::<L10NBundle>()?
                .lock()
                .localize_msg(id, args)?
                .into_owned(),
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    use fluent::fluent_args;
    use std::sync::mpsc::channel;

    #[test]
    fn create_bundle_and_get_msg() {
        let bundle = L10NBundle::new("en-US");
        assert_eq!(
            bundle.localize_msg("startup", None).unwrap(),
            "MuDiBot is starting up..."
        )
    }

    #[test]
    fn create_bundle_and_get_msg_but_in_french() {
        let bundle = L10NBundle::new("fr");
        assert_eq!(
            bundle.localize_msg("startup", None).unwrap(),
            "MuDiBot démarre..."
        )
    }

    #[test]
    fn borrow_bundle() {
        let bundle = L10NBundle::new("en-US");
        let msg = bundle.get_bundle().get_message("startup").unwrap();
        let mut errors = vec![];
        let pattern = msg.value.unwrap();
        assert_eq!(
            bundle
                .get_bundle()
                .format_pattern(&pattern, None, &mut errors),
            "MuDiBot is starting up..."
        )
    }

    #[test]
    fn message_with_placeable() {
        let bundle = L10NBundle::new("en-US");
        assert_eq!(
            bundle
                .localize_msg("connected", Some(&fluent_args!["bot-user" => "TestBot"]))
                .unwrap(),
            "\u{2068}TestBot\u{2069} is connected!"
        )
    }

    #[test]
    fn context_localize_msg() {
        let (sender, _) = channel();
        let ctx = Context::_new(sender);
        {
            let mut data = ctx.data.write();
            data.insert::<L10NBundle>(serenity::prelude::Mutex::new(L10NBundle::new("en-US")));
        }
        assert_eq!(
            ctx.localize_msg("startup", None).unwrap(),
            "MuDiBot is starting up..."
        )
    }

    #[test]
    fn client_localize_msg() {
        let client = Client::_new();
        {
            let mut data = client.data.write();
            data.insert::<L10NBundle>(serenity::prelude::Mutex::new(L10NBundle::new("en-US")));
        }
        assert_eq!(
            client.localize_msg("startup", None).unwrap(),
            "MuDiBot is starting up..."
        )
    }
}
