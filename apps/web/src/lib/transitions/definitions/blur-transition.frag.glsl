// Blur transition using resolution-independent sampling
// Blur peaks at midpoint (progress=0.5) via parabolic strength curve
vec4 transition(vec2 uv) {
  float strength = progress * (1.0 - progress) * 4.0;
  vec4 color = vec4(0.0);
  float total = 0.0;
  float radius = strength * 0.03;

  for (int i = -3; i <= 3; i++) {
    for (int j = -3; j <= 3; j++) {
      float fi = float(i);
      float fj = float(j);
      vec2 offset = vec2(fi, fj * ratio) * radius;
      float weight = exp(-(fi * fi + fj * fj) / max(radius * 200.0, 0.001));
      color += mix(getFromColor(uv + offset), getToColor(uv + offset), progress) * weight;
      total += weight;
    }
  }

  return color / total;
}
