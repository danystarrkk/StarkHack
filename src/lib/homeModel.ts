// Home content model: the single orchestration behind the Home screen
// (src/lib/Home.tsx). One fetch of the real content pipeline (public/index.json
// via lib/content.ts) feeds the two Home sections, mapped to UI types by the
// pure adapters in src/lib/contentAdapter.ts. No mock data on the Home screen.
//
// Honesty rule (home-featured-projects): la grilla muestra los 3 writeups y
// los 3 proyectos MÁS RECIENTES (regla compartida mostRecentByDate: fecha
// descendente + desempate estable por orden del índice), mientras que los
// contadores reportan el TOTAL REAL de proyectos del índice. La grilla se
// achica, pero los contadores nunca mienten sobre el tamaño del archivo.
//
// `getProjects()` keeps its full contract (it is also /projects and the
// terminal `projects` command): the Home takes the featured slice here, from
// the SAME fetch that supplies the total — one request, no drift.
import { getProjects, getRecentWriteups, mostRecentByDate } from '../../lib/content';
import { toUiProject, toUiWriteup } from './contentAdapter';
import type { Project, Writeup } from '../types';

// How many entries each Home grid shows.
export const HOME_WRITEUP_COUNT = 3;
export const HOME_PROJECT_COUNT = 3;

export interface HomeContent {
  writeups: Writeup[];
  projects: Project[];
  projectTotal: number;
}

export const loadHomeContent = async (): Promise<HomeContent> => {
  const [recentWriteups, allProjects] = await Promise.all([
    getRecentWriteups(HOME_WRITEUP_COUNT),
    getProjects(),
  ]);
  // Positions are the DISPLAYED positions (#01 = most recent), never invented.
  const featured = mostRecentByDate(allProjects, HOME_PROJECT_COUNT);
  return {
    writeups: recentWriteups.map(toUiWriteup),
    projects: featured.map((item, index) => toUiProject(item, index + 1)),
    projectTotal: allProjects.length,
  };
};
