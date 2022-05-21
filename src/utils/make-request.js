const fetch = require('node-fetch')

const EIGHT_SLEEP_API = `https://client-api.8slp.net/v1`

async function makeRequest({
  url,
  token,
  method = `GET`,
  body = null,
  contentType = `application/json`,
}) {
  let response
  try {
    response = await fetch(`${EIGHT_SLEEP_API}/${url}`, {
      method: method || `GET`,
      headers: {
        [`Content-Type`]: contentType || `application/json`,
        [`Session-Token`]: token,
        authority: `client-api.8slp.net`,
      },
      body,
    })

    return response.json()
  } catch (error) {
    console.log("Error:", error)
  }
}

module.exports = makeRequest
