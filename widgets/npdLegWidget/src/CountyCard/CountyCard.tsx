import './CountyCard.css';

import { Card } from 'react-bootstrap';
import { GeoLocation } from '../types/GeoLocation';

import { NumericalSuffixMap } from '../types/SuffixMap';

type Props = { countyData: GeoLocation['CD'] };

export const CountyCard = ({ countyData }: Props) => {
  return (
    <Card body className='LegViewer-Card'>
      <Card.Title>{countyData.county} County</Card.Title>
      <Card.Subtitle className='CountyCard-Subtitle'>
        {countyData.district}
        {NumericalSuffixMap[countyData.district] || 'th'}{' '}
        {(countyData.county === 'Kent' && 'Levy Court') || 'County Council'}{' '}
        District
      </Card.Subtitle>
      <Card.Text>
        {countyData.title} {countyData.commissioner}
      </Card.Text>
      {countyData.atLarge!.trim() && (
        <>
          <hr />
          <Card.Text>
            {countyData.atLargeTitle} {countyData.atLarge} &mdash; At Large
          </Card.Text>
        </>
      )}
    </Card>
  );
};
