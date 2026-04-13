const mongoose = require('mongoose');
require('dotenv').config();

const uri = process.env.MONGO_URI || 'mongodb+srv://dennisotiali_db_user:tbHYRAivvY0nO6Wg@kindinki.ewmu6ux.mongodb.net/KindinkiDb?retryWrites=true&w=majority';

async function main() {
  try {
    await mongoose.connect(uri);
    console.log("Connected to MongoDB!");
    
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    console.log("Collections:", collections.map(c => c.name));
    
    for (const coll of collections) {
      const parentColl = db.collection(coll.name);
      const docs = await parentColl.find({}).toArray();
      console.log(`\n=== Documents in ${coll.name} ===`);
      if (docs.length === 0) {
          console.log("No documents.");
      } else {
          docs.forEach(doc => {
             console.log(JSON.stringify(doc).substring(0, 150) + "...");
          });
      }
    }
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  } finally {
    await mongoose.disconnect();
  }
}

main();
