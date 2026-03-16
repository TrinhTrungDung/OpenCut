vec4 transition(vec2 uv) {
  float scale = 1.0 + progress;
  vec2 center = vec2(0.5);
  vec2 fromUv = (uv - center) * scale + center;
  vec4 fromColor = getFromColor(fromUv);
  return mix(fromColor, getToColor(uv), progress);
}
