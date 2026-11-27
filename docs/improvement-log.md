# Improvement log

One line per daily improvement run: `- <date> · <area> · <change> · <PR>`.

- 2026-11-20 · Operator experience · Clear startup error for a missing or invalid `config/config.yaml`, and a warning when no messenger is enabled · https://github.com/bostrot/telegram-support-bot/pull/224
- 2026-11-23 · Bug fix · An invalid `daily_summary_time` no longer sends the daily summary to the staff chat in a loop or breaks startup; it falls back to 09:00 with a clear log error · https://github.com/bostrot/telegram-support-bot/pull/225
- 2026-11-24 · Staff experience · Optional `register_commands` fills Telegram's `/` menu with user commands in private chats and staff commands (incl. canned responses) in the staff chat · https://github.com/bostrot/telegram-support-bot/pull/226
- 2026-11-25 · Operator experience · Startup warnings for sample `staffchat_id`/`owner_id` placeholders and unusable `spam_time`/`spam_cant_msg` values (fallback to 300000/5); a missing `spam_cant_msg` no longer silently drops a user's follow-up messages · https://github.com/bostrot/telegram-support-bot/pull/227
- 2026-11-27 · End-user experience · Voice notes, audio files and round video messages from users reach the staff chat (and staff can answer with them) instead of being dropped without any reply · https://github.com/bostrot/telegram-support-bot/pull/229

## Lessons from reviews

- No `daily-improvement` PRs reviewed yet (first run, 2026-11-20).
- 2026-11-23: #224 (config load errors) was merged without review comments. Small, focused operator-facing fixes with tests are accepted.
- 2026-11-24: #225 (daily summary fallback) merged without review comments.
- 2026-11-25: #226 (command menu) merged without review comments; no `daily-improvement` PR has been closed unmerged so far.
- 2026-11-27: #227 (startup config warnings) merged without review comments; #228 (case-insensitive auto-replies) still open with no review yet. Still no PR closed unmerged.

## Ideas backlog

- **Startup check that the bot is in the staff chat** (operator): call `getChat(staffchat_id)` once on start and log a clear error if it fails (wrong id, bot not added, group upgraded to supergroup — cf. closed issue #16). Open question: Telegram only; Signal/Slack/Discord equivalents.
- **Daily summary time zone** (operator): `daily_summary_time` is interpreted in the server's local time zone, while the docs used to say UTC (UTC only inside the Docker image, which sets no `TZ`). Options: an optional `daily_summary_timezone` (IANA name, default = server zone) or document `TZ` in `docker-compose.yml`. Where: `src/dailysummary.ts`. Open question: whether to keep the old behaviour as default (yes, per the rules).
- **Way to turn the daily summary off** (operator/staff): today an empty `daily_summary_time` falls back to 09:00, so the summary cannot be disabled. A value like `off`/`false` could skip scheduling. Where: `src/dailysummary.ts`, `config/config-sample.yaml`.
- **Bot API date-time entities** (staff): Bot API 9.5 added date/time formatting entities (https://core.telegram.org/bots/api-changelog), which would let ticket timestamps in the staff chat show in each staff member's own time zone. Check grammY support first.
- **Command menu follow-ups** (staff/end user, after `register_commands`): register the staff menu in category `group_id` chats too (one `chat` scope per group, tolerate failures per group), and localised descriptions via `setMyCommands(..., { language_code })` from a new `language` key. Where: `src/commandmenu.ts`, `src/addons/telegram/index.ts`.
- **Check other numeric settings at startup** (operator): extend `checkConfigValues` in `src/configfile.ts` to `auto_close_after_days`, `llm_memory_depth`, `web_server_port`, `sentiment_alert_threshold` (same fallback-with-warning pattern).
- **Voice/audio for Signal, Slack and Discord** (addon parity): Signal voice notes arrive as `audio/aac` attachments; check how `src/addons/signal/mapper.ts` maps them today and whether staff can play them. Discord/Slack upload audio as plain files, which already go through the document path.
- **Location and contact messages** (end user): a user sharing a location or contact card in Telegram is still dropped silently. Forward them as text (`📍 lat, long` link / contact name + number) — careful: a phone number is personal data, so the forwarded text must stay within the staff chat like the rest of the ticket.
- **Tell users when a message type can't be forwarded** (end user): polls, dice, games and similar messages are still ignored silently; a short `language` text (e.g. "Please send text, photos or files") would stop users waiting for an answer that cannot come.
