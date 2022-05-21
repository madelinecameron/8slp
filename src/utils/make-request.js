const fetch = require('node-fetch')

const EIGHT_SLEEP_API = `https://client-api.8slp.net/v1`

async function makeRequest({
  url,
  token,
  method = `GET`,
  body = null,
  contentType = `application/json`,
}) {
  const response = await fetch(`${EIGHT_SLEEP_API}/${url}`, {
    method,
    headers: {
      [`Content-Type`]: contentType,
      [`Session-Token`]: token,
      authority: `client-api.8slp.net`,
    },
    body,
  })

  return response.json()
}

module.exports = makeRequest
