import { createClient } from '@supabase/supabase-js';
import { StreamStatusResponse } from '../types/websocket';

export class WebSocketService {
  private supabase: any;
  private streamId: string | null = null;
  private userId: string = 'dev-user-123'; // Fixed for development
  private isConnected: boolean = false;

  constructor() {
    // Initialize Supabase client
    // You'll need to replace these with your actual Supabase credentials
    this.supabase = createClient(
      'https://iitjsrlhyffgtwiwbqln.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpdGpzcmxoeWZmZ3R3aXdicWxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIyNjk0NDEsImV4cCI6MjA2Nzg0NTQ0MX0.kak2FanxJX0tw2eXad5dP5pvG97aeeULEqrwvuZau18'
    );
  }

  async checkStreamStatus(streamId: string): Promise<boolean> {
    try {
      const response = await fetch(`https://prediction-live.vercel.app/api/streams/${streamId}/challenge`);
      
      if (!response.ok) {
        console.error('Failed to check stream status:', response.statusText);
        return false;
      }

      const data: StreamStatusResponse = await response.json();
      console.log('Stream status:', data);
      return data.hasActiveStream;
    } catch (error) {
      console.error('Error checking stream status:', error);
      return false;
    }
  }

  async connectToStream(streamId: string): Promise<boolean> {
    try {
      // Check if stream is active
      const hasActiveStream = await this.checkStreamStatus(streamId);
      
      if (!hasActiveStream) {
        console.log('No active stream found for:', streamId);
        return false;
      }

      this.streamId = streamId;
      
      // Subscribe to Supabase realtime channel
      this.supabase
        .channel(`predictions-${streamId}`)
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'predictions' 
          }, 
          (payload: any) => {
            this.handleServerMessage(payload);
          }
        )
        .subscribe((status: any) => {
          console.log('Subscription status:', status);
          this.isConnected = status === 'SUBSCRIBED';
        });

      return true;
    } catch (error) {
      console.error('Error connecting to stream:', error);
      return false;
    }
  }

  async sendPrediction(message: string): Promise<void> {
    if (!this.streamId || !this.isConnected) {
      console.error('Not connected to stream');
      return;
    }

    try {
      // Send to your backend via Supabase
      const { error } = await this.supabase
        .from('predictions')
        .insert([{
          user_id: this.userId,
          stream_id: this.streamId,
          message: message,
          created_at: new Date().toISOString()
        }]);

      if (error) {
        console.error('Error sending prediction:', error);
        this.handleServerMessage({ type: 'failure', message: 'Failed to send prediction' });
      } else {
        console.log('Prediction sent successfully');
      }
    } catch (error) {
      console.error('Error sending prediction:', error);
    }
  }

  private handleServerMessage(payload: any): void {
    console.log('Received server message:', payload);
    
    // Dispatch custom event for the content script to handle
    const event = new CustomEvent('prediction-response', {
      detail: payload
    });
    document.dispatchEvent(event);
  }

  disconnect(): void {
    if (this.streamId) {
      this.supabase.removeChannel(`predictions-${this.streamId}`);
      this.isConnected = false;
      this.streamId = null;
    }
  }

  isStreamConnected(): boolean {
    return this.isConnected;
  }
} 