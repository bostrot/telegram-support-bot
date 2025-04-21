import mongoose from 'mongoose';
import cache from './cache';

const MONGO_URI = cache.config.mongodb_uri || process.env.MONGO_URI || 'mongodb://localhost:27017/support';
const botTokenSuffix = cache.config.bot_token.slice(-5);
const collectionName = `bot_${cache.config.owner_id}_${botTokenSuffix}`;

interface ISupportee extends Document {
  ticketId: number;
  userid: string;
  status: string;
  category: string | null;
}

const SupporteeSchema = new mongoose.Schema<ISupportee>({
  ticketId: { type: Number, required: true, unique: true, alias: 'id' },
  userid: { type: String, required: true },
  status: { type: String, default: 'open' },
  category: { type: String, default: null },
});

const Supportee = mongoose.model(collectionName, SupporteeSchema);

// Connect to MongoDB
mongoose.connect(MONGO_URI);

/** Methods **/

const getNextTicketId = async () => {
  const lastEntry = await Supportee.findOne().sort({ ticketId: -1 }).select('ticketId');
  return lastEntry ? lastEntry.ticketId + 1 : 1; // Start from 1 if no entries
};

const check = async (userid: any, category: any, callback: (arg0: any) => void) => {
  const query = {
    $or: [{ userid: userid }, { ticketId: userid }],
    ...(category && { category }),
  };
  const result = await Supportee.find(query);
  callback(result);
};

const getTicketById = async (userid: string | number, category: string | null, callback: Function) => {
  const query = {
    $or: [{ userid: userid }, { ticketId: userid }],
    ...(category ? { category } : { category: null }),
  };
  const result = await Supportee.findOne(query);
  callback(result);
};

const getId = async (userid: string, callback: (ticket: any) => void) => {
  const query = { $or: [{ userid: userid }, { ticketId: userid }] };
  const result = await Supportee.findOne(query);
  callback(result);
};

const checkBan = async (userid: any, callback: (ticket: any) => void) => {
  const query = {
    $or: [{ userid: userid }, { ticketId: userid }],
    status: 'banned',
  };
  const result = await Supportee.findOne(query);
  callback(result);
};

const closeAll = async () => {
  await Supportee.updateMany({}, { $set: { status: 'closed' } });
};

const reopen = async (userid: any, category: string) => {
  const query = {
    $or: [{ userid: userid }, { ticketId: userid }],
    ...(category && { category }),
  };
  await Supportee.updateMany(query, { $set: { status: 'open' } });
};

const add = async (
  userid: string | number,
  status: string,
  category: string | number | null,
) => {
  let result;
  if (status === 'closed') {
    const query = {
      $or: [{ userid: userid }, { ticketId: userid }],
      ...(category && { category }),
    };
    result = await Supportee.updateMany(query, { $set: { status: 'closed' } });
  } else if (status === 'open') {
    let ticketId = await getNextTicketId();
    result = await Supportee.findOneAndReplace(
      { userid },
      { userid, ticketId, status, category },
      { upsert: true },
    );
  } else if (status === 'banned') {
    result = await Supportee.findOneAndReplace(
      { userid },
      { userid, ticketId: await getNextTicketId(), status: 'banned', category: 'BANNED' },
      { upsert: true },
    );
  }
  return result?.modifiedCount || 0;
};

const open = async (callback: Function, category: string[]) => {
  const query = {
    status: 'open',
    ...(category.length > 0
      ? { category: { $in: category } }
      : { category: null }),
  };
  const result = await Supportee.find(query);
  callback(result);
};

export { open, add, check, getTicketById, checkBan, getId, closeAll, reopen, ISupportee, SupporteeSchema };
