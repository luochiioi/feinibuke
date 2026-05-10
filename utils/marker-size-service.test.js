const assert = require('node:assert/strict')
const test = require('node:test')

const { markerSizeForScale } = require('./marker-size-service')

test('markerSizeForScale shrinks pins at low map scale', () => {
  assert.equal(markerSizeForScale(4), 22)
  assert.equal(markerSizeForScale(10), 22)
  assert.equal(markerSizeForScale(11), 28)
  assert.equal(markerSizeForScale(13), 28)
  assert.equal(markerSizeForScale(14), 34)
  assert.equal(markerSizeForScale(16), 34)
  assert.equal(markerSizeForScale(17), 40)
  assert.equal(markerSizeForScale(20), 40)
})
