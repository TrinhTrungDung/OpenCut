precision mediump float;

uniform sampler2D u_texture;
uniform vec2 u_resolution;

// Color matrix as 4 vec4 columns (setUniforms only supports up to vec4)
uniform vec4 u_colorRow0;
uniform vec4 u_colorRow1;
uniform vec4 u_colorRow2;
uniform vec4 u_colorRow3;

// Non-linear adjustments (normalized -1 to 1)
uniform float u_temperature;
uniform float u_tint;
uniform float u_highlights;
uniform float u_shadows;
uniform float u_hueShift;

varying vec2 v_texCoord;

vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
  vec4 texel = texture2D(u_texture, v_texCoord);

  // 1. Apply color matrix (brightness, contrast, exposure, saturation)
  mat4 colorMatrix = mat4(u_colorRow0, u_colorRow1, u_colorRow2, u_colorRow3);
  vec3 color = (colorMatrix * vec4(texel.rgb, 1.0)).rgb;

  // 2. Temperature & tint
  color.r += u_temperature * 0.1;
  color.b -= u_temperature * 0.1;
  color.g += u_tint * 0.1;

  // 3. Highlights & shadows (luminance-weighted)
  const vec3 W = vec3(0.2126, 0.7152, 0.0722);
  float lum = dot(color, W);
  float highlightMask = smoothstep(0.3, 0.7, lum);
  float shadowMask = 1.0 - highlightMask;
  color += u_highlights * highlightMask;
  color += u_shadows * shadowMask;

  // 4. Hue shift
  if (abs(u_hueShift) > 0.001) {
    vec3 hsv = rgb2hsv(color);
    hsv.x = fract(hsv.x + u_hueShift / 360.0);
    color = hsv2rgb(hsv);
  }

  gl_FragColor = vec4(clamp(color, 0.0, 1.0), texel.a);
}
