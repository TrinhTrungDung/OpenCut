// Wipe down with anti-aliased edge via smoothstep
vec4 transition(vec2 uv) {
  float edge = 0.02;
  float mask = smoothstep(progress - edge, progress + edge, 1.0 - uv.y);
  return mix(getToColor(uv), getFromColor(uv), mask);
}
