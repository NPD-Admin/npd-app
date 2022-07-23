import React, { useEffect, useRef, useState } from 'react';
import logo from './logo.svg';
import './App.css';

function App() {
  const [data, setData] = useState('');
  const loaded = useRef(false);

  useEffect(() => {
    async function fetchData() {
      if (!loaded.current) {
        const res = await (await fetch('/api')).json();
        setData(res);
        console.log(res);
      }
    }
    fetchData();
    return () => { loaded.current = true };
  }, []);
  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        { data && JSON.stringify(data, null, 2) }
        <p>
          Edit <code>src/App.tsx</code> and save to reload.
        </p>
        <a
          className="App-link"
          href="http://localhost:5000"
          target="_blank"
          rel="noopener noreferrer"
        >
          Visit "Prod" Server
        </a>
      </header>
    </div>
  );
}

export default App;
