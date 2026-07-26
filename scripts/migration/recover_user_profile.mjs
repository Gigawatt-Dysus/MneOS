import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: '../../.env.local' });

async function recover() {
    const uri = process.env.MONGODB_URI;
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db('LifeOS');
        const usersCol = db.collection('users');
        
        console.log("Loading backup file...");
        const backupPath = 'C:\\LifeOS\\_backups\\firestore_optimized_2026-05-22T23-25-41-004Z.json';
        const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
        const backupUsers = backupData.users || backupData.collections?.users;
        
        const dysusBackup = backupUsers.find(u => u._id === '9MPVGVTxE8dXvkCrl1XrWHQzCl23');
        if (!dysusBackup || !dysusBackup._data) {
            console.error("Could not find Dysus backup data!");
            return;
        }

        const currentDysus = await usersCol.findOne({ _id: '9MPVGVTxE8dXvkCrl1XrWHQzCl23' });
        
        console.log("Found Dysus backup! Merging and restoring...");
        
        const merged = { 
            ...dysusBackup._data, 
            ...currentDysus 
        };
        
        // Strip the simulacrum overwrite fields
        delete merged.role;
        delete merged.content;
        delete merged.timestamp;
        
        // Ensure id is correct
        merged._id = '9MPVGVTxE8dXvkCrl1XrWHQzCl23';

        await usersCol.replaceOne({ _id: '9MPVGVTxE8dXvkCrl1XrWHQzCl23' }, merged);
        console.log("SUCCESS! Dysus user profile fully restored from backup.");

        const b1Backup = backupUsers.find(u => u._id === 'b1TTYTUyjTR3e7faBT8lex0sn792');
        if (b1Backup && b1Backup._data) {
            const currentB1 = await usersCol.findOne({ _id: 'b1TTYTUyjTR3e7faBT8lex0sn792' });
            const mergedB1 = { ...b1Backup._data, ...currentB1 };
            delete mergedB1.role;
            delete mergedB1.content;
            delete mergedB1.timestamp;
            mergedB1._id = 'b1TTYTUyjTR3e7faBT8lex0sn792';
            await usersCol.replaceOne({ _id: 'b1TTYTUyjTR3e7faBT8lex0sn792' }, mergedB1);
            console.log("SUCCESS! b1TTYTUyjTR3e7faBT8lex0sn792 restored.");
        }

    } catch(e) {
        console.error("Error during recovery:", e);
    } finally {
        await client.close();
    }
}

recover();
