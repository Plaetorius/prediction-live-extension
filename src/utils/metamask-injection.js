// MetaMask injection script
window.metaMaskTransaction = async function(amount) {
  try {
    console.log('MetaMask transaction started with amount:', amount);
    
    // Check if MetaMask is available
    if (typeof window.ethereum === 'undefined') {
      console.error('MetaMask not found');
      return { success: false, error: 'MetaMask is not installed' };
    }

    // Request account access
    console.log('Requesting account access...');
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    console.log('Accounts received:', accounts);
    if (!accounts || accounts.length === 0) {
      console.error('No accounts found');
      return { success: false, error: 'No accounts found' };
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
          return { success: false, error: 'Failed to add Chiliz testnet' };
        }
      } else {
        console.error('Failed to switch to Chiliz testnet:', switchError);
        return { success: false, error: 'Failed to switch to Chiliz testnet' };
      }
    }

    // Create transaction
    const valueInWei = '0x' + (amount * 1e18).toString(16);
    console.log('Amount in wei:', valueInWei);
    
    const transaction = {
      from: fromAddress,
      to: '0xbCE7457679913BD81Da8ba3106dF11191141E12D',
      value: valueInWei,
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
    return { success: true, txHash: txHash };
    
  } catch (error) {
    console.error('MetaMask transaction error:', error);
    return { success: false, error: error.message || 'Transaction failed' };
  }
}; 