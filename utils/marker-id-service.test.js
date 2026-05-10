const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const { normalizeMarkerId } = require('./marker-id-service')
const { toSdkMarkerId } = require('./marker-id-service')

test('normalizeMarkerId accepts numeric and string marker ids', () => {
  assert.equal(normalizeMarkerId(1710000000000), 1710000000000)
  assert.equal(normalizeMarkerId('1710000000000'), 1710000000000)
  assert.equal(normalizeMarkerId(' 1710000000000 '), 1710000000000)
})

test('normalizeMarkerId rejects empty, invalid and non-finite ids', () => {
  assert.equal(normalizeMarkerId(''), null)
  assert.equal(normalizeMarkerId('abc'), null)
  assert.equal(normalizeMarkerId('123abc'), null)
  assert.equal(normalizeMarkerId(Number.NaN), null)
  assert.equal(normalizeMarkerId(null), null)
})

test('toSdkMarkerId uses small positive integers instead of business ids', () => {
  assert.equal(toSdkMarkerId(0), 1)
  assert.equal(toSdkMarkerId(8), 9)
  assert.equal(toSdkMarkerId(1740000000000), null)
  assert.equal(toSdkMarkerId(-1), null)
  assert.equal(toSdkMarkerId(Number.NaN), null)
})

test('index marker tap avoids passing nullable UTS markerId into any helper', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'pages', 'index', 'index.uvue'), 'utf8')
  assert.equal(source.includes('normalizeMarkerIdLocal(detail.markerId)'), false)
  assert.match(source, /const rawMarkerId = detail\.markerId[\s\S]*if \(rawMarkerId == null\)[\s\S]*const markerId = rawMarkerId as number/)
})

test('index map renders sdk marker ids and maps taps back to business markers', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'pages', 'index', 'index.uvue'), 'utf8')
  assert.match(source, /id: sdkMarkerIdForIndex\(index\)/)
  assert.match(source, /function findBySdkMarkerId\(sdkMarkerId: number\): CheckinMarker \| null/)
  assert.match(source, /const marker = findBySdkMarkerId\(markerId\)/)
  assert.equal(source.includes('const marker = findById(markerId)'), false)
})
