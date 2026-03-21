// Glitch transition with chromatic aberration and block distortion
vec4 transition(vec2 uv) {
  vec2 block = floor(uv * 16.0);
  vec2 noiseUv = block / 64.0;
  noiseUv += floor(vec2(progress) * vec2(1200.0, 3500.0)) / 64.0;
  vec2 dist = progress > 0.0
    ? (fract(noiseUv) - 0.5) * 0.3 * (1.0 - progress)
    : vec2(0.0);

  // Chromatic aberration: offset R, G, B channels separately
  vec2 red = uv + dist * 0.2;
  vec2 green = uv + dist * 0.3;
  vec2 blue = uv + dist * 0.5;

  return vec4(
    mix(getFromColor(red), getToColor(red), progress).r,
    mix(getFromColor(green), getToColor(green), progress).g,
    mix(getFromColor(blue), getToColor(blue), progress).b,
    1.0
  );
}
