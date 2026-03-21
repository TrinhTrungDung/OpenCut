// Crosswarp-style zoom-in transition
vec4 transition(vec2 uv) {
  float x = smoothstep(0.0, 1.0, progress * 2.0 + uv.x - 1.0);
  vec2 fromUv = (uv - 0.5) * (1.0 - x) + 0.5;
  vec2 toUv = (uv - 0.5) * x + 0.5;
  return mix(getFromColor(fromUv), getToColor(toUv), x);
}
