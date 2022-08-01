import { Button, CircularProgress, Stack, TextField } from '@mui/material';
import {
  FormEvent,
  SetStateAction,
  useCallback,
  useEffect,
  useState
} from 'react';

import { GeoLocation } from '../types/GeoLocation';

import styles from './LookupForm.module.css';

type Automated = { address: string; run: boolean };

type Props = {
  setLegData: React.Dispatch<SetStateAction<GeoLocation | null>>;
  automated: Automated;
};

export const LookupForm = ({ setLegData, automated }: Props) => {
  const [loading, setLoading] = useState(false);
  const [address, setAddress] = useState('');
  const [zipCode, setZipCode] = useState('');

  async function handleSubmit(e?: FormEvent): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    e && e.preventDefault();

    if (!address || !zipCode) return;

    setLoading(true);
    const payload = { address: [address, zipCode].join(', ') };

    const addresses = await fetch(
      'https://npd-server.herokuapp.com/api/legLookup',
      {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
          'Content-type': 'application/json'
        }
      }
    );

    setLegData(await addresses.json());
    setLoading(false);
  }

  function reset() {
    setAddress('');
    setZipCode('');
  }

  const runSubmit = useCallback(handleSubmit, [address, zipCode, setLegData]);

  useEffect(() => {
    if (!automated?.run) return;
    const parts = automated.address.split(', ');
    automated.run = false;
    if (parts.length > 3) {
      setAddress(parts[0]);
      setZipCode(parts[parts.length - 1].split(' ')[0]);
      automated.run = true;
    } else if (parts[2].split(' ')[0] === 'Delaware') {
      setZipCode(parts[0]);
    }
  }, [automated, runSubmit]);

  useEffect(() => {
    if (address && zipCode && automated?.run) runSubmit();
  }, [address, zipCode, automated, runSubmit]);

  return (
    <form className={styles['form-container']} onSubmit={handleSubmit}>
      <Stack spacing={2}>
        <div>
          <TextField
            id='address'
            label='Street Address:'
            type='search'
            variant='filled'
            size='small'
            required
            onChange={(e) => setAddress(e.target.value)}
            value={address}
          />
        </div>
        <div>
          <TextField
            id='zipCode'
            label='Zip Code:'
            type='search'
            variant='filled'
            size='small'
            required
            onChange={(e) => setZipCode(e.target.value)}
            value={zipCode}
          />
        </div>
        <div className={styles['button-container']}>
          <Button
            className={styles['prevBtn']}
            variant='contained'
            onClick={reset}
          >
            Clear
          </Button>
          <Button variant='contained' className={styles['nextBtn']} type='submit'>
            { !loading && 'Search' }
            {
              loading &&
                <CircularProgress
                  size={20}
                  sx={{ verticalAlign: 'middle', color: 'white' }}
                />
            }
          </Button>
        </div>
      </Stack>
    </form>
  );
};
