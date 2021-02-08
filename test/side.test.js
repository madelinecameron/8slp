const assert = require(`assert`)
const sinon = require(`sinon`)

const utils = require(`../src/utils`)
const EightSleepBase = require(`../src/base`)
const EightSleepSide = require(`../src/side`)

const FAKE_EMAIL = 'fake@email.com'
const FAKE_PASSWORD = '123'

const RESPONSE_MAP = {
  [`login?email=${FAKE_EMAIL}&password=${FAKE_PASSWORD}`]: {
    session: {
      token: `token`,
      expirationDate: 0,
      userId: `leftUserId`,
    }
  },
  [`users/me`]: {
    user: {
      currentDevice: {
        id: `device123`,
      }
    }
  },
  [`devices/device123?filter=leftUserId,rightUserId`]: {
    result: {
      rightUserId: `rightUserId`,
      leftUserId: `leftUserId`,
    }
  },
  [`users/leftUserId/trends`]: {
    days: [
      {
        day: '2021-01-31',
        score: 80,
        sleepFitnessScore: {
          total: 100,
          sleepDurationSeconds: {
            current: 16000,
            average: 16000,
            score: 100,
            weighted: 100
          },
          latencyAsleepSeconds: {
            current: 500,
            average: 500,
            score: 100,
            weighted: 100,
          },
          latencyOutSeconds: {
            current: 500,
            average: 500,
            score: 100,
            weighted: 100,
          },
          wakeupConsistency: {
            current: '06:00:00',
            average: '06:00:00',
            score: 100,
            weighted: 100
          }
        },
        presenceDuration: 32000,
        sleepDuration: 16000,
        deepPercent: 0.8,
        presenceStart: '2021-01-31T00:00:00.000Z',
        presenceEnd: '2021-01-31T09:00:00.000Z',
        sleepStart: '2021-01-31T01:00:00.000Z',
        sleepEnd: '2021-01-31T08:00:00.000Z',
        tnt: 0,
        mainSessionId: '100000',
        sessionIds: [
          '100000',
        ],
        incomplete: false
      }
    ]
  },
  [`users/leftUserId/intervals`]: {
    intervals: [
      {
        id: 'interval123',
        ts: '2021-01-31T00:00:00.000Z',
        stages: [
          {
            stage: 'stage1',
            duration: 16000,
          }
        ],
        score: 100,
        timeseries: {
          tnt: [
            [ '2021-01-31T07:00:00.000Z', 1 ],
          ],
          tempRoomC: [
            [
              '2021-01-31T00:00:00.000Z',
              20,
            ],
          ],
          tempBedC: [
            [
              '2021-01-31T00:00:00.000Z',
              20,
            ],
          ],
          respiratoryRate: [
            [
              '2021-01-31T00:00:00.000Z',
              10,
            ],
          ],
          heartRate: [
            [
              '2021-01-31T00:00:00.000Z',
              50,
            ],
          ],
          heating: [],
          hrv: [
            [
              '2021-01-31T00:00:00.000Z',
              50,
            ]
          ],
          rmssd: [
            [
              '2021-01-31T00:00:00.000Z',
              50,
            ],
          ]
        },
        timezone: 'America/New_York',
        device: {
          id: 'device123',
          side: 'left',
        },
      }
    ]
  },
  [`devices/device123?offlineView=true`]: {
    result: {
      deviceId: 'device123',
      ownerId: 'rightUserId',
      leftUserId: 'leftUserId',
      leftHeatingLevel: 10,
      leftTargetHeatingLevel: 10,
      leftNowHeating: true,
      leftHeatingDuration: 6000,
      leftSchedule: {
        daysUTC: {
          sunday: false,
          monday: false,
          tuesday: false,
          wednesday: false,
          thursday: false,
          friday: false,
          saturday: false,
        },
        enabled: false,
        startUTCHour: 0,
        startUTCMinute: 0,
        durationSeconds: 0
      },
      rightUserId: 'rightUserId',
      rightHeatingLevel: -20,
      rightTargetHeatingLevel: -20,
      rightNowHeating: true,
      rightHeatingDuration: 6000,
      rightSchedule: {
        daysUTC: {
          sunday: false,
          monday: false,
          tuesday: false,
          wednesday: false,
          thursday: false,
          friday: false,
          saturday: false,
        },
        enabled: false,
        startUTCHour: 0,
        startUTCMinute: 0,
        durationSeconds: 0
      },
      priming: false,
      lastLowWater: '2021-01-07T00:00:00.00Z',
      lastPrime: '2021-01-07T00:00:00.000Z',
      needsPriming: false,
      hasWater: true,
      ledBrightnessLevel: 100,
      timezone: 'America/New_York',
    }
  },
}

describe('side', () => {
  let eight

  before(async () => {
    sinon.stub(utils, `makeRequest`).callsFake(({ url, method }) => {
      // TODO Check method
      const res = RESPONSE_MAP[url]

      return Promise.resolve(res)
    })

    eight = new EightSleepBase(`America/New_York`)

    await eight.authenticate(FAKE_EMAIL, FAKE_PASSWORD)
  })

  describe('data pulling functions', () => {
    beforeEach(() => {
      eight.me.cache.put(eight.me.userId, {})
    })

    it('should get intervals data', async () => {
      const intervals = await eight.me._pullIntervals()

      const previousSession = eight.me.cache.userGet(`previousSession`)

      // `leftUserId.nowHeating` is null so the latest session = previousSession
      assert.ok(previousSession)
    })

    it('should get device data', async () => {
      const deviceData = await eight.me._pullDeviceData()

      assert.ok(deviceData)

      assert.equal(deviceData.userId, 'leftUserId')
    })

    it('should get trends data', async () => {
      const trends = await eight.me._pullTrends()

      assert.equal(trends.length, 1)
      assert.equal(trends[0].day, '2021-01-31')
    })

    it('should get merge all data together', async () => {
      await eight.me._refresh()

      const user = eight.me.cache.get(eight.me.userId)
      const currentSession = eight.me.cache.userGet(`currentSession`)

      assert.ok(currentSession)
      assert.ok(user)
      assert.ok(currentSession.timeseries)
      assert.ok(currentSession.sleepFitnessScore)
      assert.ok(user.currentSession)

      assert.equal(user.heatingLevel, 10)
      assert.equal(currentSession.score, 80)
      assert.equal(currentSession.day, '2021-01-31')
      assert.equal(currentSession.timeseries.tnt.length, 1)
      assert.equal(currentSession.timeseries.tempRoomC.length, 1)
    })

  })

  after(() => {
    sinon.restore()
  })
})

