export interface PredictionMessage {
  type: 'prediction';
  userId: string;
  streamId: string;
  message: string;
  timestamp: number;
}

export interface ServerResponse {
  type: 'success' | 'failure' | 'stream_status';
  message: string;
  data?: any;
}

export interface StreamStatusResponse {
  open: boolean;
  streamId: string;
}

export interface ChallengeOption {
  id: string;
  challenge_id: string;
  optionKey: string;
  displayName: string;
  tokenName: string;
  odds?: number;
  created_at?: string;
  updated_at?: string;
  metadata?: {
    created_at?: string;
    updated_at?: string;
  };
}

export interface Challenge {
  id: string;
  streamId: string;
  eventType: string;
  title: string;
  state: 'open' | 'closed' | 'resolved';
  startedAt: string;
  createdAt?: string;
  updatedAt?: string;
  options: ChallengeOption[];
  metadata?: {
    total_options: number;
    stream_id: string;
    event_type: string;
    broadcast_timestamp: string;
  };
}

export interface PredictionRequest {
  challengeId: string;
  userId: string;
  optionId: string;
  amount: number;
  tokenName: string;
}

export interface PredictionResponse {
  success: boolean;
  message: string;
  data?: {
    predictionId: string;
    amount: number;
    odds: number;
    tokenName: string;
  };
}

export interface WebSocketMessage {
  type: 'challenge' | 'challenge_closed' | 'challenge_resolved';
  payload: Challenge | any;
} 