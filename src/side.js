const moment = require(`moment-timezone`)
const utils = require(`./utils`)

const $token = Symbol(`token`)

/** Represents one side of the Eight Sleep */
class EightSleepSide {
  /**
   * Instantiate instance of one side of the bed
   *
   * @param {string} token Token received from login
   * @param {string} userId User ID for this side of the bed
   * @param {string} side Which side of the bed is this
   */
  constructor({ userId, globalCache, tz }) {
    this.cache = new utils.Cache(globalCache, userId)

    this[$token] = this.cache.get(`token`)

    const userIds = this.cache.get(`userIds`)
    this.userId = userId

    // User ID array is left -> right, so 0th index is left, 1st index is right
    this.side = userIds.indexOf(userId) === 0 ? `left` : `right`,
    this.tz = this.cache.get(`tz`)
    this.deviceId = this.cache.get(`deviceId`)
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

  async setLevel(level, duration) {
    const normalizedLevel = Math.max(0, Math.min(level, 100))

    const data = {
      [`${side}TargetHeatingLevel`]: level,
      [`${side}HeatingDuration`]: duration,
    }

    // TODO Update cache?
    return makeRequest({
      url: `devices/${deviceId}`,
      method: `PUT`,
      token: this[$token],
    })
  }

  // TODO To be tested
  isHeating({ force = false } = {}) {
    return this.cache.userGet(`nowHeating`)
  }

  // TODO to be tested
  targetLevel() {
    return this._userCahceGet(`targetHeatingLevel`)
  }

  // TODO to be tested
  lastSeen() {
    return this._cacheGet(`presenceEnd`)
  }

  status() {
    const keys = [
      `targetHeatingLevel`,
      `heatingLevel`,
      `heatingDuration`,
      `nowHeating`,
      `presenceEnd`,
    ]

    const status = keys.map((key) => {
      return { [key]: this.cache.userGet(key) }
    })

    return { ...status }
  }

  session({ date = null }) {
    if (!date) {
      return this.cache.userGet(`currentSession`)
    }

    const sessions = this.cache.userGet(`session`)

    return sessions.find((session) => {
      return moment(session.ts).isSame(moment(date), `day`)
    })
  }

  sleepStage() {
    // Is not active session
    if (!this.isHeating()) {
      return null
    }

    function getSleepStage() {
      const currentSession = this.cache.userGet(`currentSession`)

      if (!currentSession || !currentSession.stages || currentSession.stages.length === 0) {
        return null
      }

      // Current session is still processing.
      if (currentSession.incomplete) {
        return currentSession.stages.slice(-2, 1)
      } else {
        return currentSession.stages.slice(-1)
      }
    }

    return getSleepStage()
  }

  _getIntervalsInfo(key) {
    if (!this.isHeating()) {
      return null
    }

    function getInfo() {
      const currentSession = this.cache.userGet(`currentSession`)

      if (!currentSession ||
        !currentSession.timeseries ||
        !currentSession.timeseries[key].length === 0
      ) {
        return null
      }

      return currentSession.timeseries[key].slice(-1)
    }

    return getInfo()
  }

  roomTemp() {
    // TODO Convert to F
    const roomTempC = this._getIntervalsInfo(`roomTempC`)

    return roomTempC
  }

  bedTemp() {
    // TODO Convert to F
    const bedTempC = this._getIntervalsInfo(`bedTempC`)

    return bedTempC
  }

  tossAndTurns() {
    return this._getIntervalsInfo(`tnt`)
  }

  heartRate() {
    return this._getIntervalsInfo(`heartRate`)
  }

  heartRateVariability() {
    return this._getIntervalsInfo(`hrv`)
  }

  respiratoryRate() {
    return this._getIntervalsInfo(`respiratoryRate`)
  }

  rmssd() {
    return this._getIntervalsInfo(`rmssd`)
  }

  scores({ date = null } = {}) {
    function getScores() {
      let session

      if (!date) {
        session = this.cache.userGet(`currentSession`)
      } else {
        const sessions = this.cache.userGet(`sessions`)

        session = sessions.find(({ day }) => {
          return moment(day).isSame(moment(date), `day`)
        })
      }

      if (!session) {
        return null
      }

      const {
        score,
        sleepFitnessScore,
      } = session

      return {
        score,
        sleepFitnessScore,
      }
    }

    return getScores(date)
  }

  sleepBreakdown({ date = null } = {}) {
    let session
    if (!date) {
      session = this.cache.userGet(`currentSession`)
    } else {
      const sessions = this.cache.userGet(`sessions`)

      session = sessions.find(({ day }) => {
        return moment(day).isSame(date, `day`)
      })
    }

    if (!session) {
      return null
    }

    return session.stages.reduce((breakdown, { stage, duration }) => {
      breakdown[stage] += duration

      return breakdown
    }, {
      awake: 0,
      light: 0,
      deep: 0,
      rem: 0,
    })
  }

  previousSession() {
    return this.cache.userGet(`previousSession`)
  }

  async _refresh() {
    await this._pullDeviceData()
    await this._pullIntervals()
    await this._pullTrends()
  }

  async _pullIntervals() {
    const { intervals } = await this._makeRequest({
      url: `users/${this.userId}/intervals`,
      token: this[$token],
    })

    const [
      current,
      previous,
      ...others
    ] = intervals

    current.day = moment(current.ts).utc().format(`YYYY-MM-DD`)

    let currentSession = current
    let previousSession = previous

    // Check if user's side of the device is on
    if (!this.isHeating()) {
      currentSession = null
      previousSession = current
    }

    this.cache.merge(`${this.userId}.currentSession`, currentSession)
    this.cache.merge(`${this.userId}.previousSession`,  previousSession)
    this.cache.merge(`${this.userId}.sessions`, intervals, `day`)

    return intervals
  }

  async _pullTrends() {
    const { days } = await this._makeRequest({
      url: `users/${this.userId}/trends`,
      token: this[$token],
    })

    // Trends are ordered ascending, we want the latest session first
    const [
      latest,
      ...others
    ] = days.reverse()

    const currentSession = this.cache.userGet(`currentSession`)
    const previousSession = this.cache.userGet(`previousSession`)

    // Is the current session the latest trend entry
    const currentIsLatest = currentSession
      && currentSession.day
      && currentSession.day === latest.day

    // Is the previous session the latest trend entry
    const previousIsLatest = previousSession
      && previousSession.day
      && previousSession.day === latest.day

    if (currentIsLatest) {
      this.cache.merge(`${this.userId}.currentSession`, latest)
    } else if (previousIsLatest){
      this.cache.merge(`${this.userId}.previousSession`, latest)
    }

    this.cache.merge(`${this.userId}.sessions`, days, `day`)

    return days
  }

  async _pullDeviceData() {
    function formatSideKey(key, side) {
      const removedSide = key.replace(side, ``)

      return removedSide[0].toLowerCase() + removedSide.slice(1)
    }

    const { result } = await this._makeRequest({
      url: `devices/${this.deviceId}?offlineView=true`,
      token: this[$token],
    })

    // Get keys specific to each side
    const sideVariables = [ `left`, `right` ].reduce((sides, side) => {
      const sideKeys = Object.keys(result).filter(
        (key) => {
          return key.startsWith(side)
        },
      )


      const values = sideKeys.reduce((map, key) => {
        // We want identical maps of values for each side without
        // the side on the key (`leftHeatingLevel` vs `heatingLevel`)
        map[formatSideKey(key, side)] = result[key]

        return map
      }, {})

      sides[side] = values

      return sides
    }, {})

    // Merge / add the values into the cache
    Object.keys(sideVariables).map((side) => {
      const { userId } = sideVariables[side]

      this.cache.merge(userId, sideVariables[side])
    })

    return sideVariables[this.side]
  }
}

module.exports = EightSleepSide
