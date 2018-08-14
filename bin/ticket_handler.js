var config = require("../config.js")
var cache = require("./cache.js")
function ticketHandler(bot, ctx) {
        ctx.getChat().then(function (chat) {
            if ((chat.id).toString() === config.staffchat_id) {
                ctx.getChatAdministrators().then(function (admins) { // reply to users ticket
                    admins = JSON.stringify(admins)
                    if (ctx.message.reply_to_message !== undefined && admins.indexOf(ctx.from.id) > -1) {
                        try {
                            var replyText = ctx.message.reply_to_message.text;
                            var replyName = ctx.message.reply_to_message.text;
                            var userid = replyText.match(new RegExp("#" + "(.*)" + " from"))
                            var name = replyText.match(new RegExp("from " + "(.*)" + " @"))
                            if (ctx.message.text === "me") { // accept ticket
                                bot.telegram.sendMessage(config.staffchat_id, "<b>Ticket #" + userid[1] + "</b> was accepted by " + ctx.message.from.first_name + " -> /open", cache.noSound)
                            } else {
                                cache.ticketStatus[userid[1]] = false
                                bot.telegram.sendMessage(userid[1], "Dear <b>" + name[1] + "</b>,\n\n" + ctx.message.text + "\n\nBest regards,\n" + ctx.message.from.first_name, cache.html)
                                console.log("Answer: Ticket #" + cache.tickedID + " Dear " + name[1] + " " + ctx.message.text + " from " + ctx.message.from.first_name)
                            }
                        } catch (e) {}
                    }
                }).catch(function (noAdmin) {
                    console.log("Error with admins: " + noAdmin)
                })
            } else if (chat.type === "private") { // creating ticket
                cache.tickedID = ctx.message.from.id
                if (cache.ticketIDs[cache.ticketID] === undefined) {
                    cache.ticketIDs.push(cache.tickedID)
                }
                cache.ticketStatus[cache.tickedID] = true
                if (cache.ticketSent === false) {
                    console.log("cache.ticketSent false")
                    bot.telegram.sendMessage(chat.id, "Thank you for contacting us. We will answer as soon as possible.")
                    userInfo = ""
                    userInfo += "</b> from " + ctx.message.from.first_name + " "
                    userInfo += "@" + ctx.message.from.username + " Language: " + ctx.message.from.language_code + "\n\n"
                    if (cache.ticketSent === false) {
                        bot.telegram.sendMessage(config.staffchat_id, "<b>Ticket #" + cache.tickedID + userInfo + ctx.message.text, cache.html)
                    } else if (cache.ticketSent === true) {
                        bot.telegram.sendMessage(config.staffchat_id, "<b>Ticket #" + cache.tickedID + userInfo + ctx.message.text, cache.noSound)
                    }
                    console.log("Ticket #" + cache.tickedID + userInfo.replace("\n\n", ": ") + ctx.message.text)
                    if (cache.ticketSent === true) {
                        cache.ticketSent = true
                        setTimeout(function () {
                            cache.ticketSent = false
                        }, 480000) // wait 8 minutes before this message appears again and don"t send notificatoin sounds in that time to avoid spam 
                    }
                } else {
                    userInfo = ""
                    userInfo += "</b> from " + ctx.message.from.first_name + " "
                    userInfo += "@" + ctx.message.from.username + " Language: " + ctx.message.from.language_code + "\n\n"
                    bot.telegram.sendMessage(config.staffchat_id, "<b>Ticket #" + cache.tickedID + userInfo + ctx.message.text, cache.html)
                    console.log("Ticket #" + cache.tickedID + userInfo.replace("\n\n", ": ") + ctx.message.text)
                }
            }
        })
}
module.exports = ticketHandler;