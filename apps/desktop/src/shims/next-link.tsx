/**
 * Shim for next/link — wraps React Router's Link component
 */
import React from "react";
import { Link as RouterLink } from "react-router-dom";

interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  prefetch?: boolean;
  children: React.ReactNode;
}

function Link({ href, prefetch, children, ...props }: LinkProps) {
  return (
    <RouterLink to={href} {...props}>
      {children}
    </RouterLink>
  );
}

export default Link;
