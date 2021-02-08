const assert = require(`assert`)
const sinon = require(`sinon`)

const utils = require(`../src/utils`)
const EightSleepBase = require(`../src/base`)
const EightSleepSide = require(`../src/side`)

const FAKE_EMAIL = 'fake@email.com'
const FAKE_PASSWORD = '123'

describe('cache', () => {
  const CACHED_KEY = 'test'
  const CACHED_DOT_KEY = 'test.user.id'

  const CACHED_VALUE = '123'
  const CACHED_OBJECT = {
    id: CACHED_VALUE,
    username: FAKE_EMAIL,
  }

  const CACHED_ARRAY = [
    { ...CACHED_OBJECT },
  ]

  let cache = new utils.Cache({})

  it('should put and get from cache', () => {
    cache.put(CACHED_KEY, CACHED_VALUE)

    const value = cache.get(CACHED_KEY)

    assert.equal(value, CACHED_VALUE)

    cache.put(CACHED_KEY, null)
  })

  it('should merge object into cache', () => {
    // Initial value
    cache.put(CACHED_KEY, { side: 'right' })

    // Merge in new keys
    cache.merge(CACHED_KEY, CACHED_OBJECT)

    const value = cache.get(CACHED_KEY)

    assert.equal(value.id, CACHED_VALUE)
    assert.equal(value.side, 'right')
    assert.equal(value.username, FAKE_EMAIL)
  })

  it('should merge array into array in cache', () => {
    // Set initial value
    cache.put(CACHED_KEY, [
      {
        username: FAKE_EMAIL,
        otherKey: '123',
        id: '456'
      },
      {
        username: 'otherFake@email2.com',
      },
    ])

    // Merge in new keys
    cache.merge(CACHED_KEY, CACHED_ARRAY, 'username')

    // Coincidence that the first one return is the one changed.
    const [ matching ] = cache.get(CACHED_KEY)

    assert.equal(matching.username, FAKE_EMAIL)

    // Make sure other keys weren't overwritten
    assert.equal(matching.otherKey, '123')

    // Make sure keys were overwritten with new data
    assert.equal(matching.id, '123')
  })

  it('should get dot key', () => {
    // Initial value
    cache.put('test', { user: { id: '789' } })

    // `test.user.id`
    const value = cache.get(CACHED_DOT_KEY)

    assert.equal(value, '789')
  })
})

