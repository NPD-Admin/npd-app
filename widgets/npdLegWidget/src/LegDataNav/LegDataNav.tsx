import { SetStateAction } from 'react';
import { Dropdown, DropdownButton, ButtonGroup } from 'react-bootstrap';

type Props = {
  setKey: React.Dispatch<SetStateAction<string>>;
  reset: () => void;
};

export const LegDataNav = ({ setKey, reset }: Props) => {
  return (
    <DropdownButton
      as={ButtonGroup}
      size='sm'
      title=''
      menuVariant='dark'
      variant='secondary'
      style={{ float: 'right' }}
    >
      <Dropdown.Item onClick={() => setKey('addrInfo')}>
        Address Info
      </Dropdown.Item>
      <Dropdown.Divider />
      <Dropdown.Item onClick={() => setKey('rep')}>
        Representative
      </Dropdown.Item>
      <Dropdown.Item onClick={() => setKey('senate')}>Senate</Dropdown.Item>
      <Dropdown.Item onClick={() => setKey('county')}>County</Dropdown.Item>
      <Dropdown.Divider />
      <Dropdown.Item onClick={reset}>Reset</Dropdown.Item>
    </DropdownButton>
  );
};
