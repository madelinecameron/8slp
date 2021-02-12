# 8slp

Client for unpublished EightSleep API.

This client is a v1 and has some wishlist items _you_ could help implement:
- Calling methods `score()` on past sessions
- Implementing a better cache
- More tests!
- Improved documentation

## Installation

`npm install --save 8slp`

`yarn install 8slp`

## Usage

```javascript
const EightSleep = require('8slp')

const eightSleep = new EightSleep('America/New_York')
await eightSleep.authenticate('fakeemail@email.com', 'hunter7')

const isActive = eightSleep.me.isHeating()
const mySide = eightSleep.me.whoami()

console.log(`I sleep on the ${mySide} side of the bed.`)

if (isActive) {
  console.log(`My side of the bed is currently on!`)
}

const [date, roomTempC, roomTempF] = eightSleep.me.roomTemp()

console.log(`My room is currently ${roomTempF}F`)
```

## API

`EightSleep` is the global class that contains and manages info for both sides of the bed. When `authenticate` is called, three members are instantiated: `me`, `left` and `right`.

Each of these members can call methods to get specific info about that side of the bed. `me` is an alias the side of the logged-in user.

### new EightSleep

Internal cache can be directly accessed using `<instance>.cache`

- `async authenticate(email, password): void`
	- Authenticate using the given email and password
	- After authentication, `getSides` and `currentDeviceId` are called and return values persisted to internal cache
	- Returns void
- `async getSides(): [ leftUserId, rightUserId ]`
	- Get user IDs for both sides of the Pod
	- Persists return to internal cache
	- Returns user IDs as array
- `async currentDeviceId(): string
	- Get current device ID of the account
	- Persists return to internal cache
	- Returns device ID

## Sides

After instantiating `new EightSleep` and calling `authenticate()`, your instance will have `me`, `left` and `right` populated with instatiated classes of `EightSleepSide`. These sides can individually be addressed and have information requested about the current session or past sessions.

Internal cache can be addressed directly with `eightSleep.<side>.cache`, useful for retrieving info of all previous sessions rather than just current or a dump of previous

- `async refresh()`
	- Request refresh data, useful for getting up-to-date info of current session
	- Data is persisted to internal cache and retrievable through following methods
- `whoami()`
	- Returns either `left` or `right`. Useful for determining which side `me` is referencing
- `async setLevel(level: number, duration: number): object`
	- Set desired heating / cooling level for a specific duration
	- Levels range from 0 - 100
		- TODO: Figure out the mapping between app and 0 - 100 levels
	- Returns response from API call (I dunno)
- `isHeating(): boolean`
	- Whether the side is currently on, has nothing to do with what level it is on, just that is active.
- `targetLevel(): number`
	- Heating / cooling level being targeted by the side
- `lastSeen(): datestring`
	- Datestring of the last time this side was active
- `status(): object`
	- Object of `[ targetHeatingLevel, heatingLevel, heatingDuration, nowHeating, presenceEnd ]`
	- Useful for gathering info from `isHeating()`, `targetLevel()`, and `lastSeen()` in one call
- `session({ [date] }): object`
	- Takes optional date param
		- If `date` is not specified, it tries to return current session. If a session isn't active, it returns null
	- Returns dump of information about a session: trends, intervals and scores.
		- If you want _all the info_ at once, use this.
- `sleepStage(): string`
	- Get the latest sleep stage of the current session
	- If a session is not active, returns null
- `roomTemp(): [ date, roomTempC, roomTempF ]`
	- Get the latest room temp event of the current session
	- If a session is not active, returns null
- `bedTemp(): [ date, bedTempC, bedTempF ]`
	- Get the latest bed temp event of the current session
	- If a session is not active, returns null
- `tossAndTurns(): [ date, tossAndTurns ]`
	- Get the latest toss-and-turns event of the current session
	- If a session is not active, returns null
- `heartRate(): [ date, heartRate ]`
	- Get the latest heart-rate event of the current session
	- If a session is not active, returns null
- `heartRateVariability(): [ date, heartRateVariability ]`
	- Get the latest heart-rate variability event of the current session
	- If a session is not active, returns null
- `respiratoryRate(): [ date, respiratoryRate ]`
	- Get the latest respiratory rate event of the current session
	- If a session is not active, returns null
- `scores({ [date] }): object`
	- Takes optional date param
		- If `date` is not specified, it tries to return current session. If a session isn't active, it returns null
	- Returns base scores for given session
		- `score`
		- `sleepFitnessScore`
			- `total`
			- `sleepDurationSeconds (Score Object)`
				- `current`
				- `average`
				- `score`
				- `weighted`
			- `latencyAsleepSeconds (Score Object)`
			- `latencyOutSeconds (Score Object)`
			- `wakeupConsistency(Score Object)`
- `sleepBreakdown({ [date] }): object`
	- Summarized sleep breakdown by stages
	- Returns map of `{ awake, light, deep, rem }` total duration of given session
- `previousSession(): object`
	- Returns dump of information about previous session: trends, intervals and scores.
		- If you want _all the info_ at once, use this.

## Cache

The main class, `me`, `left` and `right` share a cache (actually just an object) to share information and prevent re-requesting information

- `get(key)`
	- Get a specific key
	- Allows nested keys such as `"<userId>.currentSession"`
- `put(key, value)
	- Overwrite a specific key
	- Allows nested keys such as `"<userId>.currentSession"`
- `userGet(key)`
	- Only works on `me`, `left` and `right`
	-  Allows nested keys such as `"<userId>.currentSession"`
	- Allows you to skip adding `<userId>` in `get` calls
- `userPut(key, value)`
	- Only works on `me`, `left` and `right`
	- Allows nested keys such as `"<userId>.currentSession"`
	- Allows you to skip adding `<userId>` in `put` calls
- `merge(key, value, [mergeKey])`
	- `mergeKey` is only necessary when merging arrays
		- If you want to merge elements on `date`, you would pass 'date' as `mergeKey`
	- Merge objects or arrays in the cache together
		- `value` gets precedence and overwrites pre-existing values
		- Allows nested keys such as `"<userId>.currentSession"`
