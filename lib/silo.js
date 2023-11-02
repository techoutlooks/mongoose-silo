"use strict";

const glob = require('glob');
const fs = require('fs');
const path = require('path');
const { getDb } = require('./mongo')


class Silo {

  /**
   * Create a singleton service allowing siloed MongoDB connections.
   * @param {string} dbName: name of main database (has the tenant orgs)
   * @param {string} mainModel: name of main model with all tenant orgs.
   * @param {string} modelsPath: models (KV of {model: schema}) to create into every tenant db
   * @returns 
   */
  constructor(dbName, mainModel = 'Tenant', modelsPath = null) {
    if (! Silo.instance) {
      this.dbName = dbName;
      this.modelsPath = modelsPath
      this.tenantConnections = {}
      this.tenantODMs = {}
      this.mainModel = mainModel
      this.mainODM = {}
      this.currentODM = this.mainODM
      this.mainConnection = null
      Silo.instance = this
    }
    return Silo.instance
  }

  async initialize() {

    const buildOMs = () => new Promise(async(resolve, reject) => {
      this.buildMainODM() 
      await this.buildTenantODMs()
      resolve(this)
    })

    try {
      const dbConn = await getDb(this.dbName)
      this.mainConnection = dbConn
      return await buildOMs()
    } catch (e) {
      console.error("🚫 Error → : mongoose-silo could not initialize !", e) 
    }

  }

  buildMainODM() {
    this.mainODM = this._registerModels(this.mainConnection, true)
  }

  /***
   * Create a Tenant
   */
  async createTenant(subdomain, fields={}) {

    subdomain = subdomain.toLowerCase()
    let tenant;
    try {
      tenant = await this.mainODM[this.mainModel].create({
        ...fields,
        subdomain,
        dbName: `tenant_${subdomain}`,
        status: 'active',
      })
    } catch (error) {
      console.log(error)

      // FIXME: wrong errcode for mongoose
      if (error.name === 'SequelizeUniqueConstraintError') {
        throw new Error('Subdomain already exists')
      } else {
        throw new Error('Something went wrong')
      }
    }

    // create a new connection for the tenant
    this.tenantConnections[subdomain] = await getDb(`tenant_${subdomain}`)

    // create the tenant's ODM
    this.tenantODMs[subdomain] = this._registerModels(this.tenantConnections[subdomain])

    // FIXME:
    // seed the tenant's collections with fixtures 
    // from path: 'models/seeders/*.js'
    // const seedGlob = this._buildAllSeedsGlob()
    // const seedUmzug = this._initializeUmzug(this.tenantConnections[subdomain], seedGlob)
    // await seedUmzug.up()

    return tenant
  }
  
  async getDbTenants() {
    const tenants = await this.mainConnection.model(this.mainModel).find()
    console.debug(`>> Loaded ${tenants && tenants.length || 0} tenant(s) from model ${this.mainModel}: `, 
    tenants.map(t => t.subdomain))
    return tenants
  }

  async buildTenantConnections() {
    const tenants = await this.getDbTenants()
    for (const tenant of tenants) {
      this.tenantConnections[tenant.subdomain] = await getDb(tenant.dbName)
    }
  }

  async buildTenantODMs() {

    // re-use existing tenant connections
    if (Object.keys(this.tenantConnections).length === 0) {
      await this.buildTenantConnections() 
    }

    // if still empty, it means no tenant were found, quit then with a warning 
    if (!Object.keys(this.tenantConnections).length) { 
      console.log('>> 🚫 Not building tenant OMs: found 0 tenant')

    } else {
      for (const tenant in this.tenantConnections) {
        console.debug(`>> Registering models for tenant: ${tenant}`, Object.keys(this.tenantConnections))
        this.tenantODMs[tenant] = this._registerModels(this.tenantConnections[tenant])
        console.debug(`>> Registered (${Object.keys(this.tenantODMs[tenant]).length || 0}) models for tenant: ${tenant}`)
      } 
    }

  } 

