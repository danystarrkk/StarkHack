// The real route table replacing the template's `activeTab` state.
//
// Path → element (final table, decided by the parent):
//   /                             Home (real data via getRecentWriteups/getProjects)
//   /directory                    redirect → /writeups            (old URL preserved)
//   /machines/:platformId         redirect → /writeups?plataforma=:platformId (old URL)
//   /writeups                     WriteupsScreen
//   /writeups/:platformId/:slug   WriteupDetailRoute (resolves WriteupPage from the real pipeline)
//   /projects                     ProjectsScreen
//   /projects/:slug               ProjectDetailRoute (resolves ProjectPage from the real pipeline)
//   /certifications               CertificationsScreen
//   /about                        AboutScreen
//   *                             styled honest 404
//
// Every route renders inside the root layout (src/App.tsx: Navbar + <Outlet/>
// + Footer + terminal modal), so navigation chrome is identical to the old
// tabbed shell. ROUTES is exported as pure data so tests can drive it with
// createMemoryRouter; createAppRouter builds the browser router for the app.
import React from 'react';
import {
  createBrowserRouter,
  redirect,
  useNavigate,
  type RouteObject,
} from 'react-router-dom';
import App from '../App';
import { AboutScreen } from '../components/AboutScreen';
import { CertificationsScreen } from '../components/CertificationsScreen';
import { ProjectsScreen } from '../components/ProjectsScreen';
import { WriteupsScreen } from '../components/WriteupsScreen';
import { Home } from './Home';
import { NotFoundScreen } from './NotFound';
import { ProjectDetailRoute, WriteupDetailRoute } from './detailRoutes';
import { projectDetailPath, writeupDetailPath, writeupsFilterPath } from './paths';

// The exact <main> wrappers the tabbed shell used, so layout stays identical:
// list/home screens use the narrower container, certifications/about the wide one.
const LIST_MAIN = 'mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 pt-8 sm:pt-10 pb-12 flex-1';
const WIDE_MAIN = 'mx-auto w-full max-w-7xl px-3 sm:px-5 lg:px-6 pt-8 sm:pt-10 pb-12 flex-1';

const WriteupsRoute: React.FC = () => {
  const navigate = useNavigate();
  return (
    <main className={LIST_MAIN}>
      <WriteupsScreen
        onSelectWriteup={(writeup) =>
          navigate(
            writeup.platformId
              ? writeupDetailPath(writeup.platformId, writeup.id)
              : '/writeups'
          )
        }
      />
    </main>
  );
};

const ProjectsRoute: React.FC = () => {
  const navigate = useNavigate();
  return (
    <main className={LIST_MAIN}>
      <ProjectsScreen onSelectProject={(project) => navigate(projectDetailPath(project.id))} />
    </main>
  );
};

const CertificationsRoute: React.FC = () => (
  <main className={WIDE_MAIN}>
    <CertificationsScreen />
  </main>
);

const AboutRoute: React.FC = () => (
  <main className={WIDE_MAIN}>
    <AboutScreen />
  </main>
);

export const ROUTES: RouteObject[] = [
  {
    id: 'root',
    path: '/',
    element: <App />,
    children: [
      {
        id: 'home',
        index: true,
        element: (
          <main className={LIST_MAIN}>
            <Home />
          </main>
        ),
      },
      // Old URLs keep working via real redirects (loader-based, so direct
      // loads and in-app navigation both land on the new location).
      {
        id: 'redirect-directory',
        path: 'directory',
        element: null,
        loader: () => redirect('/writeups'),
      },
      {
        id: 'redirect-machines',
        path: 'machines/:platformId',
        element: null,
        loader: ({ params }) => redirect(writeupsFilterPath(params.platformId ?? '')),
      },
      { id: 'writeups', path: 'writeups', element: <WriteupsRoute /> },
      { id: 'writeup', path: 'writeups/:platformId/:slug', element: <WriteupDetailRoute /> },
      { id: 'projects', path: 'projects', element: <ProjectsRoute /> },
      { id: 'project', path: 'projects/:slug', element: <ProjectDetailRoute /> },
      { id: 'certifications', path: 'certifications', element: <CertificationsRoute /> },
      { id: 'about', path: 'about', element: <AboutRoute /> },
      { id: 'not-found', path: '*', element: <NotFoundScreen /> },
    ],
  },
];

export const createAppRouter = (): ReturnType<typeof createBrowserRouter> =>
  createBrowserRouter(ROUTES);
