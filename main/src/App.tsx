import React, { useEffect, useRef, useState } from 'react';
import logo from './logo.svg';
import './App.css';
import { CodeResponse, googleLogout, useGoogleLogin } from '@react-oauth/google';

function App() {
  const loaded = useRef(false);
  const [botStatus, setBotStatus] = useState(false);
  const [data, setData] = useState('');
  const [loginData, setLoginData] = useState(
    (localStorage.getItem('loginData') && JSON.parse(localStorage.getItem('loginData')!)) || null
  );

  const toggleBot = async (e: React.MouseEvent<HTMLButtonElement>) => {
    const res = await (await fetch('/bot/setState')).json();
    setBotStatus(res.active);
  }

  const handleFailure = (e: Pick<CodeResponse, 'error' | 'error_description' | 'error_uri'>) => {
    console.log('Login failed.', e);
  };

  const handleLogin = useGoogleLogin({
    onSuccess: async (googleData: CodeResponse) => {
      const res = await fetch('/oauth/login', {
        method: 'POST',
        body: JSON.stringify({
          code: googleData.code
        }),
        headers: {
          'Content-type': 'application/json'
        }
      });

      const data = await res.json();
      localStorage.setItem('loginData', JSON.stringify(data));
      setLoginData(data);
    },
    onError: handleFailure,
    flow: 'auth-code'
  });

  const logout = async () => {
    await fetch('/oauth/logout');
    localStorage.removeItem('loginData');
    setLoginData(null);
    googleLogout();
  };

  useEffect(() => {
    async function fetchData() {
      if (!loaded.current) {
        const res = await (await fetch('/api')).json();
        setData(res);

        const session = await (await fetch('/oauth/session')).json();
        if (session.error) await logout();

        const status = await (await fetch('/bot')).json();
        setBotStatus(status.active);
      }
    }
    fetchData();
    return () => { loaded.current = true };
  }, []);

  return (
    <div className='App'>
      <header className='App-header'>
        <img src={logo} className='App-logo' alt='logo' />
        { data && JSON.stringify(data, null, 2) }
        <p>
          Edit <code>src/App.tsx</code> and save to reload.
        </p>
        <p><a
          className='App-link'
          href='http://localhost:5000'
          target='_blank'
          rel='noopener noreferrer'
        >
          Visit 'Prod' Server
        </a></p>
        { loginData && 
          <>
            <p>The NPD Bot is: {(botStatus && 'Active') || 'Disabled'}</p>
            <button
              onClick={toggleBot}  
            >{(botStatus && 'Disable') || 'Enable'}</button>
          </>
        }
        <div>
          { !loginData &&
            <button
              onClick={() => handleLogin()}
            >Login</button>
          }
          { loginData &&
            <>
              <p>{loginData.name}<br/>Logged In</p>
              <button
                onClick={logout}
              >Logout</button>
            </>
          }
        </div>
      </header>
    </div>
  );
}

export default App;
