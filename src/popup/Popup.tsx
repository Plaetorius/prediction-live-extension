import React, { useState } from 'react';
import { useWalletConnect } from '../context/WalletConnectContext';
import { createTransaction, validateTransaction } from '../utils/transaction-config';

const Popup: React.FC = () => {
  const { isConnected, address, connect, disconnect, loading, signClient } = useWalletConnect();
  const [txStatus, setTxStatus] = useState<string | null>(null);

  // Format address for display (0x1234...5678)
  const formatAddress = (addr: string) => {
    if (!addr) return '';
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  // Fonction pour envoyer la transaction sur Chiliz
  const handleBet = async () => {
    if (!isConnected || !signClient) {
      setTxStatus('Please connect your wallet first.');
      return;
    }
    setTxStatus('Signature in progress...');
    try {
      const transaction = createTransaction(88882, {
        to: '0xbCE7457679913BD81Da8ba3106dF11191141E12D',
        value: '0x' + (1e18).toString(16), // 1 CHZ
        data: '0x',
      });
      if (!validateTransaction(transaction)) throw new Error('Invalid transaction');
      await signClient.request({
        topic: signClient.session.getAll()[0].topic,
        request: {
          method: 'eth_sendTransaction',
          params: [transaction]
        },
        chainId: 'eip155:88882'
      });
      setTxStatus('Transaction sent!');
      setTimeout(() => setTxStatus(null), 3000);
    } catch (err: any) {
      setTxStatus('Transaction failed: ' + (err?.message || ''));
      setTimeout(() => setTxStatus(null), 4000);
    }
  };

  return (
    <div className="w-80 p-5 font-sans">
      <h1 className="text-twitch-purple text-center mb-5 text-lg font-semibold">
        Twitch Title Changer
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
      <button
        onClick={handleBet}
        disabled={!isConnected || loading}
        className="
          mt-4 bg-green-600 text-white border-none py-3 px-6 text-base rounded-lg cursor-pointer
          w-full transition-colors duration-200 hover:bg-green-700 active:bg-green-800
          disabled:bg-gray-600 disabled:cursor-not-allowed
        "
      >
        Bet (Send Transaction)
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