import React from 'react';
import ReactDOM from 'react-dom/client';
import Popup from './Popup';
import '../styles/index.css';
import { WalletConnectProvider } from '../context/WalletConnectContext';

const handleButtonClick = () => {
  console.log('Wallet action completed');
  // Nous pouvons ajouter ici d'autres actions à effectuer après la connexion/déconnexion
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WalletConnectProvider>
      <Popup onButtonClick={handleButtonClick} />
    </WalletConnectProvider>
  </React.StrictMode>
); 