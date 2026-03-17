/**
 * Shim for next/navigation — maps Next.js router hooks to React Router equivalents.
 * Uses useMemo to stabilize the router object and prevent infinite re-render loops
 * when components include `router` in useEffect dependency arrays.
 */
import { useMemo, useCallback } from "react";
import { useParams as useRouterParams, useNavigate, useLocation } from "react-router-dom";

export function useParams() {
  return useRouterParams();
}

export function useRouter() {
  const navigate = useNavigate();

  const push = useCallback((path: string) => navigate(path), [navigate]);
  const replace = useCallback((path: string) => navigate(path, { replace: true }), [navigate]);
  const back = useCallback(() => navigate(-1), [navigate]);
  const forward = useCallback(() => navigate(1), [navigate]);
  const refresh = useCallback(() => window.location.reload(), []);
  const prefetch = useCallback(() => {}, []);

  return useMemo(
    () => ({ push, replace, back, forward, refresh, prefetch }),
    [push, replace, back, forward, refresh, prefetch]
  );
}

export function usePathname() {
  return useLocation().pathname;
}

export function useSearchParams() {
  const location = useLocation();
  return new URLSearchParams(location.search);
}
