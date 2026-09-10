import React from 'react';
import { useRoute } from './lib/nav.js';
import Landing from './pages/Landing.jsx';
import AppShell from './pages/AppShell.jsx';

const APP_ROUTES = ['/app', '/post', '/explorer'];

export default function App() {
  const route = useRoute();
  const inApp = APP_ROUTES.some((p) => route === p || route.startsWith(`${p}/`));
  return inApp ? <AppShell /> : <Landing />;
}
