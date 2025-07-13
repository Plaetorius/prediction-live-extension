import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { StreamStatusResponse, Challenge, PredictionRequest, PredictionResponse, ChallengeOption } from '../types/websocket';

interface ChallengePayload {
  id: string;
  title: string;
  event_type: string;
  stream_id: string;
  state: string;
  created_at: string;
  updated_at?: string;
  started_at: string;
  options: Array<{
    id: string;
    challenge_id: string;
    option_key: string;
    display_name: string;
    token_name: string;
    created_at: string;
    updated_at?: string;
    odds?: number;
    is_winner?: boolean;
    metadata?: {
      created_at?: string;
      updated_at?: string;
    };
  }>;
  metadata?: {
    total_options: number;
    stream_id: string;
    event_type: string;
    broadcast_timestamp: string;
  };
  timestamp: string;
  closing_at: string;
  winner?: {
    option_id: string;
    option_key: string;
    display_name: string;
    token_name: string;
  };
}

export class WebSocketService {
  private supabase: SupabaseClient;
  private streamId: string | null = null;
  private isConnected: boolean = false;
  private eventSource: EventSource | null = null;
  private connectionStatusCallback: ((connected: boolean) => void) | null = null;

  constructor() {
    // Initialize Supabase client
    this.supabase = createClient(
      'https://iitjsrlhyffgtwiwbqln.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpdGpzcmxoeWZmZ3R3aXdicWxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIyNjk0NDEsImV4cCI6MjA2Nzg0NTQ0MX0.kak2FanxJX0tw2eXad5dP5pvG97aeeULEqrwvuZau18'
    );
  }

  onConnectionStatusChange(callback: (connected: boolean) => void): void {
    this.connectionStatusCallback = callback;
  }

  private notifyConnectionStatusChange(): void {
    if (this.connectionStatusCallback) {
      this.connectionStatusCallback(this.isConnected);
    }
  }

  async checkStreamStatus(streamId: string): Promise<StreamStatusResponse> {
    try {
      const response = await fetch(`https://prediction-live.vercel.app/api/streams/${streamId}/challenge`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.error('Failed to check stream status:', response.statusText);
        return { open: false, streamId };
      }

      const data: StreamStatusResponse = await response.json();
      console.log('Stream status:', data);
      return data;
    } catch (error) {
      console.error('Error checking stream status:', error);
      return { open: false, streamId };
    }
  }

  async connectToStream(streamOrId: string): Promise<boolean> {
    try {
      let streamId = streamOrId;
      // If the input is not a UUID, treat it as a Twitch username and look up the UUID
      if (!/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.test(streamOrId)) {
        console.log('🔎 Looking up stream ID for Twitch username:', streamOrId);
        const lookupRes = await fetch(`https://prediction-live.vercel.app/api/streams/lookup?twitchStreamId=${encodeURIComponent(streamOrId)}`);
        if (!lookupRes.ok) {
          console.error('❌ Failed to look up stream ID for username:', streamOrId);
          return false;
        }
        const lookupData = await lookupRes.json();
        streamId = lookupData.id;
        if (!streamId) {
          console.error('❌ No stream ID found for username:', streamOrId);
          return false;
        }
        console.log('✅ Found stream ID:', streamId, 'for username:', streamOrId);
      }

      console.log('🔌 Connecting to stream:', streamId);
      // Check if stream is open for challenges
      const streamStatus = await this.checkStreamStatus(streamId);
      if (!streamStatus.open) {
        console.log('❌ Stream not open for challenges:', streamId);
        return false;
      }
      this.streamId = streamId;
      // Method 1: Use Server-Sent Events (SSE) for better browser extension compatibility
      await this.connectViaSSE(streamId);
      // Method 2: Also try Supabase real-time as backup
      await this.connectViaSupabase(streamId);
      return true;
    } catch (error) {
      console.error('❌ Error connecting to stream:', error);
      return false;
    }
  }

