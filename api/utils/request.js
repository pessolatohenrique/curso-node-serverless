function formatResponse({ statusCode, response }) {
  return {
    statusCode,
    body: JSON.stringify(response)
  }
}

module.exports = { formatResponse }