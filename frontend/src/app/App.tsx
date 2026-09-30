import { RouterProvider } from 'react-router-dom';

import { Providers } from './providers.tsx';
import { router } from './router.tsx';

export function App() {
  return (
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  );
}
