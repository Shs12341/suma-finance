const { Pool } = require("pg")

function readDatabasePassword() {
  if (process.env.DB_PASSWORD_B64) {
    return Buffer.from(process.env.DB_PASSWORD_B64, "base64").toString("utf8")
  }

  return process.env.DB_PASSWORD
}

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL
    })
  : new Pool({
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: readDatabasePassword(),
      port: Number(process.env.DB_PORT || 5432)
    })

module.exports = pool