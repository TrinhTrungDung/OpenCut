/**
 * Wraps a gl-transitions compatible GLSL transition function body
 * with standard boilerplate (uniforms, samplers, main).
 *
 * The input `transitionGlsl` must define:
 *   vec4 transition(vec2 uv)
 *
 * It can use getFromColor(vec2) and getToColor(vec2) helpers,
 * plus the `progress` and `ratio` uniforms.
 */
export function wrapTransitionShader({
	transitionGlsl,
}: {
	transitionGlsl: string;
}): string {
	return `precision mediump float;

uniform sampler2D u_from;
uniform sampler2D u_to;
uniform float progress;
uniform float ratio;

varying vec2 v_texCoord;

vec4 getFromColor(vec2 uv) {
  return texture2D(u_from, uv);
}

vec4 getToColor(vec2 uv) {
  return texture2D(u_to, uv);
}

${transitionGlsl}

void main() {
  gl_FragColor = transition(v_texCoord);
}
`;
}
