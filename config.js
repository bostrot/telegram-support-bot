module.exports = {
  // bot settings
  bot_token: 'YOUR_BOT_TOKEN', // support bot token
  staffchat_id: 'SUPERGROUP_CHAT_ID', // eg. -123456789
  owner_id: 'YOUR_TELEGRAM_ID',
  supported_bot: 'service_name', // service name of the supported bot
  spam_time: 5 * 60 * 1000, // time (in MS) in which user may send 5 messages

  // customize your language
  startCommandText: 'Welcome in our support chat! Ask your question here.',
  faqCommandText: 'Check out our FAQ here: Address to your FAQ',
  lang_contactMessage:
    `Thank you for contacting us. We will answer as soon as possible.`,
  lang_blockedSpam:
    `You sent quite a number of questions in the last while. 
    Please calm down and wait until staff reviews them.`,
  lang_ticket: 'Ticket',
  lang_acceptedBy: 'was accepted by',
  lang_dear: 'Dear',
  lang_regards: 'Best regards,',
  lang_from: 'from',
  lang_language: 'Language',
};
