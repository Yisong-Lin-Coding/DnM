const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Subclass = require('../data/mongooseDataStructure/subclass');

// MongoDB connection string
const MONGODB_URI = 'mongodb://localhost:27017/d-and-d-game';

async function seedSubclasses() {
    try {
        // Connect to MongoDB
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ Connected to MongoDB');

        // Read subclasses.json
        const subclassesPath = path.join(__dirname, '../data/gameFiles/class/subclasses.json');
        const subclassesData = JSON.parse(fs.readFileSync(subclassesPath, 'utf8'));

        // Clear existing subclasses
        await Subclass.deleteMany({});
        console.log('🗑️ Cleared existing subclasses');

        // Prepare subclass documents
        const subclassDocuments = Object.values(subclassesData).map(subclass => ({
            name: subclass.name,
            classID: subclass.classID,
            description: subclass.description,
            parentClass: subclass.parentClass,
            featuresByLevel: subclass.featuresByLevel || {},
        }));

        // Insert subclasses
        const result = await Subclass.insertMany(subclassDocuments);
        console.log(`✅ Seeded ${result.length} subclasses`);

        // Log sample
        console.log('\n📋 Sample subclasses:');
        result.slice(0, 5).forEach(sc => {
            console.log(`  - ${sc.name} (${sc.parentClass})`);
        });

        console.log('\n✅ Subclass seeding completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding subclasses:', error);
        process.exit(1);
    }
}

seedSubclasses();
