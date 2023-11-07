const h = require('./helpers');

const singlify = silo => async (req, res, next) => {
  
  if (req.headers[h.HTTP_X_TENANT_ID]) 
    return res.status(400).json({ 
      error: 'Non necessary header X-Tenant-Id' 
    })
  
  try {
    console.log(`\n🚀 singlify : → ${req.method} ${req.originalUrl}`)
    await silo.initialize({tenantify: false})
    silo.switch();

  } catch (error) {
    return res.status(500).json({
      success: false,
      result: null,
      message: error.message
    });
  }

  next();
}

module.exports = singlify
