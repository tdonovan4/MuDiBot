ping-msg = Pong! *Ping received after { $ping } ms.*
ping-msg-heartbeat = { ping-msg } *Current shard heartbeat ping of { $heartbeat } ms.*

info-uptime = { $days }d:{ $hours }h:{ $mins }m:{ $secs }s⁩
info-embed = __**~Info~**__
    .general-title = **General**
    .general-body = **Name:** MuDiBot
                {"**"}Description:** A multipurpose Discord bot (MuDiBot) made using serenity
                {"**"}Author:** Thomas Donovan (tdonovan4)
                {"**"}Version:** { $version }
                {"**"}Uptime:** { $uptime }
    .config-title = **Config**
    .config-body = **Language:** { $langid }
    .footer = Client ID: { $id }

set-activity-some = Activity successfully modified!
set-activity-none = Activity successfully removed!