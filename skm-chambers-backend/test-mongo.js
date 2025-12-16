const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect('mongodb://127.0.0.1:27017/skm-chambers')
  .then(() => {
    console.log('✅ Connected to MongoDB');
    
    // List all databases
    mongoose.connection.db.admin().listDatabases((err, result) => {
      if (err) console.log('Error:', err);
      console.log('Databases:', result.databases.map(d => d.name));
      
      // List collections in skm-chambers
      mongoose.connection.db.listCollections().toArray((err, collections) => {
        console.log('Collections:', collections.map(c => c.name));
        mongoose.connection.close();
      });
    });
  })
  .catch(err => console.log('❌ Connection error:', err.message));