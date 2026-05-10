function markerSizeForScale(scale) {
  if (scale <= 10) return 22
  if (scale <= 13) return 28
  if (scale <= 16) return 34
  return 40
}

module.exports = { markerSizeForScale }