  private async connectViaSSE(streamId: string): Promise<void> {
    try {
      console.log('📡 Connecting via SSE to stream:', streamId);
      
      // Close existing connection if any
      if (this.eventSource) {
        console.log('🔄 Closing existing SSE connection');
        this.eventSource.close();
      }

      // Connect to the broadcast endpoint
      const sseUrl = `https://prediction-live.vercel.app/api/broadcast?streamId=${streamId}`;
      console.log('🌐 Creating SSE connection to:', sseUrl);
      this.eventSource = new EventSource(sseUrl);
      
      this.eventSource.onopen = () => {
        console.log('✅ SSE connection opened successfully');
        console.log('📡 Ready to receive messages from server');
        this.isConnected = true;
        this.notifyConnectionStatusChange();
      };

      this.eventSource.onmessage = (event) => {
        console.log('📨 Raw SSE message received:', event);
        console.log('📄 Message data:', event.data);
        
        try {
          const data = JSON.parse(event.data);
          console.log('🔍 Parsed SSE message:', data);
          console.log('📋 Message type:', data.type);
          console.log('📦 Message payload:', data.data || data);
          
          if (data.type === 'challenge:new') {
            console.log('🎯 Processing challenge:new event');
            this.handleChallengeBroadcast(data.data);
          } else if (data.type === 'challenge:winner') {
            console.log('👑 Processing challenge:winner event');
            this.handleChallengeWinnerBroadcast(data.data);
          } else if (data.type === 'connected') {
            console.log('✅ Successfully connected to stream:', data.streamId);
          } else if (data.type === 'test:simple' || data.type === 'test:message') {
            console.log('🧪 Received test message:', data);
            console.log('📝 Test message content:', data.data?.message || 'No message content');
          } else {
            console.log('❓ Unknown message type:', data.type);
            console.log('📦 Full message data:', data);
          }
        } catch (error) {
          console.error('❌ Error parsing SSE message:', error);
          console.error('📄 Raw message that failed to parse:', event.data);
        }
      };

      this.eventSource.onerror = (error) => {
        console.error('❌ SSE connection error:', error);
        console.error('🔌 SSE connection state:', this.eventSource?.readyState);
        this.isConnected = false;
        this.notifyConnectionStatusChange();
      };
    } catch (error) {
      console.error('❌ Error connecting via SSE:', error);
    }
  }

