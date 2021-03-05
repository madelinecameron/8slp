const moment = require('moment-timezone')
const utils = require('./utils')

const $token = Symbol(`token`)

/** Represents one side of the Eight Sleep */
class EightSleepSide {
  /**
   * Instantiate instance of one side of the bed
   *
   * @param {object} opts
   * @param {string} opts.userId User ID for this side of the bed
   * @param {object} opts.globalCache Object representing global cache, shared between both sides and base
   */
  constructor({ userId, globalCache }) {
    this.cache = new utils.Cache(globalCache, userId)

    this[$token] = this.cache.get(`token`)

    const userIds = this.cache.get(`userIds`)
    this.userId = userId

    // User ID array is left -> right, so 0th index is left, 1st index is right
    this.side = userIds.indexOf(userId) === 0 ? `left` : `right`,
    this.tz = this.cache.get(`tz`)
    this.deviceId = this.cache.get(`deviceId`)
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
    body,
  }) {
    return utils.makeRequest({
      url,
      method,
      body,
      token: this.cache.get(`token.token`),
    })
  }

  whoami() {
    return this.side
  }

  /**
   * Set heating / cooling level of side
   *
   * @param {number} level -100 to 100 level of heating
   * @param {number} duration Duration in seconds of level
   */
  async setLevel(level, duration) {
    const normalizedLevel = Math.max(-100, Math.min(level, 100))

    const { side, deviceId } = this

    const data = {
      [`${side}TargetHeatingLevel`]: level,
      [`${side}HeatingDuration`]: duration,
    }

    // TODO Update cache?
    return this._makeRequest({
      url: `devices/${deviceId}`,
      method: `PUT`,
      body: JSON.stringify(data),
    })
  }

  /**
   * Check if side is active
   *
   * @returns {boolean} Whether side is currently on
   */
  isHeating() {
    return this.cache.userGet(`nowHeating`)
  }

  /**
   * Check heating / cooling level target
   *
   * @returns {number} 0 - 100 target level
   */
  targetLevel() {
    return this.cache.userGet(`targetHeatingLevel`)
  }

  /**
   * Check when side last detected someone laying
   *
   * @returns {string} ISO-8601 datestring of last time
   */
  lastSeen() {
    return this.cache.userGet(`presenceEnd`)
  }

  /**
   * Current status of this side
   *
   * @returns {object} Status of side (`targetHeatingLevel`, `heatingLevel`, `heatingDuration`, `nowHeating`, `presenceEnd`)
   */
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

  /**
   * Return data for current session or a session specified by date
   *
   * @param {object} opts
   * @param {string} [opts.date] ISO-8601 datestring of desired session
   *
   * @returns {object} Session info
   */
  session({ date = null } = {}) {
    if (!date) {
      return this.cache.userGet(`currentSession`)
    }

    const sessions = this.cache.userGet(`session`)

    return sessions.find((session) => {
      return moment(session.ts).isSame(moment(date), `day`)
    })
  }

  /**
   * Current stage of sleep (only works with active session)
   *
   * @returns {string} Current sleep stage
   */
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

  /**
   * @private
   * Retrieve data from timeseries' from cached information for current session
   *
   * @param {string} key Key of `timeseries` array
   *
   * @returns {array} Array of timeseries info
   */
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

  /**
   * Retrieve latest room temp for current session
   *
   * @returns {[ date, roomTempC, roomTempF ]} Current room temp in Farenheit
   */
  roomTemp() {
    // TODO Convert to F
    const [ date, roomTempC ] = this._getIntervalsInfo(`roomTempC`)

    const roomTempF = (roomTempC * 1.8) + 32

    return [ date, roomTempC, roomTempF ]
  }

  /**
   * Retrieve latest bed temp for current session
   *
   * @returns {[ date, bedTempC, bedTempF ]} Bed temperature event
   */
  bedTemp() {
    // TODO Convert to F
    const [ date, bedTempC ] = this._getIntervalsInfo(`bedTempC`)

    const bedTempF = (bedTempC * 1.8) + 32

    return [ date, bedTempC, bedTempF ]
  }

  /**
   * Retrieve latest toss-and-turns event for current session
   *
   * @returns {[ date, tossandturns ]} Toss and turns event
   */
  tossAndTurns() {
    return this._getIntervalsInfo(`tnt`)
  }

  /**
   * Retrieve latest heart rate event for current session
   *
   * @returns {[ date, heartRate ]} Heart rate event
   */
  heartRate() {
    return this._getIntervalsInfo(`heartRate`)
  }

  /**
   * Retrieve latest heart rate variability for current session
   *
   * @returns {[ date, hrv ]} Heart rate variability event
   */
  heartRateVariability() {
    return this._getIntervalsInfo(`hrv`)
  }

  /**
   * Retrieve latest respiratory rate for current session
   *
   * @returns {[ date, respiratoryRate ]} Respiratory rate event
   */
  respiratoryRate() {
    return this._getIntervalsInfo(`respiratoryRate`)
  }

  /**
   * Literally no clue
   */
  rmssd() {
    return this._getIntervalsInfo(`rmssd`)
  }

  /**
   * Retrieve sleep scores for given session
   *
   * @param {object} opts
   * @param {string} [opts.date] Datestring of desired session
   *
   * @returns {{ score, sleepFitnessScore }} Sleep scores
   */
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

  /**
   * Retrieve total sleep breakdown for given session
   *
   * @param {object} opts
   * @param {string} opts.date Datestring of desired session
   *
   * @returns {object} Map of sleep stages and total duration
   */
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

  /**
   * Retrieve previous session
   *
   * @returns {object} Session object of previous session
   */
  previousSession() {
    return this.cache.userGet(`previousSession`)
  }

  /**
   * Refresh data for both sides of the bed
   */
  async refresh() {
    await this._pullDeviceData()
    await this._pullIntervals()
    await this._pullTrends()
  }

  /**
   * @private
   * Refresh intervals info and persist in cache
   *
   * @returns {object} Intervals object
   */
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

  /**
   * @private
   * Refresh trends info and persist in cache
   *
   * @returns {object} Trends object
   */
  async _pullTrends() {
    const { days } = await this._makeRequest({
      url: `users/${this.userId}/trends?tz=${this.tz}&to=${moment().subtract(1, `day`).format()}&from=${moment().format()}`,
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

  /**
   * @private
   * Refresh device data and persist in cache
   *
   * @returns {object} Device data object
   */
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
