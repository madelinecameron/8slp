const assert = require(`assert`)
const sinon = require(`sinon`)

const utils = require(`../src/utils`)
const EightSleepBase = require(`../src/base`)

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
}

describe('base', () => {
  before(() => {
    sinon.stub(utils, `makeRequest`).callsFake(({ url, method }) => {
      // TODO Check method
      const res = RESPONSE_MAP[url]

      return res
    })
  })

  it('should create side classes on authentication', async () => {
    const eight = new EightSleepBase(`America/New_York`)

    await eight.authenticate(FAKE_EMAIL, FAKE_PASSWORD)

    assert.equal(eight.left.userId, 'leftUserId')
    assert.equal(eight.left.side, 'left')

    assert.equal(eight.right.userId, 'rightUserId')
    assert.equal(eight.right.side, 'right')

    assert.equal(eight.me.side, 'left')
  })

  after(() => {
    sinon.restore()
  })
})
