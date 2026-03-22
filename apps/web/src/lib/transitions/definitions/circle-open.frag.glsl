// Radial circle reveal with ratio-corrected distance and smooth edge
vec4 transition(vec2 uv) {
  vec2 center = vec2(0.5);
  vec2 corrected = vec2(uv.x * ratio, uv.y);
  vec2 correctedCenter = vec2(0.5 * ratio, 0.5);
  float dist = distance(corrected, correctedCenter);
  float maxDist = distance(vec2(0.0, 0.0), correctedCenter);
  float edge = maxDist * progress;
  float smoothness = 0.02;
  float mask = smoothstep(edge - smoothness, edge + smoothness, dist);
  return mix(getToColor(uv), getFromColor(uv), mask);
}
