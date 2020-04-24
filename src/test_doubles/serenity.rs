use std::sync::{mpsc::Sender, Arc};

pub mod client {
    use super::*;
    use model::event::ResumedEvent;

    use model::{gateway::Ready, id::MessageData};
    use serenity::prelude::{RwLock, ShareMap};

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

    pub struct Context {
        pub data: Arc<RwLock<ShareMap>>,
        pub shard_id: u64,
        pub http: Arc<http::client::Http>,
        pub cache: Arc<RwLock<super::cache::Cache>>,
    }

    impl Context {
        pub fn _new(sender: Option<Sender<MessageData>>) -> Self {
            let map = ShareMap::custom();

            Self {
                data: Arc::new(RwLock::new(map)),
                shard_id: 0,
                http: Arc::new(http::client::Http::_new(sender)),
                cache: Arc::new(RwLock::new(cache::Cache {
                    user: model::user::CurrentUser {
                        id: 0,
                        name: "TestUser".to_string(),
                    },
                })),
            }
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
        use chrono::{offset::FixedOffset, DateTime};

        pub type UserId = u64;

        #[derive(Debug, PartialEq)]
        pub enum MessageData {
            StrMsg(String),
            CreateMessage(CreateMessage),
        }

        #[derive(Clone, Copy)]
        pub struct ChannelId {}

        // Manual mock because we cannot use mockall because closure without 'static are not supported
        impl ChannelId {
            pub fn say(self, http: &Arc<Http>, content: &str) -> Result<Message, serenity::Error> {
                (**http)._send(MessageData::StrMsg(content.to_string()));

                Ok(Message {
                    id: MessageId::new(),
                    channel_id: self,
                })
            }

            pub fn send_message<F>(self, http: &Arc<Http>, f: F) -> Result<Message, serenity::Error>
            where
                for<'b> F: FnOnce(&'b mut CreateMessage) -> &'b mut CreateMessage,
            {
                let mut msg = CreateMessage { _embed: None };
                f(&mut msg);

                (**http)._send(MessageData::CreateMessage(msg));

                Ok(Message {
                    id: MessageId::new(),
                    channel_id: self,
                })
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
        use super::id::{ChannelId, MessageId};

        pub struct Message {
            pub id: MessageId,
            pub channel_id: ChannelId,
        }

        impl Message {
            pub fn _new(id: MessageId) -> Self {
                Self {
                    id,
                    channel_id: ChannelId {},
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
    use super::model::id::MessageData;

    pub mod client {
        use super::MessageData;
        use std::sync::mpsc::Sender;

        // Sneaky way to old information for manual mocks
        pub struct Http {
            _mock_sender: Option<Sender<MessageData>>,
        }

        impl Http {
            pub fn _new(sender: Option<Sender<MessageData>>) -> Self {
                Self {
                    _mock_sender: sender,
                }
            }

            pub fn _send(&self, data: MessageData) {
                self._mock_sender.as_ref().unwrap().send(data).unwrap();
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
