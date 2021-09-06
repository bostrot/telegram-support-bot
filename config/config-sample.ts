const config = {
  // bot settings
  bot_token: 'YOUR_BOT_TOKEN', // support bot token
  staffchat_id: 'SUPERGROUP_CHAT_ID', // eg. -123456789
  owner_id: 'YOUR_TELEGRAM_ID',
  spam_time: 5 * 60 * 1000, // time (in MS) in which user may send 5 messages
  allow_private: false, // Allow / disallow option for staff to chat privately
  auto_close_tickets: true,
  direct_reply: false,
  anonymous_tickets: true, //Include userid in tickets or not
  web_server: true, // Enable/disable web server
  web_server_port: 8080, // Port for web server

  // customize your language
  language: {
    startCommandText: 'Welcome in our support chat! Ask your question here.',
    faqCommandText: 'Get this bot at: <a href=\'https://github.com/bostrot/telegram-support-bot\'>github.com</a>',
    helpCommandText: '<b>Available commands:</b>\n/help\n/faq\n/id',
    contactMessage: 'Thank you for contacting us. We will answer as soon as possible.',
    blockedSpam: 'You sent quite a number of questions in the last while. Please calm down and wait until staff reviews them.',
    ticket: 'Ticket',
    closed: 'closed',
    acceptedBy: 'was accepted by',
    dear: 'Dear',
    regards: 'Best regards,',
    from: 'from',
    language: 'Language',
    msg_sent: 'Message sent to user',
    file_sent: 'File sent to user',
    usr_with_ticket: 'User with ticket',
    banned: 'banned',
    replyPrivate: 'Reply in private',
    services: 'Select a service from the list below',
    customer: 'customer',
    msgForwarding: 'You messages will now be forwarded to vendors of the group: ',
    back: 'Go back',
    whatSubCategory: 'Which subcategory describes your needs the best? ',
    prvChatEnded: 'Private chat ended.',
    prvChatOpened: 'Private Chat opened with customer.',
    prvChatEnd: 'End Private chat',
    prvChatOpenedCustomer: 'Opened private chat',
    instructionsSent: 'Instructions were sent to you in private chat.',
    openTickets: 'Open Tickets',
    support: 'Support',
    prvChatOnly: 'This command can be used in private chat only.',
    ticketClosed: 'Your ticket was closed by our staff. You can open a new ticket at any time.',
    links: 'Direct support links',
    textFirst: 'Please send us a message before sending an image so that we can help you better.',
    ticketClosedError: 'You cannot reply to a closed ticket.',
    automatedReply: 'This is an automated reply.',
    automatedReplyAuthor: 'BottyBot.',
    doesntHelp: 'This does not help.',
    automatedReplySent: 'Automated reply was send to the user.',
  },

  categories: [],
  /* <==== Remove this line if you want categories ====>
  categories:
    [
      {
        name: 'Category1', subgroups: [
          {name: 'Sub1', group_id: '-12345678910'},
          {name: 'Sub2', group_id: '-12345678910'},
          {name: 'Sub3', group_id: '-12345678910'},
        ],
      },
      {
        name: 'Category2', subgroups: [
          {name: 'Sub4', group_id: '-12345678910'},
          {name: 'Sub5', group_id: '-12345678910'},
          {name: 'Sub6', group_id: '-12345678910'},
        ],
      },
      {
        name: 'Category with no subcategories', group_id: '-12345678910'
      },
      {
        name: 'Admin Chat', group_id: '-12345678910' 
      },
      {
        name: 'Contact', msg: 'Check out our Website'
      },
    ],
   /* <==== Remove this line if you want categories ====> */
};

export default config;
  
