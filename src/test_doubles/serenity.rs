use std::sync::{mpsc::Sender, Arc};

pub mod client {
    use super::*;
    use model::{channel::Channel, event::ResumedEvent, gateway::Ready, id::MessageData};

    use serenity::{
        model::gateway::Activity,
        prelude::{RwLock, ShareMap},
    };

    pub trait EventHandler {
        fn ready(&self, ctx: Context, ready: Ready);

        fn resume(&self, ctx: Context, _: ResumedEvent);
    }

    pub struct Client {
        pub data: Arc<RwLock<ShareMap>>,
    }

    impl Client {
        pub fn _new() -> Self {
            let map = ShareMap::custom();

            Self {
                data: Arc::new(RwLock::new(map)),
            }
        }
    }

    mockall::mock! {
        pub Context {
            fn set_activity(&self, activity: Activity);
            fn reset_presence(&self);
        }
    }

    // Wrapper around a mock so that we can have fields
    pub struct Context {
        pub data: Arc<RwLock<ShareMap>>,
        pub shard_id: u64,
        pub http: Arc<http::client::Http>,
        pub cache: Arc<RwLock<super::cache::Cache>>,
        pub _inner: Option<MockContext>,
    }

    impl Context {
        pub fn _new(
            sender: Option<Sender<(u64, MessageData)>>,
            inner: Option<MockContext>,
            channel: Option<Channel>,
        ) -> Self {
            let map = ShareMap::custom();

            Self {
                data: Arc::new(RwLock::new(map)),
                shard_id: 0,
                http: Arc::new(http::client::Http::_new(sender, channel)),
                cache: Arc::new(RwLock::new(cache::Cache {
                    user: model::user::CurrentUser {
                        id: 0,
                        name: "TestUser".to_string(),
                    },
                })),
                _inner: inner,
            }
        }

        pub fn set_activity(&self, activity: Activity) {
            // Only for tests, panicking is ok
            self._inner.as_ref().unwrap().set_activity(activity);
        }

        pub fn reset_presence(&self) {
            self._inner.as_ref().unwrap().reset_presence();
        }
    }

    pub mod bridge {
        pub mod gateway {
            use serenity::{client::bridge::gateway::ShardId, prelude::Mutex};
            use std::{collections::HashMap, sync::Arc, time::Duration};

            pub struct ShardRunnerInfo {
                pub latency: Option<Duration>,
            }

            pub struct ShardManager {
                pub runners: Arc<Mutex<HashMap<ShardId, ShardRunnerInfo>>>,
            }

            impl ShardManager {
                pub fn _new(map: HashMap<ShardId, ShardRunnerInfo>) -> Self {
                    Self {
                        runners: Arc::new(Mutex::new(map)),
                    }
                }
            }
        }
    }
}

pub mod cache {
    use super::model::user::CurrentUser;

    pub struct Cache {
        pub user: CurrentUser,
    }
}

pub mod model {
    use super::*;
    use builder::CreateMessage;
    use channel::Message;
    use http::client::Http;

    pub mod user {
        use super::id::UserId;

        pub struct CurrentUser {
            pub id: UserId,
            pub name: String,
        }
    }

    pub mod id {
        use super::*;

        use channel::Channel;

        use std::{fmt::Display, str::FromStr};

        use chrono::{offset::FixedOffset, DateTime};
        use serenity::model::misc::ChannelIdParseError;

        pub type GuildId = u64;
        pub type UserId = u64;

        #[derive(Debug, PartialEq)]
        pub enum MessageData {
            StrMsg(String),
            CreateMessage(CreateMessage),
        }

        // Used to get a ChannelId from a str, not actually used as a type
        mockall::mock! {
            pub ChannelId {
                fn from_str(_s: &str) -> Result<ChannelId, ChannelIdParseError>;
            }
        }

        #[derive(Clone, Copy)]
        pub struct ChannelId(pub u64);

        // Manual mock because we cannot use mockall because closure without 'static are not supported
        impl ChannelId {
            pub fn say(
                self,
                http: &Arc<Http>,
                content: impl Display,
            ) -> Result<Message, serenity::Error> {
                let Self(id) = self;
                (**http)._send(id, MessageData::StrMsg(content.to_string()));

                let guild_id = match self.to_channel(http) {
                    Ok(Channel::Guild(guild)) => Some(guild.read().guild_id),
                    _ => None,
                };

                Ok(Message {
                    id: MessageId::new(),
                    channel_id: self,
                    content: content.to_string(),
                    guild_id,
                })
            }

