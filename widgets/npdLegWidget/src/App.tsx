import React, { useState } from 'react';
import { Card, CardContent, CardHeader, Link } from '@mui/material';

import styles from './styles.module.css';

import { LookupForm } from './LookupForm/LookupForm';
import { LegDataNav } from './LegDataNav/LegDataNav';
import { LegViewer } from './LegViewer/LegViewer';

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
    <Card sx={{ flexGrow: 1 }} className={styles['Card']}>
      <CardHeader
        avatar={ <img alt='NPD Logo' src={iconUrl} /> }
        title={
          <Link
            href='https://www.NonPartisanDE.org'
            variant='body1'
            rel='noopener'
            target='_blank'
            underline='hover'
            fontWeight='bold'
          >
            <span>Non-Partisan Delaware: Legislator Lookup</span>
          </Link>
        }
        action={ legData && <LegDataNav setKey={setKey} reset={reset} /> }
        
        className={styles['Card-Header']}
      />
      <CardContent className={styles['Card-Body']}>
        {
          !legData && <LookupForm setLegData={setLegData} automated={automated} />
        }
        {
          legData &&
            <LegViewer
              legData={legData}
              navKey={key}
              reset={reset}
              retry={retry}
            />
        }
      </CardContent>
    </Card>
  );
};
