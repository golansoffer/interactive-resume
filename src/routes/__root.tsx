import type { JSX } from 'react';
import { useSyncExternalStore } from 'react';
import { createRootRoute, Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/router-devtools';
import { readDeviceSupport, subscribeDeviceSupport } from '@/lib/deviceSupport';
import { UnsupportedDevice } from '@/components/UnsupportedDevice';

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout(): JSX.Element {
  const support = useSyncExternalStore(subscribeDeviceSupport, readDeviceSupport);
  switch (support.kind) {
    case 'unsupported':
      return <UnsupportedDevice />;
    case 'desktop':
      return (
        <>
          <Outlet />
          {import.meta.env.DEV ? <TanStackRouterDevtools /> : null}
        </>
      );
  }
}
