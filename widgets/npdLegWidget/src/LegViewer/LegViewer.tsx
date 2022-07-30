import { GeoLocation } from '../types/GeoLocation';
import { CountyCard } from '../CountyCard/CountyCard';
import { AddressCard } from '../AddressCard/AddressCard';
import { LegCard } from '../LegCard/LegCard';

import styles from './LegViewer.module.css';
import lookupStyles from '../LookupForm/LookupForm.module.css';
import { Button, Card, CardContent, Stack, Typography } from '@mui/material';

type Props = {
  legData: GeoLocation | { error: string };
  navKey: string;
  reset: () => void;
  retry: (address: string) => void;
};

export const LegViewer = ({ legData, navKey, reset, retry }: Props) => {
  if ('error' in legData)
    return (
      <Card className={styles['LegViewer-Card']} style={{ whiteSpace: 'pre-wrap' }}>
        <CardContent>
          <Stack spacing={5}>
            <Typography variant='body1'>{legData.error}</Typography>

            <div className={lookupStyles['button-container']}>
              <Button
                className={lookupStyles['prevBtn']}
                variant='contained'
                onClick={reset}
              >
                Clear
              </Button>
              <Button
                className={lookupStyles['nextBtn']}
                disabled={legData.error.includes('Address is not in Delaware:')}
                variant='contained'
                onClick={() => retry(legData.error.split('\n')[1])}
              >
                Search
              </Button>
            </div>
          </Stack>
        </CardContent>
      </Card>
    );

  return (
    <>
      {navKey === 'addrInfo' && (
        <AddressCard address={legData.address} ed={legData.ED} sd={legData.SD} />
      )}
      {navKey === 'rep' && (
        <LegCard legData={legData.RD} title='Representative' />
      )}
      {navKey === 'senate' && <LegCard legData={legData.SD} title='Senat' />}
      {navKey === 'county' && <CountyCard countyData={legData.CD} />}
    </>
  );
};
