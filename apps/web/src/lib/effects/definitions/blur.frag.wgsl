struct Uniforms {
  resolution: vec2f,
  sigma: f32,
  direction: vec2f,
};

@group(0) @binding(0) var u_texture: texture_2d<f32>;
@group(0) @binding(1) var u_sampler: sampler;
@group(0) @binding(2) var<uniform> u: Uniforms;

@fragment
fn main(@location(0) texCoord: vec2f) -> @location(0) vec4f {
  let texelSize = 1.0 / u.resolution;

  var color = vec4f(0.0);
  var totalWeight: f32 = 0.0;

  // 61-tap Gaussian blur (i = -30..30), matching the GLSL version
  for (var i: i32 = -30; i <= 30; i++) {
    let fi = f32(i);
    let weight = exp(-(fi * fi) / (2.0 * u.sigma * u.sigma));
    let offset = texelSize * u.direction * fi;
    color += textureSample(u_texture, u_sampler, texCoord + offset) * weight;
    totalWeight += weight;
  }

  return color / totalWeight;
}
