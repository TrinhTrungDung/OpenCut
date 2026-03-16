float random(vec2 co) {
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

vec4 transition(vec2 uv) {
  float noise = random(uv);
  float threshold = smoothstep(progress - 0.1, progress + 0.1, noise);
  return mix(getToColor(uv), getFromColor(uv), threshold);
}
