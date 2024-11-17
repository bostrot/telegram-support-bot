import Database from 'better-sqlite3';
import mongoose from 'mongoose';
import cache from './cache';

const MONGO_URI = cache.config.mongodb_uri || 'mongodb://localhost:27017/support';
const botTokenSuffix = cache.config.bot_token.slice(-5);
const collectionName = `bot_${cache.config.owner_id}_${botTokenSuffix}`;

const SupporteeSchema = new mongoose.Schema({
    ticketId: { type: Number, required: true, unique: true },
    userid: { type: String, required: true },
    status: { type: String, default: 'open' },
    category: { type: String, default: null },
});

/**
 * Migrate data from SQLite to MongoDB
*/
export const migrateData = async () => {
    // Create or retrieve the dynamic model using the collection name
    const Supportee = mongoose.models[collectionName] ?? mongoose.model(collectionName, SupporteeSchema);

    const sqliteDb = new Database('./config/support.db');
    await mongoose.connect(MONGO_URI);

    try {
        // Fetch all records from SQLite
        const supportees = sqliteDb.prepare('SELECT * FROM supportees').all();

        // Migrate each record to MongoDB
        for (const supportee of supportees) {
            const { id: ticketId, userid, status, category } = supportee;

            // Insert the record into MongoDB using the `ticketId` from SQLite
            await Supportee.findOneAndUpdate(
                { ticketId },
                {
                    ticketId,
                    userid: userid.toString(),
                    status,
                    category: category || null,
                },
                { upsert: true, new: true },
            );
        }

        console.log(`Successfully migrated ${supportees.length} records using ticketId as the primary key.`);
    } catch (error) {
        console.error('Migration error:', error);
    } finally {
        sqliteDb.close();
        await mongoose.disconnect();
    }
};
