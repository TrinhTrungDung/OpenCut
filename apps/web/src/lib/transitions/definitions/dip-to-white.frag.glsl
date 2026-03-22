// Dip to white: fade out to white, then fade in from white
vec4 transition(vec2 uv) {
  vec4 white = vec4(1.0, 1.0, 1.0, 1.0);
  if (progress < 0.5) {
    float p = progress * 2.0;
    return mix(getFromColor(uv), white, p);
  } else {
    float p = (progress - 0.5) * 2.0;
    return mix(white, getToColor(uv), p);
  }
}
