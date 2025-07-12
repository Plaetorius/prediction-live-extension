import React from 'react';
import ReactDOM from 'react-dom/client';
import Popup from './Popup';
import '../styles/index.css';

const handleButtonClick = () => {
  alert('HI!');
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Popup onButtonClick={handleButtonClick} />
  </React.StrictMode>
); 