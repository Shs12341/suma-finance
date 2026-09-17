function encodeCursor({ date, id }) {
  return Buffer.from(JSON.stringify({ date, id }), "utf8").toString("base64url")
}

function decodeCursor(value) {
  if (!value) return null

  try {
    const parsed = JSON.parse(Buffer.from(String(value), "base64url").toString("utf8"))
    if (typeof parsed.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(parsed.date)) return null
    if (!Number.isInteger(parsed.id) || parsed.id <= 0) return null
    return parsed
  } catch {
    return null
  }
}

module.exports = { encodeCursor, decodeCursor }
