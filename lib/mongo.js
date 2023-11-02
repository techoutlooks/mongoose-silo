const mongoose = require('mongoose')

// Env must be configued in user code
const dotenv = require('dotenv')
dotenv.config()

const mongoOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  autoIndex: true,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 30000,
}

/***
 * Connect to db, from the connection pool cache
 * Same db credentials for all tenants and for the main db
 */
function connect() {
  return new Promise((resolve, reject) => {
    mongoose
      .connect(process.env.MONGO_URL, mongoOptions)
      .then((conn) => { resolve(conn) })
      .catch((error) => reject(error))
  })
}


/** Switch db on same connection pool,
 * optionally registering given schemas
 * @param {String} dbName: name of db to retrieve (wil be lowercased)
 * @param {Object} dbSchema: KV of {modelName: modelSchema} t
 * @return new connection
 */
const getDb = async (dbName, dbSchema = null) => {

  const mongoose = await connect()
  mongoose.Promise = global.Promise; 
  mongoose.connection.on('error', (err) => {
    console.error(`🚫 Error → : ${err.message}`);
  });
  
  if (mongoose.connection.readyState === 1) {
    const db = mongoose.connection.useDb(dbName?.toLowerCase(), { useCache:true }) 
  
    if (dbSchema && !Object.keys(db.models).length) {
      dbSchema.forEach((schema, modelName) => {
        db.model(modelName, schema)
      })
    }

    console.log(`>> Connected → : ${db.name}`)
    return db
  }

  throw new Error('error')
}


/**
 * @return model from mongoose
 */
const getModel = async (db, modelName) => {
  return db.model(modelName)
}

module.exports = { connect, getDb, getModel }