const fetch = require(`node-fetch`)

const EIGHT_SLEEP_API = `https://client-api.8slp.net/v1`

async function makeRequest({
  url,
  token,
  method = `GET`,
  body = null,
}) {
  const response = await fetch(`${EIGHT_SLEEP_API}/${url}`, {
    method,
    headers: {
      [`Content-Type`]: `application/json`,
      [`Session-Token`]: token,
      authority: `client-api.8slp.net`,
    },
    body: JSON.stringify(body)
  })

  console.log("RESP:", response)
  return response.json()
}

module.exports = makeRequest
