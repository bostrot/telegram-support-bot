const Telegraf = require("telegraf") // thanks for the great framwork! @dotcypress
const {
  Extra, Markup
} = Telegraf

/* edit below */
const bot = new Telegraf("BOT_TOKEN_SUPPORT_BOT") // support bot
var staff_chat = "SUPPORT_STAFF_GROUP_ID" // telegram staff group chat id
var owner_id = "OWNER_ID" // telgram owner id
var supported_bot = "service_name" // service name of the supported bot
var startCommandText = "Welcome in our support chat! Ask your question here."
var faqCommandText = "Check out our FAQ here: Address to your FAQ"
/* edit end */

var ticketID
var ticketIDs = []
var ticketSent = false
var cron = require("cron");
var userInfo = ""
var mysql = require("mysql")
var ticketStatus = {}
var exec = require("child_process").exec
var cronJob

const html = Extra.HTML()
const noSound = Extra.HTML().notifications(false)

const root = Extra.HTML().markup((m => // inline keyboard for admin dashboard
  m.inlineKeyboard([
    m.callbackButton("🔄 Update", "update"),
    m.callbackButton("📖 Log", "log"),
    m.callbackButton("♻️ Restart", "restart"),
    m.callbackButton("🚫 Stop", "stop")
  ])))

bot.action("restart", (ctx) => { // restart other bot
  if (ctx.from.id === owner_id) {
    var list = ""
    ex("service " + supported_bot + " restart", function(results) {
      setTimeout(function() {
        ex("service " + supported_bot + " status", function(results) {
          if (cronJob !== undefined) {
            status = cronJob.running
          }
          ctx.editMessageText("Current status:\n" + results + "\nCron running: restart", root)
        })
      }, 2000)
    })
    if (cronJob !== undefined) {
      if (cronJob.running === false) {
        cronJob.start()
      }
    }
  }
})
bot.action("log", (ctx) => { // send other bots log
  if (ctx.from.id === owner_id) {
    ex("journalctl -u " + supported_bot + " -b > /logs/log.txt", function(results) {
      ctx.replyWithDocument({
        source: "/logs/log.txt"
      })
    })
  }
})
bot.action("update", (ctx) => { // update admin dasboard"s status
  if (ctx.from.id === owner_id) {
    var list = ""
    var status
    ex("service " + supported_bot + " status", function(results) {
      if (cronJob !== undefined) {
        status = cronJob.running
      }
      ctx.editMessageText("Current status:\n" + results + "\nCron running: " + status, root)
    })
  }
})
bot.action("stop", (ctx) => { // stop the bot
  if (ctx.from.id === owner_id) {
    ex("service " + supported_bot + " stop", function(results) {
      ctx.editMessageText("Bitgram stopped", root)
    })
    if (cronJob !== undefined) {
      if (cronJob.running === true) {
        cronJob.stop()
      }
    }
  }
})

var cronSession = function(ctx) { // check every 5 seconds if other bot is down, if it"s inactive restart it
  console.log("Session started.\n")
  cronJob = cron.job("*/5 * * * * *", function() { // 5 seconds
    ex("systemctl is-active " + supported_bot + "", function(results) {
      if (results.indexOf("failed") > -1) { // restart on failed
        ex("journalctl -u " + supported_bot + " -b > /var/www/html/" + supported_bot + "/logs/log.txt", function(results) {
          ctx.replyWithDocument({
            source: "/var/www/html/" + supported_bot + "/logs/log.txt"
          })
        })
        ex("service " + supported_bot + " start", function(results) {
          bot.telegram.sendMessage(staff_chat, "Restarted bot. See log.", html)
        })
      }
      if (results.indexOf("inactive") > -1) { // restart on inactive
        ex("journalctl -u " + supported_bot + " -b > /var/www/html/" + supported_bot + "/logs/log.txt", function(results) {
          ctx.replyWithDocument({
            source: "/var/www/html/" + supported_bot + "/logs/log.txt"
          })
        })
        ex("service " + supported_bot + " start", function(results) {
          bot.telegram.sendMessage(staff_chat, "Restarted bot. See log.", html)
        })
      }
      results = null
    })
  }, function() {
    bot.telegram.sendMessage(staff_chat, "Stopped cron job.", html)
  })
  cronJob.start()
}

var ex = function execute(command, callback) { // execute command
  exec(command, function(error, stdout, stderr) {
    callback(stdout)
  })
}

bot.command("start", ({ // on start reply with chat bot rules
  reply, from, chat
}) => {
  reply(startCommandText, html)
})

bot.command("faq", (ctx) => { // faq
  ctx.reply(faqCommandText)
})

bot.command("root", (ctx) => { // admin dashboard can only be used by owner
  if (ctx.from.id === owner_id) {
    bot.telegram.sendMessage(staff_chat, "You will receive the logs when the bot crashes.", root)
    cronSession(ctx)
  }
})

bot.telegram.getMe().then((botInfo) => { // enable for groups (get own username)
  bot.options.username = botInfo.username
})

const downloadPhotoMiddleware = (ctx, next) => { // download photos
  return bot.telegram.getFileLink(ctx.message.photo[0])
    .then((link) => {
      ctx.state.fileLink = link
      return next()
    })
}

