import {createRoot} from 'react-dom/client';
import {RouterProvider} from 'react-router-dom';
import {createAppRouter} from './lib/router.tsx';
import './index.css';

const router = createAppRouter();

createRoot(document.getElementById('root')!).render(<RouterProvider router={router} />);
