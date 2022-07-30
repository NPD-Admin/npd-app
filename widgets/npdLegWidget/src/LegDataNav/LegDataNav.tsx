import { Divider, IconButton, Menu, MenuItem } from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { MouseEvent, SetStateAction, useState } from 'react';

import './LegDataNav.css';

type Props = {
  setKey: React.Dispatch<SetStateAction<string>>;
  reset: () => void;
};

export const LegDataNav = ({ setKey, reset }: Props) => {
  const [anchorElement, setAnchorElement] = useState<null | HTMLElement>(null);
  const open = !!anchorElement;

  const handleClick = (evt: MouseEvent<HTMLButtonElement>) => {
    setAnchorElement(evt.currentTarget);
  };

  const handleMenu = (key: string) => {
    if (key && key !== 'reset') setKey(key);
    if (key && key === 'reset') reset();
    handleClose();
  }

  const handleClose = () => {
    setAnchorElement(null);
  };

  return (
    <div className={'LegDataNav'}>
      <IconButton
        id='navMenuButton'
        aria-controls={(open && 'basic-menu') || undefined}
        aria-haspopup='true'
        aria-expanded={(open && 'true') || undefined}
        onClick={handleClick}
        size='small'
      ><KeyboardArrowDownIcon fontSize='inherit' /></IconButton>
      <Menu
        id='navMenu'
        anchorEl={anchorElement}
        open={open}
        onClose={handleClose}
        MenuListProps={{
          'aria-labelledby': 'navMenuButton'
        }}
        sx={{ paddingTop: 0, paddingBottom: 0 }}
      >
        <MenuItem dense onClick={() => handleMenu('addrInfo')}>Address Info</MenuItem>
        <Divider className='divider' />
        <MenuItem dense onClick={() => handleMenu('rep')}>Representative</MenuItem>
        <MenuItem dense onClick={() => handleMenu('senate')}>Senate</MenuItem>
        <MenuItem dense onClick={() => handleMenu('county')}>County</MenuItem>
        <Divider className='divider' sx={{ marginBottom: 0, marginTop: 0 }}/>
        <MenuItem dense onClick={() => handleMenu('reset')}>Reset</MenuItem>
      </Menu>
    </div>
  );
};
