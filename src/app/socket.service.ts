import { EventEmitter, Injectable } from "@angular/core";

@Injectable({
    providedIn: "root"
})
export class SocketService {
    private socket: WebSocket;
    public webrtcMessage = new EventEmitter<string>();

    constructor() {
        this.socket = new WebSocket("ws://localhost:8080");
        this.socket.onopen = (event) => {
            console.log("Connected to server");
            //setInterval(() => this.pingpong(), 30000);
        };
    }

    public async sendMessage(message: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.socket.readyState === WebSocket.OPEN) {
                this.socket.send(message);
                resolve();
            } else {
                reject(new Error("Socket is not open"));
            }
        });
    }

    public onMessage(msg_list: string[], callback: any) {
        this.socket.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.msg_type === "Chat") {
                    callback(msg_list, msg.content);
                } else if (msg.msg_type === "Pong") {
                    console.log("Pong geldi");
                } else if (msg.msg_type === "Offer" || msg.msg_type === "Answer" || msg.msg_type === "IceCandidate") {
                    this.webrtcMessage.emit(event.data);
                } else {
                    console.log("Unknown message type: ", msg);
                }
            } catch (error) {
                console.error("Message handling error: ", error);
            }
        };
    }

    pingpong() {
        this.sendMessage(JSON.stringify({ msg_type: "ping", content: [] }))
            .then(() => console.log("Ping gönderildi"))
            .catch(err => console.error(err));
    }
}