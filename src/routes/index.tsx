import type { JSX } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { SceneWidget } from '../features/scene/widget/scene/SceneWidget';

export const Route = createFileRoute('/')({
  component: IndexPage,
});

function IndexPage(): JSX.Element {
  return <SceneWidget />;
}
