require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');
const Subclass = require('../../data/mongooseDataStructure/subclass');

const subclassesData = require('../../data/gameFiles/class/subclasses.json');

const MONGO_URI = process.env.MONGO_URI;

async function seedSubclasses() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 30000 });
        console.log('✓ Connected to MongoDB');

        // Clear existing subclasses
        const deleteResult = await Subclass.deleteMany({});
        console.log(`✓ Deleted ${deleteResult.deletedCount} existing subclasses`);

        // Prepare subclass documents
        console.log('Seeding subclasses...');
        const subclassDocuments = Object.values(subclassesData).map(subclass => ({
            name: subclass.name,
            classID: subclass.classID,
            description: subclass.description,
            parentClass: subclass.parentClass,
            featuresByLevel: subclass.featuresByLevel || {},
        }));

        // Insert subclasses
        const result = await Subclass.insertMany(subclassDocuments);
        console.log(`✓ Inserted ${result.length} subclasses`);

        // Log sample
        console.log('\n📋 Sample subclasses:');
        result.slice(0, 5).forEach(sc => {
            console.log(`  - ${sc.name} (${sc.parentClass})`);
        });

        await mongoose.connection.close();
        console.log('✓ Connection closed');
        process.exit(0);
    } catch (err) {
        console.error('Seed error:', err);
        await mongoose.connection.close();
        process.exit(1);
    }
}

seedSubclasses();
