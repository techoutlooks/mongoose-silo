const singlify = silo => async (req, res, next) => {
  
  if (req.headers['x-tenant-id']) 
    return res.status(400).json({ 
      error: 'Non necessary header X-Tenant-Id' 
    })
  
  try {
    console.log(`\n🚀 singlify : → ${req.method} ${req.originalUrl}`)
    await silo.initialize({tenantify: false});
    silo.switch();

  } catch (error) {
    return res.status(400)
      .json({ error: error.message })
  }
  next()
}

module.exports = singlify
