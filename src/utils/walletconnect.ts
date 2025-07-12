import { SignClient } from '@walletconnect/sign-client';
import { WalletConnectModal } from '@walletconnect/modal';

// Configuration for WalletConnect
export const WALLET_CONNECT_PROJECT_ID = '32e7748205bc282f1578fdeade53e89c'; // Replace with your actual project ID

// Required namespaces for connection
export const DEFAULT_NAMESPACES = {
  eip155: {
    methods: [
      'eth_sendTransaction',
      'eth_signTransaction',
      'eth_sign',
      'personal_sign',
      'eth_signTypedData'
    ],
    chains: ['eip155:1', 'eip155:56', 'eip155:137'],
    events: ['chainChanged', 'accountsChanged']
  }
};

// Application metadata
export const APP_METADATA = {
  name: 'Twitch Prediction Live',
  description: 'Connect with WalletConnect',
  url: 'https://twitch.tv',
  icons: ['https://twitch.tv/favicon.ico']
};

// Initialize WalletConnect client
export async function initSignClient() {
  try {
    const client = await SignClient.init({
      projectId: WALLET_CONNECT_PROJECT_ID,
      metadata: APP_METADATA
    });
    
    return client;
  } catch (error) {
    console.error('Error initializing WalletConnect client:', error);
    throw error;
  }
}

// Create WalletConnectModal instance
export function createWeb3Modal() {
  return new WalletConnectModal({
    projectId: WALLET_CONNECT_PROJECT_ID,
    themeMode: 'dark'
  });
}

// WebSocket service for stream communication
export class WebSocketService {
  private socket: WebSocket | null = null;
  private streamId: string | null = null;
  
  /**
   * Connect to a stream via WebSocket
   * @param streamId The ID of the stream to connect to
   * @returns Promise that resolves to true if connection was successful
   */
  public async connectToStream(streamId: string): Promise<boolean> {
    this.streamId = streamId;
    
    try {
      // Replace with your actual WebSocket server URL
      const wsUrl = `wss://your-websocket-server.com/stream/${streamId}`;
      
      return new Promise((resolve) => {
        this.socket = new WebSocket(wsUrl);
        
        this.socket.onopen = () => {
          console.log(`WebSocket connected to stream: ${streamId}`);
          resolve(true);
        };
        
        this.socket.onerror = (error) => {
          console.error('WebSocket connection error:', error);
          resolve(false);
        };
        
        this.socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            // Dispatch custom event for the content script to handle
            document.dispatchEvent(new CustomEvent('prediction-response', { detail: data }));
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };
        
        this.socket.onclose = () => {
          console.log('WebSocket connection closed');
        };
        
        // Set a timeout in case the connection takes too long
        setTimeout(() => {
          if (this.socket?.readyState !== WebSocket.OPEN) {
            resolve(false);
          }
        }, 5000);
      });
    } catch (error) {
      console.error('Error connecting to WebSocket:', error);
      return false;
    }
  }
  
  /**
   * Send a prediction via WebSocket
   * @param choice The user's prediction choice ('accept' or 'reject')
   */
  public async sendPrediction(choice: 'accept' | 'reject'): Promise<void> {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.error('WebSocket not connected');
      throw new Error('WebSocket not connected');
    }
    
    try {
      const message = {
        type: 'prediction',
        streamId: this.streamId,
        choice: choice,
        timestamp: Date.now()
      };
      
      this.socket.send(JSON.stringify(message));
      console.log('Prediction sent:', message);
    } catch (error) {
      console.error('Error sending prediction:', error);
      throw error;
    }
  }
  
  /**
   * Close the WebSocket connection
   */
  public disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
      this.streamId = null;
      console.log('WebSocket disconnected');
    }
  }
}