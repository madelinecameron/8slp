const utils = require(`./utils`)
const EightSleepSide = require(`./side`)

const $token = Symbol(`token`)
const $tokenExpire = Symbol(`token-expire`)
const $globalCache = Symbol(`global-cache`)

class EightSleepBase {
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

  async _makeRequest({
    url,
    method,
    body,
  }) {
    return utils.makeRequest({
      url,
      method,
      token: this[$token],
    })
  }

  async authenticate(email, password) {
    const {
      session: {
        token,
        expirationDate,
        userId,
      },
    } = await this._makeRequest({
      url: `login?email=${email}&password=${password}`,
      method: `POST`,
    })

    this.cache.put(`token`, { token, expirationDate })
    this.cache.put(`loggedInUserId`, userId)

    await this.currentDeviceId()
    await this.getSides()
  }

  async getSides() {
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

    return this.cache.get(`userIds`)
  }

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
