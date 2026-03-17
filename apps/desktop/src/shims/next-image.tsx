/**
 * Shim for next/image — renders a standard <img> element
 */
import React from "react";

interface ImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  fill?: boolean;
  priority?: boolean;
  quality?: number;
  placeholder?: string;
  blurDataURL?: string;
}

function Image({ src, alt, width, height, fill, priority, quality, placeholder, blurDataURL, ...props }: ImageProps) {
  const style: React.CSSProperties = fill
    ? { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", ...props.style }
    : props.style || {};

  return <img src={src} alt={alt} width={width} height={height} style={style} loading={priority ? "eager" : "lazy"} {...props} />;
}

export default Image;
