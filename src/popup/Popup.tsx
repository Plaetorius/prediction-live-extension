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
    <div className="w-80 h-80 p-6 flex flex-col justify-center items-center bg-main-gradient">
      {/* Main Glass Card */}
      <div className="glass-card rounded-2xl w-full h-full flex flex-col justify-center items-center p-6">
        
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">
            Prediction
            <span className="accent-text">.</span>
            Live
          </h1>
          <div className="w-12 h-0.5 bg-accent rounded-full mx-auto" />
        </div>

        {/* Status Indicator */}
        <div className="mb-6">
          <div className={`w-2 h-2 rounded-full mx-auto mb-2 transition-colors duration-300 ${
            isConnected ? 'bg-accent' : 'bg-gray-500'
          }`} />
          <p className="text-xs text-gray-300 text-center">
            {isConnected ? 'Connected' : 'Disconnected'}
          </p>
        </div>

        {/* Main Action Button */}
        <button
          onClick={isConnected ? disconnect : connect}
          disabled={loading}
          className={`
            glass-button w-full py-3 px-6 rounded-lg font-medium text-sm
            transition-all duration-200 transform
            ${loading 
              ? 'opacity-50 cursor-not-allowed' 
              : 'hover:scale-105 hover:shadow-accent active:scale-95'
            }
          `}
        >
          <div className="flex items-center justify-center space-x-2">
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span className="text-white">Connecting...</span>
              </>
            ) : isConnected ? (
              <>
                <div className="w-2 h-2 bg-accent rounded-full" />
                <span className="text-white">
                  {formatAddress(address)}
                </span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span className="text-white">Connect Wallet</span>
              </>
            )}
          </div>
        </button>

        {/* Transaction Status */}
        {txStatus && (
          <div className="mt-4 w-full">
            <div className="glass-button rounded-lg p-3 text-center">
              <p className="text-xs text-gray-300">{txStatus}</p>
            </div>
          </div>
        )}

        {/* Bottom Info */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-400">
            Web3 • Secure • Live
          </p>
        </div>
        
      </div>
    </div>
  );
};

export default Popup; 