  /***
   * Switch database connection.
   */
  switch(subdomain) {
    if (! this.tenantODMs[subdomain]) {
      throw new Error(`🚫 No tenant with subdomain ${subdomain}`)
    }
    this.currentODM = this.tenantODMs[subdomain]
    console.debug(">> switched db → tenant: ", subdomain) 
  }

  setMainODM() {     
    this.currentODM = this.mainODM
    console.debug(">> switched db → main ODM: ", this.mainModel) 
  }

  getCurrentODM() {
    if (! this.currentODM) {
      throw new Error('No current db set')
    }
    return this.currentODM
  }

  _registerModels(db, isMainModel = false) {

    const dbSchema = {} 
    if (!Object.keys(db.models).length) { // avoid re-compiling schemas

      let modelFiles = _getModelFiles(this.modelsPath)
      modelFiles.forEach(filePath => {

        const { name, schema } = require(filePath)
        if(!isMainModel) {
          dbSchema[name] = db.model(name, schema)

        } else if(isMainModel && (name === this.mainModel)) {
          schema.add({
            subdomain: { type: String, required: true, lowercase: true },
            dbName: { type: String, required: true, lowercase: true },
            status: { type: String, default: 'active'},
          })
          dbSchema[name] = db.model(name, schema)
        }

      })
    } 

    const modelNames = Object.keys(dbSchema)
    console.debug(`>> Registered (${modelNames.length}) model(s) with`, 
      `${isMainModel ? "main" : "tenant"} ${"database `"  + db.name + "`"} → : `, 
      modelNames)

    return dbSchema
  }


  _initializeUmzug(db, glob) {
    console.log("???????????? _initializeUmzug 1", glob)

    if(Object.keys(db.models).length) {
      glob.flatMap( x => x).forEach(seedGlob => {
        console.log("???????????? _initializeUmzug 2", seedGlob)
        const model = db.models[path.parse(seedGlob).name]

        return {
          up: async () => await model.create(require(seedGlob)),
          down: async () => await model.deleteMany()
        }
      })
    }
  }

  async seed(seedName, tenantName = null) {

    if (tenantName) {
      await this.buildTenantConnections()
      const seedGlob = _buildSeedGlob(seedName)
      const umzug = this._initializeUmzug(this.tenantConnections[tenantName], seedGlob)
      await umzug.up()
    } else {
      const tenants = await this.getDbTenants()
      const seedGlob = _buildSeedGlob(seedName)
      
      const umzugPromises = []
      for (const tenant of tenants) {
        this.tenantConnections[tenant.subdomain] = getDb(tenant.dbName)
        const umzug = this._initializeUmzug(this.tenantConnections[tenant.subdomain], seedGlob)
        umzugPromises.push(umzug.up())
      }
      await Promise.all(umzugPromises)
    }
  }  
  
  async seedAll(tenantName = null) {
    if (tenantName) {
      await this.buildTenantConnections()
      const seedsGlob = this._buildAllSeedsGlob()
      const umzug = this._initializeUmzug(this.tenantConnections[tenantName], seedsGlob)
      await umzug.up()
    } else {
      const tenants = await this.getDbTenants()
      const seedsGlob = this._buildAllSeedsGlob()

      const umzugPromises = []
      for (const tenant of tenants) {
        const umzug = this._initializeUmzug(this.tenantConnections[tenant.subdomain], seedsGlob)
        umzugPromises.push(umzug.up())
      }
      await Promise.all(umzugPromises)
    }
  }

  _buildAllSeedsGlob() {
    const g = path.join(this.modelsPath, `../seeders/*.js`)
    const seedFiles = glob.sync(g)
    console.debug(`>> Loaded seeders (${tenant.subdomain}) from ${g} → : `, seedFiles) 
    return seedFiles
  }

}



const _getModelFiles = (path) => 
  glob
    .sync(`${path}/**/*.js`)
    .filter(file => {
      return (
        file.indexOf('.') !== 0 &&
        file.indexOf('index.js') === -1 &&
        file.indexOf('.test.js') === -1
      );
    })


const _buildSeedGlob = seedName =>
  path.join(__dirname, `../seeders/${seedName}.js`)



module.exports = Silo