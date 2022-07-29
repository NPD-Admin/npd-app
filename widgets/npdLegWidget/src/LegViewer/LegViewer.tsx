import { GeoLocation } from '../types/GeoLocation';
import { CountyCard } from '../CountyCard/CountyCard';
import { AddressCard } from '../AddressCard/AddressCard';
import { LegCard } from '../LegCard/LegCard';

import './LegViewer.css';
import { Card, Button } from 'react-bootstrap';

type Props = {
  legData: GeoLocation | { error: string };
  navKey: string;
  reset: () => void;
  retry: (address: string) => void;
};

export default function LegViewer({ legData, navKey, reset, retry }: Props) {
  if ('error' in legData)
    return (
      <Card body className='LegViewer-Card' style={{ whiteSpace: 'pre-wrap' }}>
        <Card.Text>{legData.error}</Card.Text>

        <div className='button-container'>
          <Button
            className='prevBtn'
            type='button'
            onClick={reset}
            variant='danger'
          >
            Clear
          </Button>
          <Button
            className='nextBtn'
            disabled={legData.error.includes('Address is not in Delaware:')}
            type='button'
            onClick={() => retry(legData.error.split('\n')[1])}
          >
            Search
          </Button>
        </div>
      </Card>
    );

  return (
    <>
      {navKey === 'addrInfo' && (
        <AddressCard address={legData.address} ed={legData.ED} />
      )}
      {navKey === 'rep' && (
        <LegCard legData={legData.RD} title='Representative' />
      )}
      {navKey === 'senate' && <LegCard legData={legData.SD} title='Senat' />}
      {navKey === 'county' && <CountyCard countyData={legData.CD} />}
    </>
  );
};
