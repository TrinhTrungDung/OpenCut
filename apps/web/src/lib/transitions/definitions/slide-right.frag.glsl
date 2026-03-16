vec4 transition(vec2 uv) {
  vec2 fromUv = uv - vec2(progress, 0.0);
  vec2 toUv = uv - vec2(progress - 1.0, 0.0);
  if (fromUv.x >= 0.0) {
    return getFromColor(fromUv);
  }
  return getToColor(toUv);
}
