// Dynamically require better-sqlite3 to make it optional and avoid native build errors
import mongoose, { Model } from 'mongoose';
import cache from './cache';
import { ISupportee, SupporteeSchema } from './db';
import * as log from './logger'

// Lazy config accessors — defer reading cache.config until runtime
function getMongoUri(): string {
  return cache.config?.mongodb_uri || 'mongodb://localhost:27017/support';
}

function getCollectionName(): string {
  return `bot_${cache.config?.owner_id}_${cache.config?.bot_token?.slice(-5) || ''}`;
}

const Supportee: Model<ISupportee> = 
  mongoose.models[getCollectionName()] as Model<ISupportee> ||
  mongoose.model<ISupportee>(getCollectionName(), SupporteeSchema);

export const migrateData = async () => {
  let sqliteDb;
  try {
    const Database = require('better-sqlite3');
    sqliteDb = new Database('./config/support.db');
  } catch (err) {
    // better-sqlite3 not available, skip migration
    return;
  }
  await mongoose.connect(getMongoUri());

  try {
    // Fetch all records from SQLite
    const supportees = sqliteDb.prepare('SELECT * FROM supportees').all();

    // Migrate each record to MongoDB
    for (const supportee of supportees) {
      const { id: ticketId, userid, status, category } = supportee;

      await Supportee.findOneAndUpdate(
        { ticketId },
        {
          ticketId,
          userid: userid.toString(),
          status,
          category: category || null,
        },
        { upsert: true, new: true }
      );
    }

    log.info(`Successfully migrated ${supportees.length} records using ticketId as the primary key.`);
  } catch (error) {
    log.error('Migration error:', error);
  } finally {
    sqliteDb.close();
    await mongoose.disconnect();
  }
};
