import React, { useState, useEffect } from 'react';
import { useWalletConnect } from '../context/WalletConnectContext';

const Popup: React.FC = () => {
  const { isConnected, address, connect, disconnect, loading } = useWalletConnect();
  const [txStatus] = useState<string | null>(null);

  // Update background script when wallet connection status changes
  useEffect(() => {
    const updateBackgroundStatus = async () => {
      try {
        await chrome.runtime.sendMessage({
          action: 'setWalletStatus',
          isConnected,
          address
        });
        console.log('Updated background status:', { isConnected, address });
      } catch (error) {
        console.error('Error updating background status:', error);
      }
    };

    updateBackgroundStatus();
  }, [isConnected, address]);

  // Format address for display (0x1234...5678)
  const formatAddress = (addr: string) => {
    if (!addr) return '';
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  return (
    <div className="w-80 h-80 flex flex-col justify-center items-center p-5 font-sans">
      <h1 className="text-twitch-purple text-center mb-5 text-lg font-semibold">
        Prediction<span className="text-[#FF0052]">.</span>Live
      </h1>
      <button
        onClick={isConnected ? disconnect : connect}
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
      {txStatus && (
        <div className="mt-4 p-3 bg-gray-900 text-white rounded-lg text-center text-sm">
          {txStatus}
        </div>
      )}
    </div>
  );
};

export default Popup; 