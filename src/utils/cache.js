function bothAreArrays(a, b) {
  return Array.isArray(a) && Array.isArray(b)
}

function bothAreObjects(a, b) {
  return typeof a === `object` && typeof b === `object`
}

const $cache = Symbol(`cache`)

class Cache {
  constructor(cache, userId) {
    this[$cache] = cache

    this.userId = userId
  }

  userGet(key) {
    return this.get(`${this.userId}.${key}`)
  }

  userPut(key, value) {
    return this.put(`${this.userId}.${key}`, value)
  }

  get(key) {
    const cache = this[$cache]

    if (key.includes(`.`)) {
      return this._recursiveCacheGet(cache, key)
    }

    return (cache && cache[key]) || null
  }

  put(key, value) {
    const cache = this[$cache]

    if (key.includes(`.`)) {
      return this._recursiveCachePut(cache, key, value)
    }

    cache[key] = value
  }

  merge(key, toMergeValue, mergeKey = null) {
    const currentValue = this.get(key)

    if (!currentValue) {
      return this.put(key, toMergeValue)
    }

    if (bothAreArrays(toMergeValue, currentValue)) {
      // Probably should never trigger since only bad
      // code can trigger this
      if (!mergeKey) {
        throw new Error(`cannot merge arrays without a merge key`)
      }

      function getMatching(array, key, val) {
        return array.find((_val) => _val[key] === val)
      }

      // Abuse how objects work and write directly to them
      toMergeValue.forEach((val) => {
        const mergeValue = val[mergeKey]
        let matchingValue = getMatching(currentValue, mergeKey, mergeValue)

        if (!matchingValue) {
          currentValue.push(val)
        } else {
          Object.assign(matchingValue, val)
        }
      })
    } else if (bothAreObjects(toMergeValue, currentValue)) {
      const newValue = {
        ...currentValue,
        ...toMergeValue
      }

      this.put(key, newValue)
    } else {
      throw new Error(`cannot merge non-arrays or non-objects`)
    }

  }

  _recursiveCachePut(parentValue, key, value) {
    let _key = key
    if (typeof key === `string`) {
      _key = key.split(`.`)
    }

    const [ topKey, ...remainingKey ] = _key

    // At leaf
    if (remainingKey.length === 0) {
      parentValue[topKey] = value

      return
    }

    if (!parentValue[topKey]) {
      // TODO Handle arrays
      parentValue[topKey] = {}
    }

    const newParentValue = parentValue[topKey]

    return this._recursiveCachePut(newParentValue, remainingKey, value)
  }

  _recursiveCacheGet(parentValue, key) {
    let _key = key
    if (typeof key === `string`) {
      _key = key.split(`.`)
    }

    const [ topKey, ...remainingKey ] = _key

    // At leaf
    if (remainingKey.length === 0) {
      return parentValue[topKey]
    }

    if (!parentValue[topKey]) {
      return null
    }

    const newParentValue = parentValue[topKey]

    return this._recursiveCacheGet(newParentValue, remainingKey)
  }
}

module.exports = Cache
