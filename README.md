<h1 align="center">Welcome to Telegram Support Bot 👋</h1>
<h2 align="center">Telegram · Signal · Web chat · AI-assisted</h2>

[![Bot API Version](https://img.shields.io/badge/Bot%20API-v9-f36caf.svg?style=for-the-badge)](https://core.telegram.org/bots/api)
[![NPM Version](https://img.shields.io/npm/v/grammy.svg?style=for-the-badge)](https://www.npmjs.com/package/grammy)
![node](https://img.shields.io/badge/node-%3E%3D24-brightgreen.svg?style=for-the-badge)
![js-google-style](https://img.shields.io/badge/code%20style-google-brightgreen.svg?style=for-the-badge)
[![Documentation](https://img.shields.io/badge/DOCUMENTATION-WIKI-green?style=for-the-badge)](https://github.com/bostrot/telegram-support-bot/wiki)

> TSB is a support bot for Telegram and Signal. Users write to the bot, every message becomes a ticket in your staff group, and staff answer by simply replying.  
> Optional LLM support (OpenAI or any OpenAI-compatible API) answers common questions automatically, triages tickets and drafts translations.

<table>
<tr>
<th><img src="https://i.imgur.com/du5KZ1C.jpg" /></th>
<th><img src="https://i.imgur.com/N2002b0.jpg" /></th>
</tr>
</table>

> 🚀 **Hosted solution**: Get it [here at botspace](https://botspace.bostrot.com)!

## ✨ Features

When a user sends a message to the support bot it creates a ticket which is forwarded to the staff group. Any admin in the staff group can answer that ticket by replying to it. Salutation is added automatically. Photos and files are forwarded too.

**Ticketing**
- [x] File forwarding from and to user
- [x] MongoDB-backed open/closed tickets, reopen, ban/unban, anti-spam
- [x] Categories and sub-categories routed to different staff groups
- [x] Private 1:1 reply tunnel, anonymous tickets / anonymous replies
- [x] Configurable confirmation message, ticket ids shown to users (optional)

**Team collaboration (v5)**
- [x] Assign tickets to staff, priorities (`low`…`urgent`), tags, mute/unmute
- [x] Internal notes that never reach the user (`/note`, or prefix a reply with `!note`)
- [x] Staff roles (`admin`, `supervisor`, `agent`) and `/staff` overview
- [x] Canned responses: define a `key` once, send it with `/key` as a reply
- [x] Escalation rules for unanswered tickets, auto-close of stale tickets, business hours with offline message

**Analytics & integrations (v5)**
- [x] `/stats`, daily summary posted to the staff chat, CSAT rating survey on close
- [x] Webhooks (`ticket.created`, `ticket.replied`, `ticket.closed`, `ticket.banned`, `csat.rated`, `ticket.escalated`) with HMAC signature
- [x] Staff groups on Telegram _or_ Signal; embeddable web chat widget
- [x] Experimental Slack and Discord addons

**AI**
- [x] LLM auto-replies from your own knowledge base (OpenAI or any OpenAI-compatible endpoint, e.g. LiteLLM)
- [x] Conversation memory, AI triage (category, priority, summary, sentiment alerts), translation of staff replies

**Operations**
- [x] Multi-stage Docker image, `docker compose` stack with MongoDB 8 and signal-cli
- [x] `log_level: NONE | ERROR | INFO` writes `config/debug.log`

## 🤖 LLM integration

The bot can connect to OpenAI or any OpenAI-compatible API (LiteLLM, Ollama, vLLM, …) to answer users automatically from a knowledge base you provide. If the knowledge base does not cover a question, the message is forwarded to staff as a normal ticket.

```yaml
use_llm: true # Will enable show_auto_replied when set to true
llm_api_key: 'API_KEY'
llm_base_url: 'https://api.openai.com/v1'
llm_model: 'gpt-4o-mini'
llm_knowledge: >
    Q: What is Botspace?
    A: Botspace is a cloud-based project management tool designed for teams to collaborate, track tasks, and manage workflows efficiently.

    Q: What platforms are supported?
    A: Web, iOS, and Android.

# optional
llm_memory_depth: 10          # previous messages of the ticket sent as context (0 = off)
auto_triage: false            # classify new tickets (category, priority, summary, sentiment)
sentiment_alert_threshold: 2  # alert staff when sentiment score <= this (1-5)
translate_enabled: false      # translate staff replies to translate_target_language
```

> `llm_knowledge` must not be empty — the model is instructed to only answer from it and otherwise stays silent (the bot warns about this at startup).

## 📜 Commands

Staff commands (used in the staff group, mostly as a reply to a ticket):

- `/open` – list open tickets · `/close` – close a ticket · `/reopen` – reopen it · `/clear` – close all tickets
- `/ban` / `/unban` – block or unblock a user
- `/assign <telegram_id>` / `/unassign`, `/priority low|normal|high|urgent`, `/tag <tag>` / `/untag <tag>`, `/mute` / `/unmute`
- `/note <text>` and `/notes` – internal notes (or start a reply with `!note` / `!internal`)
- `/templates` – list canned responses, `/<key>` – send one as a reply
- `/staff` – configured staff and roles · `/stats` – analytics · `/id` – your id and the group id

User commands:

- `/start` – tells the user how to use this bot
- `/help` – overview of the commands
- `/faq` – shows the FAQ
- `/id` – returns your Telegram or Signal id and the group chat id

All texts are configurable in the `language:` section of `config.yaml`. See the [wiki](https://github.com/bostrot/telegram-support-bot/wiki/Commands) for details.

## 📦 Install

See the [wiki](https://github.com/bostrot/telegram-support-bot/wiki/Getting-started) for detailed instructions.

```bash
cp config/config-sample.yaml config/config.yaml   # set bot_token, staffchat_id, owner_id
docker compose up -d
```

The compose stack starts the bot, MongoDB 8, signal-cli and (optionally) mongo-express. Only the bot's web port (`8080`) is published; all other services bind to `127.0.0.1`.

Without Docker: Node.js **24+** and a MongoDB instance are required.

```bash
npm ci
npm run build
npm run prod
```

## 📝 Upgrading from older versions

There are some breaking changes in the new versions. Please read the following instructions carefully when updating.

<details>
<summary>click here to show</summary>

### Upgrading to v5.0.0

- Node.js **24** or newer is required (`engines` in `package.json`).
- `npm run prod` now runs the compiled `build/index.js`; run `npm run build` first (the Docker image does this for you).
- The `docker-compose.yml` uses MongoDB 8 and binds MongoDB, mongo-express and signal-cli to `127.0.0.1`.
- New optional settings: `log_level`, `staff_roles`, `webhooks`, `canned_responses`, `escalation_rules`, `auto_close_after_days`, `enable_csat`, `daily_summary_time`, the `llm_*` advanced settings, `web_chat.business_hours` and the Slack/Discord addons. All are off by default — copy what you need from `config/config-sample.yaml`.
- Language strings: the confirmation sent to users is `language.confirmationMessage`. The old `contactMessage` key is still honoured. All missing strings fall back to built-in defaults.
- The old `ts-node` production path is gone; `fancy-log` output is now mirrored to `config/debug.log` according to `log_level`.

### Upgrading to v4.0.0

Since version v4 this bot uses the grammY Telegram Bot Framework instead of the telegraf framework.

Make sure you add the new settings strings to your config.yaml file. Check the config-sample.yaml for all configs.
Here are some of the new settings that you should add when migrating:

    parse_mode: 'Markdown' # DO NOT CHANGE!
    autoreply: (see config-sample.yaml for an example)

The config-sample.yaml settings now all use markdown instead of HTML so you have to adjust that. e.g. instead of <br/> line break use \n instead. For a full list check the telegram bot API docs.

The old database should work with the new version without changing anything.

### Upgrading to v3.0.0

The latest version uses a new config file in YAML format which would break old versions.

In order to make old versions work with the master you would need to use the new config.yaml file instead of the config.ts file from before. The easiest would be if you copy the config-sample.yaml to config.yaml (both in the config folder) and edit the settings similar to your old config.ts file. There is no need to delete the database file so old tickets can be kept open.

</details>

You might also want to check out the [wiki](https://github.com/bostrot/telegram-support-bot/wiki/Upgrading-the-bot) for more info.

## Author

👤 **Eric Trenkel**

- Website: [erictrenkel.com](https://erictrenkel.com)
- Github: [@bostrot](https://github.com/bostrot)
- LinkedIn: [@erictrenkel](https://linkedin.com/in/erictrenkel)

👥 **Contributors**

[![Contributors](https://contrib.rocks/image?repo=bostrot/telegram-support-bot)](https://github.com/bostrot/telegram-support-bot/graphs/contributors)

## 🤝 Contributing

Contributions, issues and feature requests are welcome!<br />Feel free to check [issues page](https://github.com/bostrot/telegram-support-bot/issues). You can also take a look at the [contributing guide](https://github.com/bostrot/telegram-support-bot/blob/master/CONTRIBUTING.md).

## Show your support

Give a ⭐️ if this project helped you!

## 📝 License

Copyright © 2026 [Eric Trenkel](https://github.com/bostrot).  
This project is [GPL-3.0](https://github.com/bostrot/telegram-support-bot/blob/master/LICENSE) licensed.

---

_Not found what you were looking for? Check out the [Wiki](https://github.com/bostrot/telegram-support-bot/wiki)_

If you need help or need a hosted solution of this check out [Botspace](https://botspace.bostrot.com) for a one-click setup.
