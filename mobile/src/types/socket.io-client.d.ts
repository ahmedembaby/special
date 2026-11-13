declare module 'socket.io-client' {
  const io: (uri: string, opts?: any) => SocketIOClient.Socket;
  export default io;
}

declare namespace SocketIOClient {
  interface Socket {
    emit(event: string, ...args: any[]): void;
    on(event: string, listener: (...args: any[]) => void): void;
    off(event: string, listener?: (...args: any[]) => void): void;
    connect(): void;
    disconnect(): void;
    join(room: string): void;
    leave(room: string): void;
    connected: boolean;
    id: string;
  }
}
