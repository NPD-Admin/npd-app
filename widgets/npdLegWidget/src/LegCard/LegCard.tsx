import { useCallback, useEffect, useRef, useState } from 'react';
import { Legislator } from '../types/Legislator';

import styles from './LegCard.module.css';
import parentStyles from '../LegViewer/LegViewer.module.css';
import { Card, CardContent, CardMedia, Divider, Stack, Typography } from '@mui/material';

type Props = { legData: Legislator; title: string };

export const LegCard = ({ legData, title }: Props) => {
  const [image, setImage] = useState('');
  const mounted = useRef(false);

  function titleVariant(type: number) {
    if (title === 'Representative') return title;
    if (!type) return 'Senate';
    else return 'Senator';
  }

  const getImage = useCallback(
    async function () {
      const res = await fetch(
        `https://npd-server.herokuapp.com/api/scrapeImage?url=${legData.url}`
      );
      const data = await res.text();
      setImage(data);
    },
    [setImage, legData.url]
  );

  useEffect(() => {
    if (!mounted.current) {
      getImage();
    }
    return () => {
      mounted.current = true;
    };
  }, [mounted, getImage]);

  return (
    <Card className={parentStyles['LegViewer-Card']}>
      {
        !image &&
          <div className={styles['overlay']}>
            <div className={styles['overlay-spinner']} />
          </div>
      }
      <CardContent style={{ maxWidth: '275px' }}>
        <Typography variant='subtitle1'>
          <a href={legData.url} rel='noreferrer' target='_blank'>
            {titleVariant(1)}<br />
            {legData.name}
          </a>
        </Typography>
        <Divider />
        <Stack spacing={0.15}>
          <Typography variant='caption' className={styles['LegCard-Subtitle']}>
            {titleVariant(0)} District {legData.district}
          </Typography>
          <Typography variant='body1'>
            {legData.party === 'R' && 'Republican'}
            {legData.party === 'D' && 'Democratic'}
          </Typography>
          <Typography>
            <a href={`mailto:${legData.email}`} target='_blank' rel='noreferrer'>
              {legData.email}
            </a>
          </Typography>
        </Stack>
      </CardContent>
      {
        image &&
          <CardMedia component='img' className={styles['avatar']} src={image} alt={`${legData.name}-avatar`} />
      }
    </Card>
  );
};
