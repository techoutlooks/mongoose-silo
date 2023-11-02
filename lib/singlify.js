const singlify = silo => (req, res, next) => {
  
  if (req.headers['x-tenant-id']) {
    return res.status(400).json({ error: 'Non necessary header X-Tenant-Id' })
  }
  try {
    silo.setMainODM()
    console.log(`\n🚀 singlify : → ${req.method} ${req.originalUrl}`, )

  } catch (error) {
    return res.status(400).json({ error: error.message })
  }
  next()
}

module.exports = singlify
