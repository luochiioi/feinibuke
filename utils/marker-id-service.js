function normalizeMarkerId(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed.length === 0) return null
    const n = Number(trimmed)
    return Number.isFinite(n) && String(n) === trimmed ? n : null
  }
  return null
}

function toSdkMarkerId(markerIndex) {
  if (!Number.isInteger(markerIndex)) return null
  if (markerIndex < 0 || markerIndex > 2147483646) return null
  return markerIndex + 1
}

module.exports = { normalizeMarkerId, toSdkMarkerId }