bot.command("open", (ctx) => { // display open tickets
  ctx.getChat().then(function(chat) {
    if (chat.id === staff_chat) {
      ctx.getChatAdministrators().then(function(admins) {
        admins = JSON.stringify(admins)
        if (admins.indexOf(ctx.from.id) > -1) {
          var openTickets = ""
          for (var i in ticketIDs) {
            if (ticketStatus[ticketIDs[i]] === true) {
              if (openTickets.indexOf(ticketIDs[i]) === -1) {
                openTickets += "<code>#" + ticketIDs[i] + "</code>\n"
              }
            }
          }
          setTimeout(function() {
            ctx.reply("<b>Open Tickets:\n\n</b>" + openTickets, noSound)
          }, 10)
        }
      })
    }
  })
})

bot.command("close", (ctx) => { // close ticket
  ctx.getChat().then(function(chat) {
    if (chat.id === staff_chat) {
      ctx.getChatAdministrators().then(function(admins) {
        admins = JSON.stringify(admins)
        if (ctx.message.reply_to_message !== undefined && admins.indexOf(ctx.from.id) > -1) {
          var replyText = ctx.message.reply_to_message.text;
          var userid = replyText.match(new RegExp("#" + "(.*)" + " from"))
          ticketStatus[userid[1]] = false
        }
      })
    }
  })
})

bot.on("photo", downloadPhotoMiddleware, (ctx, next) => { // send any received photos to staff group
  ctx.getChat().then(function(chat) {
    if (chat.type === "private") {
      ticketID = ctx.message.from.id
      userInfo = ""
      userInfo += "</b> from " + ctx.message.from.first_name + " "
      userInfo += "@" + ctx.message.from.username + " Language: " + ctx.message.from.language_code + "\n\n"
      bot.telegram.sendMessage(staff_chat, "<b>Ticket #" + ticketID + userInfo + "see photo below.", noSound)
      bot.telegram.sendPhoto(staff_chat, ctx.message.photo[0].file_id)
    }
  })
})

bot.hears(/(.+)/, (ctx) => { // creates a ticket for users and let group admins in staff_chat reply to those
  ctx.getChat().then(function(chat) {
    if (chat.id === staff_chat) {
      ctx.getChatAdministrators().then(function(admins) { // reply to users ticket
        admins = JSON.stringify(admins)
        if (ctx.message.reply_to_message !== undefined && admins.indexOf(ctx.from.id) > -1) {
          try {
            var replyText = ctx.message.reply_to_message.text;
            var replyName = ctx.message.reply_to_message.text;
            var userid = replyText.match(new RegExp("#" + "(.*)" + " from"))
            var name = replyText.match(new RegExp("from " + "(.*)" + " @"))
            if (ctx.message.text === "me") { // accept ticket
              bot.telegram.sendMessage(staff_chat, "<b>Ticket #" + userid[1] + "</b> was accepted by " + ctx.message.from.first_name + " -> /open", noSound)
            } else {
              ticketStatus[userid[1]] = false
              bot.telegram.sendMessage(userid[1], "Dear <b>" + name[1] + "</b>,\n\n" + ctx.message.text + "\n\nBest regards,\n" + ctx.message.from.first_name, html)
              console.log("Answer: Ticket #" + ticketID + " Dear " + name[1] + " " + ctx.message.text + " from " + ctx.message.from.first_name)
            }
          } catch (e) {}
        }
      }).catch(function(noAdmin) {

      })
    } else if (chat.type === "private") { // creating ticket
      ticketID = ctx.message.from.id
      if (ticketIDs[ticketID] === undefined) {
        ticketIDs.push(ticketID)
      }
      ticketStatus[ticketID] = true
      if (ticketSent === false) {
        ctx.reply("Thank you for contacting us. We will answer as soon as possible.")
        userInfo = ""
        userInfo += "</b> from " + ctx.message.from.first_name + " "
        userInfo += "@" + ctx.message.from.username + " Language: " + ctx.message.from.language_code + "\n\n"
        if (ticketSent === false) {
          bot.telegram.sendMessage(staff_chat, "<b>Ticket #" + ticketID + userInfo + ctx.message.text, html)
        } else if (ticketSent === true) {
          bot.telegram.sendMessage(staff_chat, "<b>Ticket #" + ticketID + userInfo + ctx.message.text, noSound)
        }
        console.log("Ticket #" + ticketID + userInfo.replace("\n\n", ": ") + ctx.message.text) 
		if (ticketSent === true) {
			ticketSent = true
			setTimeout(function() {
				ticketSent = false
			  }, 480000) // wait 8 minutes before this message appears again and don"t send notificatoin sounds in that time to avoid spam 
		}
      } else {
        userInfo = ""
        userInfo += "</b> from " + ctx.message.from.first_name + " "
        userInfo += "@" + ctx.message.from.username + " Language: " + ctx.message.from.language_code + "\n\n"
        bot.telegram.sendMessage(staff_chat, "<b>Ticket #" + ticketID + userInfo + ctx.message.text, html)
        console.log("Ticket #" + ticketID + userInfo.replace("\n\n", ": ") + ctx.message.text)
      }
    }
  })
})
bot.startPolling()