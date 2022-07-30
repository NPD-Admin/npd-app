import styles from './CountyCard.module.css';
import parentStyles from '../LegViewer/LegViewer.module.css';

import { GeoLocation } from '../types/GeoLocation';

import { NumericalSuffixMap } from '../types/SuffixMap';
import { Card, CardContent, Divider, Stack, Typography } from '@mui/material';

type Props = { countyData: GeoLocation['CD'] };

export const CountyCard = ({ countyData }: Props) => {
  return (
    <Card className={parentStyles['LegViewer-Card']}>
      <CardContent>
        <Typography variant='subtitle1'>{countyData.county} County</Typography>
        <Divider />
        <Stack spacing={2}>
          <Typography variant='caption' className={styles['CountyCard-Subtitle']}>
            {countyData.district}
            {NumericalSuffixMap[countyData.district] || 'th'}{' '}
            {(countyData.county === 'Kent' && 'Levy Court') || 'County Council'}{' '}
            District
          </Typography>
          <Typography variant='body1'>
            {countyData.title} {countyData.commissioner}
          </Typography>
          {countyData.atLarge!.trim() && (
            <>
              <Typography variant='body1'>
                {countyData.atLargeTitle} {countyData.atLarge} &mdash; At Large
              </Typography>
            </>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};
