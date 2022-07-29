import { StrictMode } from 'react';
import ReactDOMClient from 'react-dom/client';

import { App } from './App';

const template = <StrictMode><App /></StrictMode>;

document.querySelectorAll('.NpdLegWidget-container')
  .forEach(container => ReactDOMClient.createRoot(container).render(template));
