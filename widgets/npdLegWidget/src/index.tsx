import { StrictMode } from 'react';
import ReactDOMClient from 'react-dom/client';

import { App } from './App';

const parseQs = () => {
  if (!window.location.search) return {};
  const qs = window.location.search.substring(1);
  const pairs = qs.split('&');
  const ret: { [key: string]: string } = {};
  pairs.forEach((pair) => {
    const kvPair = pair.split('=');
    ret[kvPair[0]] = kvPair[1];
  });
  return ret;
};

const qs = parseQs();
const rootElementId = qs.rootElementId || 'root';
const rootElement = document.getElementById(rootElementId);
const root = ReactDOMClient.createRoot(rootElement as HTMLElement);

root.render(
  <StrictMode>
    <App />
  </StrictMode>
);
