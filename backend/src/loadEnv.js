const fs = require("fs")
const os = require("os")
const path = require("path")
const dotenv = require("dotenv")

const userEnvPath = path.join(os.homedir(), ".finance-app.env")
const projectEnvPath = path.join(__dirname, "..", ".env")
const envPath = fs.existsSync(userEnvPath) ? userEnvPath : projectEnvPath

dotenv.config({ path: envPath, quiet: true })

module.exports = envPath
