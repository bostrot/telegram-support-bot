# Improvement log

One line per daily improvement run: `- <date> · <area> · <change> · <PR>`.

- 2026-11-20 · Operator experience · Clear startup error for a missing or invalid `config/config.yaml`, and a warning when no messenger is enabled · https://github.com/bostrot/telegram-support-bot/pull/224

## Lessons from reviews

- No `daily-improvement` PRs reviewed yet (first run, 2026-11-20).

## Ideas backlog

- **Validate common config values at startup** (operator): warn when `staffchat_id`/`owner_id` are still the sample placeholders (`SUPERGROUP_CHAT_ID`, `YOUR_TELEGRAM_ID`), when `daily_summary_time` is not `HH:MM` (it is split on `:` in `src/index.ts` and an invalid value yields `NaN` delays, which `setTimeout` treats as ~1 ms, so the daily summary may be re-sent in a tight loop — reproduce first, this may be a bug fix on its own), or when `spam_time` is not a number (issue #161 shows `spam_time: 5 * 60 * 1000`, which YAML reads as a string). Where: `src/cache.ts` after defaults are applied.
- **Bot API `setMyCommands` per scope** (staff/end user): register user commands for private chats and staff commands for the staff chat so Telegram's `/` menu shows the right list. Where: `src/addons/telegram/index.ts` start-up. Open question: interaction with `user_commands` and language.
- **Startup check that the bot is in the staff chat** (operator): call `getChat(staffchat_id)` once on start and log a clear error if it fails (wrong id, bot not added, group upgraded to supergroup — cf. closed issue #16). Open question: Telegram only; Signal/Slack/Discord equivalents.
