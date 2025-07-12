import React from 'react';
import ReactDOM from 'react-dom/client';
import Popup from './Popup';
import '../styles/index.css';
import { WalletConnectProvider } from '../context/WalletConnectContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WalletConnectProvider>
      <Popup />
    </WalletConnectProvider>
  </React.StrictMode>
); 