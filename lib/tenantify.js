const tenantify = silo => (req, res, next) => {
  

  const tenantId = req.cookies[process.env.HTTP_X_TENANT_ID] || req.headers[process.env.HTTP_X_TENANT_ID]
  if (!tenantId) { return res.status(400).json({ error: 'Missing X-Tenant-Id header' }) }

  try {
    silo.switch(tenantId)
    console.log(`\n🚀 tenant ${tenantId}: → ${req.method} ${req.originalUrl}`, )

 } catch (error) {
    return res.status(400).json({ error: error.message })
  }
  next()
}

module.exports = tenantify