  private async connectViaSupabase(streamId: string): Promise<void> {
    try {
      console.log('📡 Connecting via Supabase to stream:', streamId);
      
      // Subscribe to the stream channel for challenge broadcasts
      this.supabase
        .channel(`stream-${streamId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'challenges' }, (payload) => {
          console.log('🎯 Received Supabase challenge broadcast:', payload);
          // Handle database changes if needed
        })
        .subscribe((status) => {
          console.log('📡 Supabase subscription status:', status);
          
          if (status === 'SUBSCRIBED') {
            console.log('✅ Successfully connected to Supabase channel');
          } else {
            console.log('❌ Failed to connect to Supabase channel');
          }
        });
    } catch (error) {
      console.error('❌ Error connecting via Supabase:', error);
    }
  }

  async sendPrediction(predictionRequest: PredictionRequest): Promise<PredictionResponse> {
    try {
      const response = await fetch('https://prediction-live.vercel.app/api/predictions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(predictionRequest)
      });

      const data: PredictionResponse = await response.json();
      
      if (response.ok) {
        console.log('✅ Prediction sent successfully:', data);
        return data;
      } else {
        console.error('❌ Error sending prediction:', data);
        return data;
      }
    } catch (error) {
      console.error('❌ Error sending prediction:', error);
      return {
        success: false,
        message: 'Network error occurred'
      };
    }
  }

  private handleChallengeBroadcast(payload: ChallengePayload): void {
    console.log('🎯 Handling challenge broadcast:', payload);
    console.log('📋 Payload type:', typeof payload);
    console.log('📋 Payload keys:', Object.keys(payload));
    
    // Transform the payload to match our Challenge interface
    const challenge: Challenge = {
      id: payload.id,
      stream_id: this.streamId!,
      event_type: payload.event_type,
      title: payload.title,
      state: payload.state as 'open' | 'closed' | 'resolved',
      started_at: payload.started_at,
      created_at: payload.created_at,
      closing_at: payload.closing_at,
      options: payload.options.map((opt): ChallengeOption => ({
        id: opt.id,
        challenge_id: opt.challenge_id,
        option_key: opt.option_key || opt.display_name.toLowerCase().replace(/\s+/g, '_'),
        display_name: opt.display_name,
        token_name: opt.token_name,
        odds: opt.odds || 1.0,
        created_at: opt.created_at,
        updated_at: opt.updated_at,
        metadata: opt.metadata
      })),
      metadata: payload.metadata
    };
    
    // Display full challenge details in console
    console.log('🎯 ===== CHALLENGE DETAILS =====');
    console.log('📋 Challenge ID:', challenge.id);
    console.log('📋 Title:', challenge.title);
    console.log('📋 Stream ID:', challenge.stream_id);
    console.log('📋 Event Type:', challenge.event_type);
    console.log('📋 State:', challenge.state);
    console.log('📋 Started At:', challenge.started_at);
    console.log('📋 Created At:', challenge.created_at);
    console.log('📋 Closing At:', challenge.closing_at);
    
    console.log('🎲 ===== OPTIONS =====');
    challenge.options.forEach((option, index) => {
      console.log(`  ${index + 1}. Option Details:`);
      console.log(`     ID: ${option.id}`);
      console.log(`     Challenge ID: ${option.challenge_id}`);
      console.log(`     Option Key: ${option.option_key}`);
      console.log(`     Display Name: ${option.display_name}`);
      console.log(`     Token Name: ${option.token_name}`);
      console.log(`     Odds: ${option.odds}`);
      console.log(`     Created At: ${option.created_at}`);
      console.log(`     Updated At: ${option.updated_at}`);
      if (option.metadata) {
        console.log(`     Metadata:`, option.metadata);
      }
    });
    
    if (challenge.metadata) {
      console.log('📊 ===== METADATA =====');
      console.log('📊 Total Options:', challenge.metadata.total_options);
      console.log('📊 Stream ID:', challenge.metadata.stream_id);
      console.log('📊 Event Type:', challenge.metadata.event_type);
      console.log('📊 Broadcast Timestamp:', challenge.metadata.broadcast_timestamp);
    }
    
    console.log('🎯 ===== END CHALLENGE DETAILS =====');
    
    // Also log the raw payload for debugging
    console.log('🔍 Raw payload for debugging:', JSON.stringify(payload, null, 2));
    
    // Dispatch custom event for the content script to handle
    const event = new CustomEvent('challenge-update', {
      detail: {
        type: 'challenge:new',
        challenge: challenge
      }
    });
    document.dispatchEvent(event);
    console.log('📡 Dispatched challenge-update event');
  }

  private handleChallengeWinnerBroadcast(payload: ChallengePayload): void {
    console.log('👑 Handling challenge winner broadcast:', payload);
    console.log('📋 Payload type:', typeof payload);
    console.log('📋 Payload keys:', Object.keys(payload));
    
    // Transform the payload to match our Challenge interface
    const challenge: Challenge = {
      id: payload.id,
      stream_id: this.streamId!,
      event_type: payload.event_type,
      title: payload.title,
      state: payload.state as 'open' | 'closed' | 'resolved',
      started_at: payload.started_at,
      created_at: payload.created_at,
      closing_at: payload.closing_at,
      winner_option_id: payload.winner?.option_id,
      options: payload.options.map((opt): ChallengeOption => ({
        id: opt.id,
        challenge_id: opt.challenge_id,
        option_key: opt.option_key || opt.display_name.toLowerCase().replace(/\s+/g, '_'),
        display_name: opt.display_name,
        token_name: opt.token_name,
        odds: opt.odds || 1.0,
        is_winner: opt.is_winner || false,
        created_at: opt.created_at,
        updated_at: opt.updated_at,
        metadata: opt.metadata
      })),
      metadata: payload.metadata
    };
    
    // Display full winner details in console
    console.log('👑 ===== WINNER DETAILS =====');
    console.log('📋 Challenge ID:', challenge.id);
    console.log('📋 Title:', challenge.title);
    console.log('📋 Stream ID:', challenge.stream_id);
    console.log('📋 State:', challenge.state);
    console.log('👑 Winner Option ID:', challenge.winner_option_id);
    
    if (payload.winner) {
      console.log('🏆 ===== WINNER INFO =====');
      console.log('🏆 Winner Option ID:', payload.winner.option_id);
      console.log('🏆 Winner Option Key:', payload.winner.option_key);
      console.log('🏆 Winner Display Name:', payload.winner.display_name);
      console.log('🏆 Winner Token Name:', payload.winner.token_name);
    }
    
    console.log('🎲 ===== OPTIONS WITH WINNER STATUS =====');
    challenge.options.forEach((option, index) => {
      console.log(`  ${index + 1}. Option Details:`);
      console.log(`     ID: ${option.id}`);
      console.log(`     Display Name: ${option.display_name}`);
      console.log(`     Token Name: ${option.token_name}`);
      console.log(`     Is Winner: ${option.is_winner ? '👑 YES' : '❌ NO'}`);
    });
    
    console.log('👑 ===== END WINNER DETAILS =====');
    
    // Also log the raw payload for debugging
    console.log('🔍 Raw winner payload for debugging:', JSON.stringify(payload, null, 2));
    
    // Dispatch custom event for the content script to handle
    const event = new CustomEvent('challenge-update', {
      detail: {
        type: 'challenge:winner',
        challenge: challenge,
        winner: payload.winner
      }
    });
    document.dispatchEvent(event);
    console.log('📡 Dispatched challenge-winner event');
  }

  disconnect(): void {
    console.log('🔌 Disconnecting from stream');
    
    // Close SSE connection
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    
    // Close Supabase connection
    if (this.streamId) {
      const channel = this.supabase.channel(`stream-${this.streamId}`);
      channel.unsubscribe();
    }
    
    this.isConnected = false;
    this.streamId = null;
    this.notifyConnectionStatusChange();
  }

  isStreamConnected(): boolean {
    return this.isConnected;
  }
} 