            pub fn send_message<F>(self, http: &Arc<Http>, f: F) -> Result<Message, serenity::Error>
            where
                for<'b> F: FnOnce(&'b mut CreateMessage) -> &'b mut CreateMessage,
            {
                let mut msg = CreateMessage { _embed: None };
                f(&mut msg);

                let content = format!("{:?}", msg);

                let Self(id) = self;
                (**http)._send(id, MessageData::CreateMessage(msg));

                let guild_id = match self.to_channel(http) {
                    Ok(Channel::Guild(guild)) => Some(guild.read().guild_id),
                    _ => None,
                };

                Ok(Message {
                    id: MessageId::new(),
                    channel_id: self,
                    content,
                    guild_id,
                })
            }

            pub fn to_channel(self, cache_http: &Http) -> Result<Channel, serenity::Error> {
                cache_http._get_channel()
            }
        }

        impl FromStr for ChannelId {
            type Err = ChannelIdParseError;

            fn from_str(s: &str) -> Result<Self, Self::Err> {
                MockChannelId::from_str(s)
            }
        }

        pub use MockMessageId as MessageId;
        mockall::mock! {
            pub MessageId {
                fn created_at(&self) -> DateTime<FixedOffset>;
            }
        }
    }

    pub mod channel {
        use super::id::{ChannelId, GuildId, MessageId};
        use super::Arc;
        use serenity::prelude::RwLock;

        pub struct Group;
        pub struct GuildChannel {
            pub guild_id: GuildId,
        }
        pub struct PrivateChannel;
        pub struct ChannelCategory;

        #[allow(dead_code)]
        #[derive(Clone)]
        pub enum Channel {
            Group(Arc<RwLock<Group>>),
            Guild(Arc<RwLock<GuildChannel>>),
            Private(Arc<RwLock<PrivateChannel>>),
            Category(Arc<RwLock<ChannelCategory>>),
        }

        pub struct Message {
            pub id: MessageId,
            pub channel_id: ChannelId,
            pub content: String,
            pub guild_id: Option<GuildId>,
        }

        impl Message {
            pub fn _new(
                id: MessageId,
                channel_id: u64,
                content: String,
                guild_id: GuildId,
            ) -> Self {
                Self {
                    id,
                    channel_id: ChannelId(channel_id),
                    content,
                    guild_id: Some(guild_id),
                }
            }
        }
    }

    pub mod gateway {
        use super::model::user::CurrentUser;
        pub struct Ready {
            pub user: CurrentUser,
        }
    }

    pub mod event {
        pub struct ResumedEvent {}
    }
}

pub mod http {
    use super::model::{channel::Channel, id::MessageData};

    pub mod client {
        use super::Channel;
        use super::MessageData;
        use std::sync::mpsc::Sender;

        // Sneaky way to old information for manual mocks
        pub struct Http {
            _mock_sender: Option<Sender<(u64, MessageData)>>,
            _mock_channel: Option<Channel>,
        }

        impl Http {
            pub fn _new(
                sender: Option<Sender<(u64, MessageData)>>,
                channel: Option<Channel>,
            ) -> Self {
                Self {
                    _mock_sender: sender,
                    _mock_channel: channel,
                }
            }

            pub fn _send(&self, channel_id: u64, data: MessageData) {
                // Used only for tests so panicking is ok
                self._mock_sender
                    .as_ref()
                    .unwrap()
                    .send((channel_id, data))
                    .unwrap();
            }

            pub fn _get_channel(&self) -> Result<Channel, serenity::Error> {
                self._mock_channel
                    .as_ref()
                    .cloned()
                    .ok_or(serenity::Error::Other("no channel"))
            }
        }
    }
}

pub mod builder {
    use serenity::builder::CreateEmbed;
    use std::collections::HashMap;

    #[derive(Debug)]
    pub struct CreateMessage {
        pub _embed: Option<CreateEmbed>,
    }

    impl std::cmp::PartialEq for CreateMessage {
        fn eq(&self, other: &Self) -> bool {
            match self._embed.as_ref() {
                Some(CreateEmbed(map1)) => {
                    //Other must have a value
                    match other._embed.as_ref() {
                        Some(CreateEmbed(map2)) => map1 == map2,
                        None => false,
                    }
                }
                None => {
                    //Other must also be none
                    other._embed.is_none()
                }
            }
        }
    }

    // Manual mock because we cannot use mockall because closure without 'static are not supported
    impl CreateMessage {
        pub fn embed<F>(&mut self, f: F) -> &mut Self
        where
            for<'b> F: FnOnce(&'b mut CreateEmbed) -> &'b mut CreateEmbed,
        {
            let mut embed = CreateEmbed(HashMap::new());
            f(&mut embed);
            self._embed = Some(embed);
            self
        }
    }
}
