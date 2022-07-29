import React from 'react';
import './styles.css';
import 'bootstrap/dist/css/bootstrap.min.css';

import { Card } from 'react-bootstrap';
import { useState } from 'react';

import { LookupForm } from './LookupForm/LookupForm';
import { LegDataNav } from './LegDataNav/LegDataNav';
const LegViewer = React.lazy(() => import('./LegViewer/LegViewer'));

const iconUrl = [
  'https://cdn.discordapp.com/attachments/',
  '836842421501034546/1001702584807071804/',
  'transparent_profile.png'
].join('');

export const App = () => {
  const [legData, setLegData] = useState(null as any);
  const [key, setKey] = useState('addrInfo');
  const [automated, setAutomated] = useState(null as any);

  function reset() {
    setLegData(null);
    setKey('addrInfo');
    setAutomated(null);
  }

  function retry(address: string) {
    setAutomated({ address, run: true });
    setLegData(null);
  }

  return (
    <Card className='Card App'>
      <Card.Header className='Card-Header'>
        <a href='https://www.NonPartisanDE.org'>
          <img alt='icon' src={iconUrl} />
          <span>Non-Partisan Delaware: Legislator Lookup</span>
        </a>
        {legData && <LegDataNav setKey={setKey} reset={reset} />}
      </Card.Header>
      <Card.Body className='Card-Body'>
        {!legData && (
          <LookupForm setLegData={setLegData} automated={automated} />
        )}
        {legData && (
          <LegViewer
            legData={legData}
            navKey={key}
            reset={reset}
            retry={retry}
          />
        )}
      </Card.Body>
    </Card>
  );
};
