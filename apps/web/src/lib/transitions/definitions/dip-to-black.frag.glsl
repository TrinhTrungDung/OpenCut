// Dip to black: fade out to black, then fade in from black
vec4 transition(vec2 uv) {
  vec4 black = vec4(0.0, 0.0, 0.0, 1.0);
  if (progress < 0.5) {
    float p = progress * 2.0;
    return mix(getFromColor(uv), black, p);
  } else {
    float p = (progress - 0.5) * 2.0;
    return mix(black, getToColor(uv), p);
  }
}
