const mongoose = require('mongoose');

/**
 * KINDINKI Database Connection
 * Using the secure MONGO_URI from your .env file.
 */
const connectDB = async () => {
  try {
    // This pulls the full string: mongodb+srv://...
    const dbURI = process.env.MONGO_URI;

    if (!dbURI) {
      throw new Error("MONGO_URI is missing from your .env file!");
    }

    const conn = await mongoose.connect(dbURI, {
      autoIndex: true, 
    });

    console.log(`
    ✨ KINDINKI Database Connected: ${conn.connection.host}
    -------------------------------------------------------
    Cluster: Kindinki (MongoDB Atlas)
    Status:  Active & Ready
    -------------------------------------------------------`);
  } catch (error) {
    console.error(`❌ KINDINKI Connection Error: ${error.message}`);
    // Exit if the database fails so the server doesn't run "blind"
    process.exit(1);
  }
};

// Exporting the function so server.js can call it
module.exports = connectDB;