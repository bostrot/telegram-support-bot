import { Language } from './interfaces';

// Default language strings — used when config doesn't provide them
export const defaultLanguage: Partial<Language> = {
  startCommandText: '/start - Start the bot',
  faqCommandText: '/faq - Frequently Asked Questions',
  helpCommandText: '/help - Get help',
  confirmationMessage: 'Your message has been sent. We will get back to you as soon as possible.',
  contactMessage: '',
  blockedSpam: 'You are blocked due to spam.',
  ticket: 'Ticket',
  closed: 'Closed',
  acceptedBy: 'Accepted by',
  dear: 'Dear',
  regards: 'Regards',
  from: 'from',
  language: 'Language',
  msg_sent: 'Message sent!',
  file_sent: 'File sent!',
  usr_with_ticket: 'User with ticket',
  banned: 'Banned',
  replyPrivate: 'Reply in private chat',
  services: 'Services',
  customer: 'Customer',
  msgForwarding: 'Message forwarding',
  back: 'Back',
  whatSubCategory: 'What sub-category?',
  prvChatEnded: 'Private chat ended.',
  prvChatOpened: 'Private chat opened.',
  prvChatEnd: 'End private chat',
  prvChatOpenedCustomer: 'Staff has opened a private chat with you.',
  instructionsSent: 'Instructions sent!',
  openTickets: 'Open Tickets',
  support: 'Support',
  prvChatOnly: 'Private chat only',
  ticketClosed: 'Ticket closed',
  links: 'Links',
  textFirst: 'Please send a text message first.',
  ticketClosedError: 'This ticket is closed. Please open a new one.',
  automatedReply: 'Automated Reply',
  automatedReplyAuthor: 'Support Team',
  doesntHelp: "That doesn't help",
  automatedReplySent: 'An automated reply has been sent.',
  ticketReopened: 'Ticket reopened!',
  yourTicketId: 'Your Ticket ID',
  helpCommandStaffText: '/help - Staff commands reference',
  regardsGroup: 'Regards, Support Team',
  csatRatingRequest: 'Please rate your support experience (1-5):',
  csatThankYou: 'Thank you for your feedback!',
  triagePriority: 'Priority',
  triageSummary: 'Triage Summary',
  sentimentAlert: 'Sentiment Alert',
  ticketAssignedTo: 'Ticket assigned to',
  ticketUnassigned: 'Ticket unassigned',
  assignedBy: 'Assigned by',
  internalNote: 'Internal Note',
  noteAddedBy: 'Note added by',
  offlineMessage: "We're currently offline. We'll get back to you when we're available.",
  businessHoursClosed: 'Our support hours are from {start} to {end}.',
  escalationNotify: 'This ticket has been escalated.',
  replied: 'replied',
  ticketDetails: 'Ticket details',
  editedMessage: 'edited their message',
  broadcastSent: 'Broadcast sent to',
  closedByUser: 'closed by the user',
};

/**
 * Merges the user's language block over the defaults so every string is defined,
 * even when the config has no language block at all.
 * Older configs customised the confirmation text via the legacy contactMessage key.
 */
export function mergeLanguage(userLanguage: unknown): Language {
  const user: Partial<Language> =
    userLanguage && typeof userLanguage === 'object' ? { ...(userLanguage as Partial<Language>) } : {};
  if (!user.confirmationMessage && user.contactMessage) {
    user.confirmationMessage = user.contactMessage;
  }
  return { ...defaultLanguage, ...user } as unknown as Language;
}
