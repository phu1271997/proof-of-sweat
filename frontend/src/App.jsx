import React from 'react';
import { useRoute } from './lib/nav.js';
import Landing from './pages/Landing.jsx';
import AppPage from './pages/AppPage.jsx';

export default function App() {
  const route = useRoute();
  return route.startsWith('/app') ? <AppPage /> : <Landing />;
}
