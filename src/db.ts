import mongoose from 'mongoose';
import cache from './cache';
import { Messenger } from './interfaces';

const MONGO_URI = cache.config.mongodb_uri || 'mongodb://localhost:27017/support';
const botTokenSuffix = cache.config.bot_token.slice(-5);
const collectionName = `bot_${cache.config.owner_id}_${botTokenSuffix}`;

export interface ISupportee extends mongoose.Document {
  ticketId: number;
  userid: string;
  messenger: Messenger;
  status: string;
  category: string | null;
}

export const SupporteeSchema = new mongoose.Schema<ISupportee>({
  ticketId: { type: Number, required: true, unique: true, alias: 'id' },
  userid: { type: String, required: true },
  messenger: { type: String, required: true },
  status: { type: String, default: 'open' },
  category: { type: String, default: null },
});

const Supportee = mongoose.model(collectionName, SupporteeSchema);

export async function connect() {
  mongoose.connection.on('open', () => {
    console.log('Connected to mongo server.');
  });

  mongoose.connection.on('error', (err) => {
    console.log('Could not connect to mongo server!', err);
    process.exit(1);
  });

  const connection = await mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
  });

  return connection;
}

/** Methods **/

export const getNextTicketId = async () => {
  const lastEntry = await Supportee.findOne()
    .sort({ ticketId: -1 })
    .select('ticketId');
  return lastEntry ? lastEntry.ticketId + 1 : 1; // Start from 1 if no entries
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

export const getTicketById = async (
  ticketId: string | number,
  category: string | null,
  callback: Function
) => {
  const query = {
    $or: [{ ticketId: ticketId }],
    ...(category ? { category } : { category: null }),
  };
  const result = await Supportee.findOne(query);
  callback(result);
};

export const getTicketByUserId = async (
  userId: string | number,
  category: string | null,
  callback: Function
) => {
  const query = {
    $or: [{ userid: userId }],
    ...(category ? { category } : { category: null }),
  };
  const result = await Supportee.findOne(query);
  callback(result);
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
