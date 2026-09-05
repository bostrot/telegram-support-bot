import mongoose from 'mongoose';
import cache from './cache';
import { Messenger, TicketPriority } from './interfaces';
import * as log from './logger'

// Lazy config accessors — defer reading cache.config until runtime
// to avoid circular module initialization issues (index → migrate → db → cache)
function getMongoUri(): string {
  return cache.config?.mongodb_uri || process.env.MONGO_URI || 'mongodb://localhost:27017/support';
}

function getBotTokenSuffix(): string {
  return cache.config?.bot_token?.slice(-5) || '';
}

function getCollectionName(): string {
  return `bot_${cache.config?.owner_id}_${getBotTokenSuffix()}`;
}

export interface ISupportee extends mongoose.Document {
  ticketId: number;
  userid: string;
  internalIds: Array<number> | null;
  name: string | null;
  messenger: Messenger;
  status: string;
  category: string | null;
  // Team collaboration fields
  assigned_to: string | null;
  tags: string[];
  priority: TicketPriority;
  // AI triage fields
  triage_category: string | null;
  triage_summary: string | null;
  sentiment_score: number | null;
  // Analytics fields
  first_response_at: Date | null;
  closed_at: Date | null;
}

export const SupporteeSchema = new mongoose.Schema<ISupportee>({
  ticketId: { type: Number, required: true, unique: true, alias: 'id' },
  userid: { type: String, required: true },
  internalIds: { type: [Number], required: false },
  name: { type: String, required: false },
  messenger: { type: String, required: true },
  status: { type: String, default: 'open' },
  category: { type: String, default: null },
  assigned_to: { type: String, default: null },
  tags: { type: [String], default: [] },
  priority: { type: String, enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' as TicketPriority },
  triage_category: { type: String, default: null },
  triage_summary: { type: String, default: null },
  sentiment_score: { type: Number, default: null },
  first_response_at: { type: Date, default: null },
  closed_at: { type: Date, default: null },
});

const Supportee = mongoose.model(getCollectionName(), SupporteeSchema);

export { Supportee };

// --- New collections for team collaboration & analytics ---

export interface ITicketMessage extends mongoose.Document {
  ticketId: number;
  sender: 'user' | 'staff' | 'ai';
  sender_id: string;
  text: string;
  timestamp: Date;
}

const TicketMessageSchema = new mongoose.Schema<ITicketMessage>({
  ticketId: { type: Number, required: true },
  sender: { type: String, enum: ['user', 'staff', 'ai'], required: true },
  sender_id: { type: String, default: '' },
  text: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

const TicketMessage = mongoose.model('TicketMessage', TicketMessageSchema);

export interface IAnalyticsEvent extends mongoose.Document {
  type: string;
  ticketId: number;
  timestamp: Date;
  agent_id: string | null;
  metadata: Record<string, any>;
}

const AnalyticsEventSchema = new mongoose.Schema<IAnalyticsEvent>({
  type: { type: String, required: true },
  ticketId: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now },
  agent_id: { type: String, default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
});

const AnalyticsEvent = mongoose.model('AnalyticsEvent', AnalyticsEventSchema);

export interface IInternalNote extends mongoose.Document {
  ticketId: number;
  author_id: string;
  text: string;
  timestamp: Date;
}

const InternalNoteSchema = new mongoose.Schema<IInternalNote>({
  ticketId: { type: Number, required: true },
  author_id: { type: String, required: true },
  text: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

const InternalNote = mongoose.model('InternalNote', InternalNoteSchema);

export async function connect() {
  mongoose.connection.on('open', () => {
    log.info('Connected to mongo server.');
  });

  mongoose.connection.on('error', (err) => {
    log.info('Could not connect to mongo server!', err);
    process.exit(1);
  });

  const connection = await mongoose.connect(getMongoUri(), {
    serverSelectionTimeoutMS: 5000,
  });

  return connection;
}

/** Methods **/

export const getNextTicketId = async () => {
  const lastEntry = await Supportee.findOne()
    .sort({ ticketId: -1 })
    .select('ticketId');
  const dbMax = lastEntry ? lastEntry.ticketId : 0;
  // Use the higher of DB max or recovery baseline (from chat history scan) to prevent collisions on DB loss
  const baseline = Math.max(dbMax, cache.recoveryBaseline);
  return baseline + 1;
};

export async function check(
  userid: string | number,
  category?: string | null,
): Promise<ISupportee[]> {
  try {
    const query: Record<string, unknown> = {
      $or: [{ userid: String(userid) }, { ticketId: userid }],
    };
    if (category) query.category = category;
    return await Supportee.find(query).lean();
  } catch (err) {
    log.error('DB check error:', err);
    return [];
  }
}

export async function getTicketById(
  ticketId: string | number,
  category: string | null
): Promise<ISupportee | null> {
  const query = {
    $or: [{ ticketId: ticketId }],
    ...(category ? { category } : { category: null }),
  };
  const result = await Supportee.findOne(query);
  return result as ISupportee | null;
};

export async function getTicketByInternalId (
  internalId: number
): Promise<ISupportee | null> {
  const query = {
    internalIds: { $elemMatch: { $eq: internalId } },
  };
  const result = await Supportee.findOne(query);
  return result as ISupportee | null;
}

export async function getTicketByUserId (
  userId: string | number,
  category: string | null
) {
  const query = {
    $or: [{ userid: userId }],
    ...(category ? { category } : { category: null }),
  };
  const result = await Supportee.findOne(query);
  return result;
};

export async function getByTicketId(
  ticketId: string,
): Promise<ISupportee | null> {
  try {
    const query = { $or: [{ ticketId }] };
    return await Supportee.findOne(query) as ISupportee | null;
  } catch (err) {
    log.error('DB getByTicketId error:', err);
    return null;
  }
}

export async function checkBan(
  userid: string | number,
  messenger: string,
): Promise<ISupportee | null> {
  try {
    const query = {
      messenger,
      $or: [{ userid: String(userid) }],
      status: 'banned',
    };
    return await Supportee.findOne(query) as ISupportee | null;
  } catch (err) {
    log.error('DB checkBan error:', err);
    return null;
  }
}

export const closeAll = async () => {
  await Supportee.updateMany({}, { $set: { status: 'closed' } });
};

export const reopen = async (userid: any, category: string, messenger: string) => {
  const query = {
    messenger,
    $or: [{ userid: userid }, { ticketId: userid }],
    ...(category && { category }),
  };
  await Supportee.updateMany(query, { $set: { status: 'open' } });
};

export const addIdAndName = async (
  ticketId: string | number,
  internalId: string,
  name: string | null,
) => {
  if (!internalId) {
    return null;
  }
  const internalIdNum = parseInt(internalId);
  const query = {
    ticketId: ticketId,
  };
  const update = {
    $addToSet: { internalIds: internalIdNum },
    $set: { name },
  };
  return await Supportee.findOneAndUpdate(query, update, {
    new: true,
    upsert: true,
  });
};

export const add = async (
  userid: string | number,
  status: string,
  category: string | number | null,
  messenger: string
) => {
  let result;
  if (status === 'closed') {
    const query = {
      messenger,
      $or: [{ userid: userid }, { ticketId: userid }],
      ...(category && { category }),
    };
    result = await Supportee.updateMany(query, { $set: { status: 'closed' } });
  } else if (status === 'open') {
    let ticketId = await getNextTicketId();
    result = await Supportee.findOneAndReplace(
      { messenger, userid },
      { userid, messenger, ticketId, status, category },
      { upsert: true }
    );
  } else if (status === 'banned') {
    result = await Supportee.findOneAndReplace(
      { messenger, userid },
      {
        userid,
        messenger,
        ticketId: await getNextTicketId(),
        status: 'banned',
        category: 'BANNED',
      },
      { upsert: true }
    );
  }
  const writeResult = result as { modifiedCount?: number } | null | undefined;
  return writeResult?.modifiedCount ?? 0;
};

export async function open(
  category: string[] = [],
): Promise<ISupportee[]> {
  try {
    const query: Record<string, unknown> = {
      status: 'open',
    };
    if (category.length > 0) {
      query.category = { $in: category };
    } else {
      query.category = null;
    }
    return await Supportee.find(query).lean();
  } catch (err) {
    log.error('DB open error:', err);
    return [];
  }
}

// --- Ticket Message methods (conversation memory) ---

export async function addTicketMessage(
  ticketId: number,
  sender: 'user' | 'staff' | 'ai',
  sender_id: string,
  text: string,
): Promise<void> {
  try {
    const msg = new TicketMessage({ ticketId, sender, sender_id, text });
    await msg.save();
    // Keep only last N messages per ticket (configurable)
    const depth = cache.config.llm_memory_depth || 10;
    const excess = await TicketMessage.find({ ticketId })
      .sort({ timestamp: -1 })
      .skip(depth);
    if (excess.length > 0) {
      const ids = excess.map((m) => m._id);
      await TicketMessage.deleteMany({ _id: { $in: ids } });
    }
  } catch (err) {
    log.error('DB addTicketMessage error:', err);
  }
}

export async function getConversationHistory(
  ticketId: number,
  depth?: number,
): Promise<ITicketMessage[]> {
  try {
    const limit = depth || (cache.config.llm_memory_depth ?? 10);
    return await TicketMessage.find({ ticketId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
  } catch (err) {
    log.error('DB getConversationHistory error:', err);
    return [];
  }
}

// --- Analytics Event methods ---

export async function recordAnalyticsEvent(
  type: string,
  ticketId: number,
  agent_id: string | null = null,
  metadata: Record<string, any> = {},
): Promise<void> {
  try {
    const event = new AnalyticsEvent({ type, ticketId, agent_id, metadata });
    await event.save();
  } catch (err) {
    log.error('DB recordAnalyticsEvent error:', err);
  }
}

export async function getAnalyticsEvents(
  type?: string,
  startDate?: Date,
  endDate?: Date,
): Promise<IAnalyticsEvent[]> {
  try {
    const query: Record<string, any> = {};
    if (type) query.type = type;
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = startDate;
      if (endDate) query.timestamp.$lte = endDate;
    }
    return await AnalyticsEvent.find(query).sort({ timestamp: -1 }).lean();
  } catch (err) {
    log.error('DB getAnalyticsEvents error:', err);
    return [];
  }
}

// --- Internal Note methods ---

export async function addInternalNote(
  ticketId: number,
  author_id: string,
  text: string,
): Promise<void> {
  try {
    const note = new InternalNote({ ticketId, author_id, text });
    await note.save();
  } catch (err) {
    log.error('DB addInternalNote error:', err);
  }
}

export async function getInternalNotes(
  ticketId: number,
): Promise<IInternalNote[]> {
  try {
    return await InternalNote.find({ ticketId })
      .sort({ timestamp: -1 })
      .lean();
  } catch (err) {
    log.error('DB getInternalNotes error:', err);
    return [];
  }
}

// --- Ticket assignment methods ---

export async function assignTicket(
  ticketId: number,
  agent_telegram_id: string,
): Promise<void> {
  try {
    await Supportee.findOneAndUpdate(
      { ticketId },
      { $set: { assigned_to: agent_telegram_id } },
    );
  } catch (err) {
    log.error('DB assignTicket error:', err);
  }
}

export async function unassignTicket(ticketId: number): Promise<void> {
  try {
    await Supportee.findOneAndUpdate(
      { ticketId },
      { $set: { assigned_to: null } },
    );
  } catch (err) {
    log.error('DB unassignTicket error:', err);
  }
}

// --- Tag methods ---

export async function addTags(ticketId: number, tags: string[]): Promise<void> {
  try {
    await Supportee.findOneAndUpdate(
      { ticketId },
      { $addToSet: { tags: { $each: tags } } },
    );
  } catch (err) {
    log.error('DB addTags error:', err);
  }
}

export async function removeTag(ticketId: number, tag: string): Promise<void> {
  try {
    await Supportee.findOneAndUpdate(
      { ticketId },
      { $pull: { tags: tag } },
    );
  } catch (err) {
    log.error('DB removeTag error:', err);
  }
}

// --- Priority methods ---

export async function setPriority(
  ticketId: number,
  priority: TicketPriority,
): Promise<void> {
  try {
    await Supportee.findOneAndUpdate(
      { ticketId },
      { $set: { priority } },
    );
  } catch (err) {
    log.error('DB setPriority error:', err);
  }
}

// --- Triage methods ---

export async function setTriageInfo(
  ticketId: number,
  category: string | null,
  summary: string | null,
  sentimentScore: number | null,
): Promise<void> {
  try {
    await Supportee.findOneAndUpdate(
      { ticketId },
      { $set: { triage_category: category, triage_summary: summary, sentiment_score: sentimentScore } },
    );
  } catch (err) {
    log.error('DB setTriageInfo error:', err);
  }
}

// --- Analytics timestamp methods ---

export async function setFirstResponseAt(ticketId: number): Promise<void> {
  try {
    await Supportee.findOneAndUpdate(
      { ticketId, first_response_at: null },
      { $set: { first_response_at: new Date() } },
    );
  } catch (err) {
    log.error('DB setFirstResponseAt error:', err);
  }
}

export async function setClosedAt(ticketId: number): Promise<void> {
  try {
    await Supportee.findOneAndUpdate(
      { ticketId },
      { $set: { closed_at: new Date() } },
    );
  } catch (err) {
    log.error('DB setClosedAt error:', err);
  }
}

// --- Open tickets with tag filter ---

export async function openByTag(
  tag: string,
  category: string[] = [],
): Promise<ISupportee[]> {
  try {
    const query: Record<string, unknown> = {
      status: 'open',
      tags: tag,
    };
    if (category.length > 0) {
      query.category = { $in: category };
    } else {
      query.category = null;
    }
    return await Supportee.find(query).lean();
  } catch (err) {
    log.error('DB openByTag error:', err);
    return [];
  }
}

// --- CSAT methods ---

export async function recordCSAT(
  ticketId: number,
  rating: number,
  comment: string = '',
): Promise<void> {
  await recordAnalyticsEvent('csat.rated', ticketId, null, { rating, comment });
}

// --- Export models for use in other modules ---

export { TicketMessage, AnalyticsEvent, InternalNote };
