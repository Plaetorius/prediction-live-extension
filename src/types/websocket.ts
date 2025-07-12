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
  type: 'stream_status';
  hasActiveStream: boolean;
  streamId: string;
}

export interface WebSocketMessage {
  type: string;
  payload: any;
} 