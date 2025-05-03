import mongoose from 'mongoose';
import cache from './cache';
import { Messenger } from './interfaces';
import * as log from 'fancy-log';

const MONGO_URI = cache.config.mongodb_uri || process.env.MONGO_URI || 'mongodb://localhost:27017/support';
const botTokenSuffix = cache.config.bot_token.slice(-5);
const collectionName = `bot_${cache.config.owner_id}_${botTokenSuffix}`;
const collectionNameMessages = `messages_${cache.config.owner_id}_${botTokenSuffix}`;

export interface ISupportee extends mongoose.Document {
  ticketId: number;
  userid: string;
  internalIds: Array<number> | null;
  name: string | null;
  messenger: Messenger;
  status: string;
  category: string | null;
}

export interface IMessage extends mongoose.Document {
  ticketId: number;
  userId: string;
  name: string | null;
  messageId: number;
  messenger: Messenger;
  message: string;
  date: Date;
  type: 'staff' | 'user';
}

export type IMessageData = {
  ticketId: number;
  userId: string;
  name: string | null;
  messageId: number;
  messenger: Messenger;
  message: string;
  date: Date;
  type: 'staff' | 'user';
};

export const SupporteeSchema = new mongoose.Schema<ISupportee>({
  ticketId: { type: Number, required: true, unique: true, alias: 'id' },
  userid: { type: String, required: true },
  internalIds: { type: [Number], required: false },
  name: { type: String, required: false },
  messenger: { type: String, required: true },
  status: { type: String, default: 'open' },
  category: { type: String, default: null },
});

export const MessageSchema = new mongoose.Schema<IMessage>({
  ticketId: { type: Number, required: true },
  userId: { type: String, required: true },
  name: { type: String, required: false },
  messageId: { type: Number, required: true },
  messenger: { type: String, required: true },
  message: { type: String, required: true },
  date: { type: Date, default: Date.now },
  type: { type: String, enum: ['staff', 'user'], required: true },
});

const Supportee = mongoose.model(collectionName, SupporteeSchema);
const Message = mongoose.model(collectionNameMessages, MessageSchema);

export async function connect() {
  mongoose.connection.on('open', () => {
    log.info('Connected to mongo server.');
  });

  mongoose.connection.on('error', (err) => {
    log.info('Could not connect to mongo server!', err);
    process.exit(1);
  });

  const connection = await mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
  });

  return connection;
}

/** Supportee Methods **/

export const getNextTicketId = async () => {
  const lastEntry = await Supportee.findOne()
    .sort({ ticketId: -1 })
    .select('ticketId');
  return lastEntry ? lastEntry.ticketId + 1 : 1;
};

export const check = async (
  userid: any,
  category: any,
  callback: (result: any) => void
) => {
  const query = {
    $or: [{ userid: userid }, { ticketId: userid }],
    ...(category && { category }),
  };
  const result = await Supportee.find(query);
  callback(result);
};

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

export async function getTicketByInternalId(
  internalId: number
): Promise<ISupportee | null> {
  const query = {
    internalIds: { $elemMatch: { $eq: internalId } },
  };
  const result = await Supportee.findOne(query);
  return result as ISupportee | null;
}

export async function getTicketByUserId(
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

export const getByTicketId = async (
  ticketId: string,
  callback: (ticket: any) => void
) => {
  const query = { $or: [{ ticketId: ticketId }] };
  const result = await Supportee.findOne(query);
  callback(result);
};

export const checkBan = async (
  userid: any,
  messenger: string,
  callback: (ticket: any) => void
) => {
  const query = {
    messenger,
    $or: [{ userid: userid }],
    status: 'banned',
  };
  const result = await Supportee.findOne(query);
  callback(result);
};

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
  if (!internalId) return null;
  const internalIdNum = parseInt(internalId);
  const query = { ticketId: ticketId };
  const update = {
    $addToSet: { internalIds: internalIdNum },
    $set: { name },
  };
  return await Supportee.findOneAndUpdate(query, update, { new: true, upsert: true });
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
  return result?.modifiedCount || 0;
};

export const open = async (
  callback: Function,
  category: string[],
) => {
  const query = {
    status: 'open',
    ...(category.length > 0
      ? { category: { $in: category } }
      : { category: null }),
  };
  const result = await Supportee.find(query);
  callback(result);
};

/** Message Methods **/

export const addMessage = async (msg: IMessageData) => {
  const message = new Message(msg);
  return await message.save();
};

export const getMessagesByTicketId = async (ticketId: number) => {
  return await Message.find({ ticketId }).sort({ date: 1 });
};

export const getMessagesByUserId = async (userId: string) => {
  return await Message.find({ userId }).sort({ date: 1 });
};

export const deleteMessagesByTicketId = async (ticketId: number) => {
  return await Message.deleteMany({ ticketId });
};

export const getLastMessage = async (ticketId: number) => {
  return await Message.findOne({ ticketId }).sort({ date: -1 });
};
