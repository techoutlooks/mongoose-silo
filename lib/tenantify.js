const tenantify = silo => async (req, res, next) => {
  

  const tenantId = 
    req.cookies[process.env.HTTP_X_TENANT_ID] || 
    req.headers[process.env.HTTP_X_TENANT_ID]
  if (!tenantId) return res.status(400).json({ 
    error: 'Missing X-Tenant-Id header' 
  })

  try {

    console.log(`\n🚀 tenant ${tenantId}: → ${req.method} ${req.originalUrl}`, )
    await silo.initialize({tenantify: true})
    await silo.switch(tenantId)

 } catch (error) {
    return res.status(400).json({ error: error.message })
  }
  next()
}

module.exports = tenantify
