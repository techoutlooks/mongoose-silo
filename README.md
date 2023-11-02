<h1 align="center" style="border-bottom: none;">📦🚀 mongoose-silo</h1>
<h3 align="center">A wrapper around mongose to build multi-tenant applications</h3>
<p align="center">
  <a href="https://github.com/techoutlooks/mongoose-silo/actions?query=workflow%3Acontinuous-integration">
    <img alt="Build status" src="https://github.com/techoutlooks/mongoose-silo/actions/workflows/github-actions.yml/badge.svg">
  </a>
</p>
<p align="center">
  <a href="https://www.npmjs.com/package/mongoose-silo">
    <img alt="npm latest version" src="https://img.shields.io/npm/v/mongoose-silo/latest.svg">
  </a>
</p>

**mongoose-silo** eases the creation of multi-tenant apps by providing a wrapper around [mongoose](https://mongoosejs.com/) that handles the multi-tenancy for you. It works by siloing your data accross seperate databases, one per each tenant.


## Highlights

* Singleton class Silo, that manages the database context (tenant aware) 
* Swappable tenant model; call it anything eg. Admin, Org, etc.
* Route middleware to create tenant-aware REST endpoints using tenantify or singlify.
* Middleware and primitives to handle the tenant context
* CLI tool to seed fixture data across all tenants 


## API

* Following excerpts demonstrate the core functionality of `mongose-silo`:

```js

// Initialize `mongose-silo` with the main and tenant models
const silo = Silo.initialize('mydb', 'Admin', modelsPath)

// Switch to the database for tenant `tenantId`
silo.switch(tenantId)

// Obtains a connection to the current database 
db = () => silo.getCurrentODM()

// Create a mongo document for the current tenant
orgADashboard = db().model(“Dashboard”).create(…)
```

* Use the CLI to seed fixtures into your models 

```shell
# run seeders for a specific tenant
# `--tenant` here` is optional, if not provided, seeders will be run for all tenants
db:seed --seed <seed-name> --tenant <tenant-name> 

# run all seeders, either for all tenants or for a specific tenant
db:seed:all

```

## Install

```shell

# Clone our repo
git clone https://github.com/techoutlooks/mongoose-silo \
  && DOWNLOAD_DIR="$PWD/mongoose-silo"

# Run following from your project dir
npm i --save $DOWNLOAD_DIR

# It is the responsibility of user code to export the Mongo db uri
export MONGO_URL=mongodb://localhost:27017/leeram-erp?authSource=admin

```

## Quick start

1. Initialize `mongose-silo`, ideally in your `models/index.js` directory.

```js
// models/index.js

require('mongose-silo')
const silo = Silo.initialize('mydb', 'Admin', modelsPath)

module.exports = {
  silo, 
  db: () => silo.getCurrentODM(),
  tenantify: tenantify(silo),
  singlify: singlify(silo)
}

```

2. Define your models as usual, but don't register them with `mongose.model(name, schema)`.
The `Silo.initialize()` static factory inside `mongose-silo` walks your `modelsPath` directory, 
compiles your schemas, and registers them with every tenant database, automagically.

```js

const Dashboard = mongoose.model('Dashboard', Schema({
  title: String }));

// THE CHANGE: instead of registering your model yourself, 
// simply expose your schema like so:
module.exports = { name: 'Dashboard', schema: yourSchema }

```

3. That's all. Now, use your models. 

Remember models/schemas were pulled up automatically from the `modelsPath` directory and compiled, when initializing the library. You need not importing mongoose anymore. 

In your controllers, replace code that looks like:

```js
  const mongoose = require('mongoose');
  const Org = mongoose.model('Org');
```

with:
     
```js
  const { silo, db, singlify } = require('@/models')
  const Org = db().model('Org');  // way 1
  const Org = db().Org;           // way 2
```

Full example:

```js

const tenantId = 'orgA'
const { silo, db, singlify } = require('@/models/index')
silo.switch(tenantId)

await db().Dashboard.create({ 
  title: 'Org A - Weekly report' })

```



### App routes


* Regular route

This is meant for tenant-unaware REST calls; 
ie., GET with no `X-Tenant-Id` header, nor `silo-tenant-id` cookie set on the request.
Below example, a trivial usecase, creates an org tenant. It uses the `singlify` middleware to create a route with multitenancy that:

- inserts an org document in the main database,
- registers models declared in the `modelsPath` directory per each tenant.


```js

app.post('/org', tenantify, async (req, res) => {
  const { name, domain } = req.body

  const tenant = await silo.createTenant(domain)
  silo.switch(tenant.subdomain)

  const org = await db().Org.create({
    name, domain
  })

  res.status(201).json({
    org
  })
})

```

* Tenant route

Use the `tenantify` middleware to switch the database context
to the tenant identified in the request:

```js

app.get('/dashboard', tenantify, async (req, res) => {
  const dashboards = await db().Dashboard.findAll()

  res.status(200).json({
    dashboards
  })
})

```




