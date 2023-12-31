#!/usr/bin/env node

const yargs = require('yargs');
const process = require('process');
const path = require('path');
const env = process.env.NODE_ENV || 'development';
const configtPath = path.resolve(process.cwd(), 'dal', 'config.js');
const config = require(configtPath)[env];
const modelsPath = path.resolve(process.cwd(), 'dal', 'models');
const Silo = require('../lib/silo');


const silo = new Silo(config.database, config.username, config.password, modelsPath, config);


// command db:seed --seed <seed-name> --tenant <tenant-name> to run seeders for a specific tenant
// --tenant is optional, if not provided, seeders will be run for all tenants
yargs.command('db:seed', 'Run seeders for a specific tenant', {
  seed: {
    describe: 'Seed name',
    demandOption: true,
    type: 'string'
  },
  tenant: {
    describe: 'Tenant name, if not provided, seeders will be run for all tenants',
    demandOption: false,
    type: 'string'
  }
}, (argv) => {
  
  silo
    .seed(argv.seed, argv.tenant)
    .then(() => {
      console.log('Seeders complete');
      process.exit(0);
    })
    .catch((error) => {
      console.log("Error running seeders", error);
      process.exit(1);
    });
});

yargs.command('db:seed:all', 'Run all seeders, either for all tenants or for a specific tenant', {
  tenant: {
    describe: 'Tenant name, if not provided, seeders will be run for all tenants',
    demandOption: false,
    type: 'string'
  }
}, (argv) => {
  silo
    .seedAll(argv.tenant)
    .then(() => {
      console.log('Seeders complete');
      process.exit(0);
    })
    .catch((error) => {
      console.log("Error running seeders", error);
      process.exit(1);
    });
});


yargs.parse();