struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) texCoord: vec2f,
};

@vertex
fn main(@location(0) a_position: vec2f) -> VertexOutput {
  var output: VertexOutput;
  // Flip Y for WebGPU (top-left origin vs WebGL bottom-left)
  output.texCoord = vec2f(a_position.x * 0.5 + 0.5, 1.0 - (a_position.y * 0.5 + 0.5));
  output.position = vec4f(a_position, 0.0, 1.0);
  return output;
}
