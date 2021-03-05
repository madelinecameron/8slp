const { URLSearchParams } = require('url')
const utils = require('./utils')
const EightSleepSide = require('./side')

const $token = Symbol(`token`)
const $tokenExpire = Symbol(`token-expire`)
const $globalCache = Symbol(`global-cache`)

/** Overall class for API */
class EightSleepBase {
  /**
   * @constructor
   *
   * @param {string} tz Timezone (eg: 'America/New_York') to use for responses
   */
  constructor(tz) {
    this[$globalCache] = {
      userIds: [],
    }

    this.cache = new utils.Cache(this[$globalCache])

    this.tz = tz

    this.cache.put(`tz`, tz)

    // Throw error if `left`,`right` or `me` is used before authentication
    const notAuthenticated = () => { throw new Error(`not authenticated`) }
    this.left = notAuthenticated
    this.right = notAuthenticated
    this.me = notAuthenticated
  }

  /**
   * @private
   * Wrapped function for sending requests to Eight Sleep
   *
   * @param {object} opts
   * @param {string} opts.url EightSleep endpoint url
   * @param {string} opts.method HTTP Verb to use
   * @param {object} opts.body JSON body to send
   */
  async _makeRequest({
    url,
    method,
    contentType,
    body,
  }) {
    return utils.makeRequest({
      url,
      method,
      body,
      contentType,
      token: this.cache.get(`token.token`)
    })
  }

  async authenticateWithToken(token, expirationDate) {
    if (!token || !expirationDate) {
      throw new Error(`Make sure to include token and expirationDate`)
    }

    this.cache.put(`token`, { token, expirationDate })

    await this.currentDeviceId()
    await this.getSides({ loadUserData: false })
  }
  /**
   * Authenticate with EightSleep API
   *
   * @param {string} email Email of EightSleep account
   * @param {string} password Password of EightSleep account
   */
  async authenticate(email, password) {
    try {
      const params = new URLSearchParams()
      params.append('email', email)
      params.append('password', password)
      const {
        session: {
          token,
          expirationDate,
          userId,
        },
      } = await this._makeRequest({
        url: `login`,
        method: `POST`,
        contentType: `application/x-www-form-urlencoded`,
        body: params,
      })

      this.cache.put(`token`, { token, expirationDate })
      this.cache.put(`loggedInUserId`, userId)

      await this.currentDeviceId()
      await this.getSides({ loadUserData: true })

      return { token, expirationDate }
    } catch (error) {
      console.error(`Error occurred authenticating:`, error)
    }
  }

  /**
   * Get basic info about both sides of the bed
   *
   * @returns {[ leftUserId, rightUserId ]} Array of user IDs
   */
  async getSides({ loadUserData = false } = {}) {
    const deviceId = this.cache.get(`deviceId`)

    const {
      result: {
        rightUserId,
        leftUserId,
      },
    } = await this._makeRequest({
      // Strong assumption that only one devices! oops.
      url: `devices/${deviceId}?filter=leftUserId,rightUserId`,
    })

    this.cache.put(`userIds`, [ leftUserId, rightUserId ])

    this.left = new EightSleepSide({
      userId: leftUserId,
      globalCache: this[$globalCache],
    })

    this.right = new EightSleepSide({
      userId: rightUserId,
      globalCache: this[$globalCache],
    })

    const currentUserId = this.cache.get(`loggedInUserId`)

    if (leftUserId === currentUserId) {
      this.me = this.left
    } else {
      this.me = this.right
    }

    if (loadUserData) {
      // `refresh` loads data for both sides, regardless of which calls it.
      //
      // The data is persisted in the global cache so `me`, `left` and `right`
      // can access the refreshed data.
      await this.me.refresh()
    }

    return this.cache.get(`userIds`)
  }

  /**
   * Get the active device ID on the account
   *
   * @returns {string} Device ID
   */
  async currentDeviceId() {
    const {
      user: {
        currentDevice: {
          id,
        }
      },
    } = await this._makeRequest({
      url: `users/me`,
    })


    this.cache.put(`deviceId`, id)

    return id
  }
}

module.exports = EightSleepBase
