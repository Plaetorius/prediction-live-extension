// MetaMask injection utility
export interface MetaMaskTransaction {
  to: string;
  value: string;
  data: string;
  chainId: string;
}

export interface MetaMaskResponse {
  success: boolean;
  txHash?: string;
  error?: string;
}

// Function to inject MetaMask transaction
export async function injectMetaMaskTransaction(
  amount: number,
  tokenName: string
): Promise<MetaMaskResponse> {
  return new Promise((resolve) => {
    // Create script element
    const script = document.createElement('script');
    script.textContent = `
      (async function() {
        try {
          console.log('MetaMask injection started');
          
          // Check if MetaMask is available
          if (typeof window.ethereum === 'undefined') {
            console.error('MetaMask not found');
            window.postMessage({ type: 'METAMASK_ERROR', error: 'MetaMask is not installed' }, '*');
            return;
          }

          // Request account access
          const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
          if (!accounts || accounts.length === 0) {
            console.error('No accounts found');
            window.postMessage({ type: 'METAMASK_ERROR', error: 'No accounts found' }, '*');
            return;
          }

          const fromAddress = accounts[0];
          console.log('Using account:', fromAddress);

          // Switch to Chiliz testnet if needed
          try {
            await window.ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: '0x15b38' }], // Chiliz testnet
            });
            console.log('Switched to Chiliz testnet');
          } catch (switchError) {
            console.log('Switch error:', switchError);
            // If the network doesn't exist, add it
            if (switchError.code === 4902) {
              try {
                await window.ethereum.request({
                  method: 'wallet_addEthereumChain',
                  params: [{
                    chainId: '0x15b38',
                    chainName: 'Chiliz Testnet',
                    nativeCurrency: {
                      name: 'CHZ',
                      symbol: 'CHZ',
                      decimals: 18
                    },
                    rpcUrls: ['https://testnet-rpc.chiliz.com'],
                    blockExplorerUrls: ['https://testnet-explorer.chiliz.com']
                  }]
                });
                console.log('Added Chiliz testnet');
              } catch (addError) {
                console.error('Failed to add Chiliz testnet:', addError);
                window.postMessage({ type: 'METAMASK_ERROR', error: 'Failed to add Chiliz testnet' }, '*');
                return;
              }
            } else {
              console.error('Failed to switch to Chiliz testnet:', switchError);
              window.postMessage({ type: 'METAMASK_ERROR', error: 'Failed to switch to Chiliz testnet' }, '*');
              return;
            }
          }

          // Create transaction
          const transaction = {
            from: fromAddress,
            to: '0xbCE7457679913BD81Da8ba3106dF11191141E12D',
            value: '0x' + (${amount} * 1e18).toString(16), // Convert to wei
            data: '0x',
            chainId: '0x15b38'
          };

          console.log('Sending transaction:', transaction);

          // Send transaction
          const txHash = await window.ethereum.request({
            method: 'eth_sendTransaction',
            params: [transaction]
          });

          console.log('Transaction sent successfully:', txHash);
          window.postMessage({ 
            type: 'METAMASK_SUCCESS', 
            txHash: txHash,
            tokenName: '${tokenName}',
            amount: ${amount}
          }, '*');
          
        } catch (error) {
          console.error('MetaMask transaction error:', error);
          window.postMessage({ 
            type: 'METAMASK_ERROR', 
            error: error.message || 'Transaction failed' 
          }, '*');
        }
      })();
    `;

    // Add event listener for response
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'METAMASK_SUCCESS') {
        document.head.removeChild(script);
        window.removeEventListener('message', handleMessage);
        resolve({
          success: true,
          txHash: event.data.txHash
        });
      } else if (event.data.type === 'METAMASK_ERROR') {
        document.head.removeChild(script);
        window.removeEventListener('message', handleMessage);
        resolve({
          success: false,
          error: event.data.error
        });
      }
    };

    window.addEventListener('message', handleMessage);

    // Inject script
    document.head.appendChild(script);

    // Timeout after 30 seconds
    setTimeout(() => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
        window.removeEventListener('message', handleMessage);
        resolve({
          success: false,
          error: 'Transaction timeout'
        });
      }
    }, 30000);
  });
} 