struct Uniforms {
  colorRow0: vec4f,
  colorRow1: vec4f,
  colorRow2: vec4f,
  colorRow3: vec4f,
  temperature: f32,
  tint: f32,
  highlights: f32,
  shadows: f32,
  hueShift: f32,
};

@group(0) @binding(0) var u_texture: texture_2d<f32>;
@group(0) @binding(1) var u_sampler: sampler;
@group(0) @binding(2) var<uniform> u: Uniforms;

fn rgb2hsv(c: vec3f) -> vec3f {
  let K = vec4f(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  let p = mix(vec4f(c.b, c.g, K.w, K.z), vec4f(c.g, c.b, K.x, K.y), step(c.b, c.g));
  let q = mix(vec4f(p.x, p.y, p.w, c.r), vec4f(c.r, p.y, p.z, p.x), step(p.x, c.r));
  let d = q.x - min(q.w, q.y);
  let e: f32 = 1.0e-10;
  return vec3f(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

fn hsv2rgb(c: vec3f) -> vec3f {
  let K = vec4f(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  let p = abs(fract(vec3f(c.x) + K.xyz) * 6.0 - vec3f(K.w));
  return c.z * mix(vec3f(K.x), clamp(p - vec3f(K.x), vec3f(0.0), vec3f(1.0)), c.y);
}

@fragment
fn main(@location(0) texCoord: vec2f) -> @location(0) vec4f {
  let texel = textureSample(u_texture, u_sampler, texCoord);

  // 1. Apply color matrix (brightness, contrast, exposure, saturation)
  let colorMatrix = mat4x4f(u.colorRow0, u.colorRow1, u.colorRow2, u.colorRow3);
  var color = (colorMatrix * vec4f(texel.rgb, 1.0)).xyz;

  // 2. Temperature & tint
  color.x += u.temperature * 0.1;
  color.z -= u.temperature * 0.1;
  color.y += u.tint * 0.1;

  // 3. Highlights & shadows (luminance-weighted)
  let W = vec3f(0.2126, 0.7152, 0.0722);
  let lum = dot(color, W);
  let highlightMask = smoothstep(0.3, 0.7, lum);
  let shadowMask = 1.0 - highlightMask;
  color += u.highlights * highlightMask;
  color += u.shadows * shadowMask;

  // 4. Hue shift
  if (abs(u.hueShift) > 0.001) {
    var hsv = rgb2hsv(color);
    hsv.x = fract(hsv.x + u.hueShift / 360.0);
    color = hsv2rgb(hsv);
  }

  return vec4f(clamp(color, vec3f(0.0), vec3f(1.0)), texel.a);
}
