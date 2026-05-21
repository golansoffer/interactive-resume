// Resolves a logical asset path (e.g. '/icons/foo.svg', '/models/x.glb') to
// the URL it lives at under the deployed Vite base. Domain config holds
// leading-slash paths; this helper applies BASE_URL at the load boundary.
// BASE_URL always ends with '/' (Vite guarantee).
export const assetUrl = (path: string): string => {
  const base = import.meta.env.BASE_URL;
  const rel = path.startsWith('/') ? path.slice(1) : path;
  return `${base}${rel}`;
};
