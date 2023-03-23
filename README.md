<h1 align="center">Welcome to Telegram Support Bot 👋</h1>

[![Bot API Version](https://img.shields.io/badge/Bot%20API-v6.6-f36caf.svg?style=for-the-badge)](https://core.telegram.org/bots/api)
[![NPM Version](https://img.shields.io/npm/v/grammy.svg?style=for-the-badge)](https://www.npmjs.com/)
[![node](https://img.shields.io/node/v/grammy.svg?style=for-the-badge)](https://www.npmjs.com/package/)
![js-google-style](https://img.shields.io/badge/code%20style-google-brightgreen.svg?style=for-the-badge)
[![Documentation](https://img.shields.io/badge/DOCUMENTATION-WIKI-green?style=for-the-badge)](https://github.com/bostrot/telegram-support-bot/wiki)

> TSB is a support bot for telegram bots, using the [grammY Framework](https://grammy.dev/). It lets users create tickets which will be send to a staff group and can be answered by a reply.

<table>
<tr>
<th><img src="https://i.imgur.com/du5KZ1C.jpg" /></th>
<th><img src="https://i.imgur.com/N2002b0.jpg" /></th>
</tr>
</table>

> 🚀 **Hosted solution**: Get it [here at botspace](https://botspace.bostrot.com)!

## ✨ Features

When a user sends a message to the support chat it will create a ticket which will be forwarded to the staff group. Any admin in the staff group may answer that ticket by just replying to it. Salutation is added automatically. Photos will be forwared too.

- [x] File forwarding from and to user
- [x] Database for handling open and closed tickets
- [x] Restrict users
- [x] Simple anti spam system
- [x] Send tickets to different staff groups
- [x] Private reply to user
- [x] Anonymize users
- [x] Auto reply based on keywords [beta]
- [x] Web chat [beta]]  

## 📜 Commands

Currently the support chat offers these commands (staff commands):

- `/open` - lists all open tickets (messages where noone has replied yet)
- `/reopen` - reopen a closed ticket
- `/close` - close a ticket manually (in case someone writes 'thank you')
- `/ban` - ban a person from writing to your chat

User commands:

- `/start` - tells the user how to use this bot
- `/help` - an overview over the commands or some explanation for the user
- `/faq` - shows the FAQ
- `/id` - returns your telegram id and the group chat id (1234567 -1234567890)

## 📦 Install

See the [wiki](https://github.com/bostrot/telegram-support-bot/wiki) for more detailed instructions.

```bash
mv config/config-sample.yaml config.yaml
docker-compose up -d
```

## 📝 Upgrading from older versions

There are some breaking changes in the new versions. Please read the following instructions carefully when updating.

<details>
<summary>click here to show</summary>

Since version v4 this bot uses the grammY Telegram Bot Framework instead of the telegraf framework for various reasons.

### Upgrading to v4.0.0

Make sure you add the new settings strings to your config.yaml file. Check the config-sample.yaml for all configs.
Here are some of the new settings that you should add when migrating:

    parse_mode: 'Markdown' # DO NOT CHANGE!
    autoreply: (see config-sample.yaml for an example)

The config-sample.yaml settings now all use markdown instead of HTML so you have to adjust that. e.g. instead of <br/> line break use \n instead. For a full list check the telegram bot API docs.

Upgrade to the new version. e.g. by pulling the main branch from GitHub or using the docker image bostrot/telegram-support-bot:4.0.0.

Start it.

The old database should work with the new version without changing anything.

### Upgrading to v3.0.0

The latest version uses a new config file in YAML format which would break old versions.

In order to make old versions work with the master you would need to use the new config.yaml file instead of the config.ts file from before. The easiest would be if you copy the config-sample.yaml to config.yaml (both in the config folder) and edit the settings similar to your old config.ts file. There is no need to delete the database file so old tickets can be kept open.

</details>

You might also want to check out the [wiki](https://github.com/bostrot/telegram-support-bot/wiki) for more info.

## Author

👤 **Eric Trenkel**

- Website: [erictrenkel.com](erictrenkel.com)
- Github: [@bostrot](https://github.com/bostrot)
- LinkedIn: [@erictrenkel](https://linkedin.com/in/erictrenkel)

👥 **Contributors**

[![Contributors](https://contrib.rocks/image?repo=bostrot/telegram-support-bot)](https://github.com/bostrot/telegram-support-bot/graphs/contributors)

## 🤝 Contributing

Contributions, issues and feature requests are welcome!<br />Feel free to check [issues page](https://github.com/bostrot/telegram-support-bot/issues). You can also take a look at the [contributing guide](https://github.com/bostrot/telegram-support-bot/blob/master/CONTRIBUTING.md).

## Show your support

Give a ⭐️ if this project helped you!

## 📝 License

Copyright © 2023 [Eric Trenkel](https://github.com/bostrot).<br />
This project is [GPL-3.0](https://github.com/bostrot/telegram-support-bot/blob/master/LICENSE) licensed.

---

_Not found what you were looking for? Check out the [Wiki](https://github.com/bostrot/telegram-support-bot/wiki)_

If you need help or need a hosted solution of this check out [Botspace](https://botspace.bostrot.com) for a one-click setup.
