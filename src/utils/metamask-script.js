// MetaMask transaction script
window.executeMetaMaskTransaction = async function(amount) {
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