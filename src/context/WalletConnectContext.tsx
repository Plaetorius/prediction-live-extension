import React, { createContext, useState, useEffect, useContext } from 'react';
import { SignClient } from '@walletconnect/sign-client';
import { WalletConnectModal } from '@walletconnect/modal';
import { 
  initSignClient, 
  createWeb3Modal, 
  DEFAULT_NAMESPACES
} from '../utils/walletconnect';

// Type definitions
type SignClientInstance = InstanceType<typeof SignClient>;
type SessionNamespace = { accounts: string[] };

interface WalletConnectContextProps {
  signClient: SignClientInstance | null;
  web3Modal: WalletConnectModal | null;
  isConnected: boolean;
  address: string;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  loading: boolean;
  updateBackgroundStatus: () => Promise<void>;
}

const WalletConnectContext = createContext<WalletConnectContextProps | null>(null);

export function useWalletConnect() {
  const context = useContext(WalletConnectContext);
  if (!context) {
    throw new Error('useWalletConnect must be used within a WalletConnectProvider');
  }
  return context;
}

export function WalletConnectProvider({ children }: { children: React.ReactNode }) {
  const [signClient, setSignClient] = useState<SignClientInstance | null>(null);
  const [web3Modal, setWeb3Modal] = useState<WalletConnectModal | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(true);
  const [sessionTopic, setSessionTopic] = useState<string | null>(null);

  // Initialize WalletConnect client
  useEffect(() => {
    const init = async () => {
      try {
        // Initialize WalletConnect client
        const client = await initSignClient();
        setSignClient(client);
        
        // Create WalletConnectModal instance
        const modal = createWeb3Modal();
        setWeb3Modal(modal);
        
        // Check for existing sessions
        if (client.session && typeof client.session.getAll === 'function') {
          const sessions = client.session.getAll();
          if (sessions.length > 0) {
            // Use the most recent session
            const session = sessions[sessions.length - 1];
            setSessionTopic(session.topic);
            
            // Extract address from session
            if (session.namespaces) {
              const accounts = Object.values(session.namespaces as Record<string, SessionNamespace>)
                .flatMap(namespace => namespace.accounts || []);
              
              if (accounts.length > 0) {
                const accountParts = accounts[0].split(':');
                setAddress(accountParts[accountParts.length - 1]);
                setIsConnected(true);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error initializing WalletConnect:', error);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  // Set up event listeners for WalletConnect client
  useEffect(() => {
    if (!signClient) return;

    // Session proposal handler
    const handleSessionProposal = async (event: any) => {
      try {
        // Approve session automatically
        const { topic, acknowledged } = await signClient.approve({
          id: event.id,
          namespaces: event.params.requiredNamespaces
        });

        // Wait for confirmation
        await acknowledged();
        
        // Update connection state
        setSessionTopic(topic);
        setIsConnected(true);
        
        // Get wallet address
        if (signClient.session && typeof signClient.session.get === 'function') {
          const session = signClient.session.get(topic);
          if (session.namespaces) {
            const accounts = Object.values(session.namespaces as Record<string, SessionNamespace>)
              .flatMap(namespace => namespace.accounts || []);
            
            if (accounts.length > 0) {
              const accountParts = accounts[0].split(':');
              setAddress(accountParts[accountParts.length - 1]);
            }
          }
        }
        
        // Close modal
        if (web3Modal && typeof web3Modal.closeModal === 'function') {
          web3Modal.closeModal();
        }
      } catch (error) {
        console.error('Error approving session:', error);
      }
    };

    // Session deletion handler
    const handleSessionDelete = (event: any) => {
      if (event.topic === sessionTopic) {
        setIsConnected(false);
        setAddress('');
        setSessionTopic(null);
      }
    };

    // Add event listeners
    if (typeof signClient.on === 'function') {
      signClient.on('session_proposal', handleSessionProposal);
      signClient.on('session_delete', handleSessionDelete);

      // Clean up event listeners
      return () => {
        if (typeof signClient.off === 'function') {
          signClient.off('session_proposal', handleSessionProposal);
          signClient.off('session_delete', handleSessionDelete);
        }
      };
    }
    return undefined;
  }, [signClient, sessionTopic, web3Modal]);

  // Connect function
  const connect = async () => {
    if (!signClient || !web3Modal) {
      console.error('WalletConnect is not initialized');
      return;
    }

    try {
      // Create session proposal
      if (typeof signClient.connect === 'function') {
        const { uri, approval } = await signClient.connect({
          requiredNamespaces: DEFAULT_NAMESPACES,
          optionalNamespaces: {},
        });

        if (uri && typeof web3Modal.openModal === 'function') {
          // Open WalletConnect modal with URI
          web3Modal.openModal({ uri });
          
          // Wait for approval
          const session = await approval();
          console.log('Session established:', session);
          // State update will be handled by event listener
        }
      }
    } catch (error) {
      console.error('Error connecting:', error);
      if (web3Modal && typeof web3Modal.closeModal === 'function') {
        web3Modal.closeModal();
      }
    }
  };

  // Disconnect function
  const disconnect = async () => {
    if (!signClient || !sessionTopic) return;

    try {
      if (typeof signClient.disconnect === 'function') {
        await signClient.disconnect({
          topic: sessionTopic,
          reason: { code: 6000, message: 'User disconnected' },
        });
      }
      
      setIsConnected(false);
      setAddress('');
      setSessionTopic(null);
    } catch (error) {
      console.error('Error disconnecting:', error);
    }
  };

  const updateBackgroundStatus = async () => {
    try {
      await chrome.runtime.sendMessage({
        action: 'setWalletStatus',
        isConnected,
        address,
        signClient
      });
    } catch (error) {
      console.error('Error updating background status:', error);
    }
  };

  const value = {
    signClient,
    web3Modal,
    isConnected,
    address,
    connect,
    disconnect,
    loading,
    updateBackgroundStatus
  };

  return (
    <WalletConnectContext.Provider value={value}>
      {children}
    </WalletConnectContext.Provider>
  );
}