pub mod test_doubles;

use crate::test_doubles::serenity::{http::client::Http, model::id::MessageData};

use mockall::predicate::{always, eq};

pub fn check_response_msg(http: &mut Http, msg: &str) {
    http.expect_mock_send()
        .with(always(), eq(MessageData::StrMsg(msg.to_string())))
        .return_const(());
    http.expect_mock_get_channel()
        .returning(|| Err(serenity::Error::Other("Not important for test")));
}
