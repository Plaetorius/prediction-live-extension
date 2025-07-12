import React from 'react';
import { PopupProps } from '../types';
import { useWalletConnect } from '../context/WalletConnectContext';

const Popup: React.FC<PopupProps> = ({ onButtonClick }) => {
  const { isConnected, address, connect, disconnect, loading } = useWalletConnect();

  // Combined handler for button click
  const handleButtonClick = async () => {
    // If not connected, initiate wallet connection
    if (!isConnected) {
      await connect();
    } else {
      // If already connected, disconnect
      await disconnect();
    }
    
    // Call the original onButtonClick function with the wallet info
    onButtonClick();
  };

  // Format address for display (0x1234...5678)
  const formatAddress = (addr: string) => {
    if (!addr) return '';
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  return (
    <div className="w-80 p-5 font-sans">
      <h1 className="text-twitch-purple text-center mb-5 text-lg font-semibold">
        Twitch Title Changer
      </h1>
      <button
        onClick={handleButtonClick}
        disabled={loading}
        className="
          bg-twitch-purple text-white border-none py-3 px-6 text-base rounded-lg cursor-pointer
          w-full transition-colors duration-200 hover:bg-twitch-purple-dark active:bg-twitch-purple-darker
          disabled:bg-twitch-purple-dark disabled:cursor-not-allowed
        "
      >
        {loading ? (
          'Loading...'
        ) : isConnected ? (
          `Connected: ${formatAddress(address)}`
        ) : (
          'Connect Wallet'
        )}
      </button>
    </div>
  );
};

export default Popup; 