const assert = require('node:assert/strict')
const test = require('node:test')

const { isAllowedCloudURL } = require('./photo-service')

test('isAllowedCloudURL accepts cloud:// URL inside checkin-photos namespace', () => {
  assert.equal(
    isAllowedCloudURL('cloud://test-env.test-space/checkin-photos/uid-1/1746748800000_p.jpg'),
    true
  )
})

test('isAllowedCloudURL accepts https URL inside checkin-photos namespace', () => {
  assert.equal(
    isAllowedCloudURL('https://example-service.com/checkin-photos/uid-1/p.jpg'),
    true
  )
})

test('isAllowedCloudURL rejects URL outside checkin-photos namespace', () => {
  assert.equal(
    isAllowedCloudURL('cloud://test-env.test-space/other-bucket/uid-1/p.jpg'),
    false
  )
})

test('isAllowedCloudURL rejects path traversal attempts', () => {
  assert.equal(
    isAllowedCloudURL('cloud://test/checkin-photos/../sensitive/p.jpg'),
    false
  )
})

test('isAllowedCloudURL rejects empty / non-string inputs', () => {
  assert.equal(isAllowedCloudURL(''), false)
  assert.equal(isAllowedCloudURL('   '), false)
  assert.equal(isAllowedCloudURL(null), false)
  assert.equal(isAllowedCloudURL(undefined), false)
  assert.equal(isAllowedCloudURL(123), false)
})

test('isAllowedCloudURL rejects pathologically long URLs', () => {
  const huge = 'cloud://x/checkin-photos/' + 'a'.repeat(1100)
  assert.equal(isAllowedCloudURL(huge), false)
})
