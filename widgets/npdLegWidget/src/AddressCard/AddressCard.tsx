import { GeoLocation } from '../types/GeoLocation';

import styles from './AddressCard.module.css';
import parentStyles from '../LegViewer/LegViewer.module.css';
import { Card, CardContent, Divider, Stack, Typography } from '@mui/material';

type Props = {
  address: GeoLocation['address'];
  ed: GeoLocation['ED'];
  sd: GeoLocation['SD']
};

export const AddressCard = ({ address, ed, sd }: Props) => {
  function formatAddress() {
    const parts = address.split(', ');
    const cityIdx = parts.length - 3;
    const addr = parts.slice(0, cityIdx).join(', ');
    const city = parts.slice(cityIdx);
    return [addr, `${city[0]}, ${city[1]} ${city[2]}`].join('\n');
  }

  function getRD() {
    return ed.split('-')[0];
  }

  function getSD() {
    return sd.district;
  }

  return (
    <Card className={parentStyles['LegViewer-Card']}>
      <CardContent>
        <Typography
          variant='subtitle1'
        >Representative District {getRD()}</Typography>
        <Divider />
        <Stack spacing={2}>
          <Typography
            variant='subtitle2'
            className={styles['AddressCard-Subtitle']}>
            Election District {ed} / Senate District {getSD()}
          </Typography>
          <Typography
            variant='body1'
            style={{ whiteSpace: 'pre-wrap' }}>
            {formatAddress()}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
};
