const h = require('./helpers');

const tenantify = silo => async (req, res, next) => {
  
  const tenantId = 
    req.cookies[h.HTTP_X_TENANT_ID] || 
    req.headers[h.HTTP_X_TENANT_ID]
    
  if (!tenantId) return res.status(400).json({ 
    error: 'Missing X-Tenant-Id header' 
  })

  try {
    console.log(`\n🚀 tenant ${tenantId}: → ${req.method} ${req.originalUrl}`, )
    await silo.initialize({tenantify: true})
    silo.switch(tenantId)

  } catch (error) {
    return res.status(500).json({
      success: false,
      result: null,
      message: error.message
    });
  }

  next();
}

module.exports = tenantify
