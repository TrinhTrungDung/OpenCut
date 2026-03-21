// Wipe up with anti-aliased edge via smoothstep
vec4 transition(vec2 uv) {
  float edge = 0.02;
  float mask = smoothstep(progress - edge, progress + edge, uv.y);
  return mix(getFromColor(uv), getToColor(uv), mask);
}
