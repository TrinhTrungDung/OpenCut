vec4 transition(vec2 uv) {
  return mix(getFromColor(uv), getToColor(uv), step(1.0 - uv.x, progress));
}
