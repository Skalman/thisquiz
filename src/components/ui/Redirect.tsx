import { useEffect } from "preact/hooks";
import { useLocation } from "preact-iso";
import { Loading } from "./Loading.tsx";

/** Replaces the address with `to`, waiting meanwhile. */
export function Redirect({ to }: { to: string }) {
  const { route } = useLocation();
  useEffect(() => {
    route(to, true);
  }, [to, route]);
  return <Loading />;
}
