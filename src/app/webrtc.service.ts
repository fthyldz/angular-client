import { isPlatformBrowser } from "@angular/common";
import { ElementRef, EventEmitter, Inject, Injectable, OnDestroy, PLATFORM_ID } from "@angular/core";

declare const RTCPeerConnection: any;

@Injectable({
    providedIn: "root"
})
export class WebRtcService implements OnDestroy {
    public callActive: boolean = false;
    private localStream: any;
    private pc: any = null;

    private me!: ElementRef<HTMLVideoElement>;
    private remote!: ElementRef<HTMLVideoElement>;

    public sendMessage = new EventEmitter<string>();

    constructor(@Inject(PLATFORM_ID) private _platform: Object) { }

    public configure(me: any, remote: any) {
        this.me = me;
        this.remote = remote;
        this.setupWebRtc();
    }

    ngOnDestroy() {
        this.pc.close();
        let tracks = this.localStream.getTracks();
        for (let i = 0; i < tracks.length; i++) {
            tracks[i].stop();
        }
        this.callActive = false;
        this.pc = null;
        this.localStream = null;
    }

    private setupWebRtc() {
        try {
            this.pc = new RTCPeerConnection({
                iceServers: [
                    { url: 'stun:stun.l.google.com:19302' },
                    { url: 'stun:stun1.l.google.com:19302' },
                    { url: 'stun:stun2.l.google.com:19302' },
                    { url: 'stun:stun3.l.google.com:19302' }
                ]
            });
        } catch (error) {
            console.log(error);
        }


        this.pc.onicecandidate = (event: any) => {
            if (event.candidate) {
                console.log('Candidate bulundu -> ', event.candidate.candidate);
                this.sendMessage.emit(JSON.stringify({ msg_type: "candidate", content: event.candidate.candidate, sdp_mid: event.candidate.sdpMid, sdp_mline_index: event.candidate.sdpMLineIndex, username_fragment: event.candidate.usernameFragment }));
            }
        }

        this.pc.onremovestream = (event: any) => {
            console.log('Stream Ended');
        }

        this.pc.ontrack = (event: any) => {
            this.remote.nativeElement.srcObject = event.streams[0];
        }

        this.pc.oniceconnectionstatechange = (event: any) => {
            console.log('ICE connection state: ', this.pc.iceConnectionState);
            switch (this.pc.iceConnectionState) {
                case 'connected':
                    console.log('ICE connection established');
                    break;
                case 'failed':
                    console.log('ICE connection failed');
                    // Bağlantı başarısız olduysa, tekrar deneme veya hata mesajı
                    break;
                case 'disconnected':
                    console.log('ICE connection disconnected');
                    // Bağlantı kesildi, tekrar bağlanmaya çalışabiliriz
                    break;
                case 'closed':
                    console.log('ICE connection closed');
                    // Bağlantı kapandı
                    break;
                // Diğer durumlar da eklenebilir
            }
        };
    }

    public messageReceived(message: any) {
        const msg = JSON.parse(message);
        if (this.pc) {
            if (msg.msg_type == "candidate") {
                console.log("Candidate geldi -> ", msg.content);

                this.pc.addIceCandidate(new RTCIceCandidate({ candidate: msg.content, sdpMid: msg.sdp_mid, sdpMLineIndex: msg.sdp_mline_index, usernameFragment: msg.username_fragment }));
            } else if (msg.msg_type == "answer") {
                this.callActive = true;
                this.pc.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp: msg.content }));
            }
        }
    }

    /*  public showMe() {
         if (isPlatformBrowser(this._platform) && 'mediaDevices' in navigator) {
             navigator.mediaDevices.getUserMedia({ audio: true, video: true })
                 .then(stream => {
                     this.localStream = stream;
                     // Her bir track'i ekle
                     stream.getTracks().forEach(track => {
                         this.pc.addTrack(track, stream);
                     });
 
                     this.me.nativeElement.srcObject = stream;
                 })
                 .catch(error => {
                     console.error("Media Device Hatası: ", error);
                 });
         }
     } */

    public async showMe(): Promise<void> {
        if (isPlatformBrowser(this._platform) && 'mediaDevices' in navigator) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
                this.localStream = stream;
                // Add each track to the peer connection
                stream.getTracks().forEach(track => {
                    this.pc.addTrack(track, this.localStream);
                });

                this.me.nativeElement.srcObject = this.localStream;
            } catch (error) {
                console.error("Media Device Error: ", error);
                throw error;
            }
        } else {
            return Promise.reject("Not in browser or mediaDevices not available");
        }
    }


    /* public showRemote() {
        try {
            this.showMe();
            this.pc.createOffer()
                .then((offer: any) => this.pc.setLocalDescription(offer))
                .then(() => {
                    this.sendMessage.emit(JSON.stringify({ msg_type: "offer", content: this.pc.localDescription.sdp }));
                    this.callActive = true;
                });
        } catch (error) {
            console.log(error);
        }
    } */

    public async showRemote() {
        try {
            await this.showMe(); // Wait for showMe() to complete

            const offer = await this.pc.createOffer();
            console.log("SDP Offer:", offer.sdp); // Log the SDP offer

            await this.pc.setLocalDescription(offer);

            this.sendMessage.emit(JSON.stringify({ msg_type: "offer", content: this.pc.localDescription.sdp }));
            this.callActive = true;
        } catch (error) {
            console.error("Error in showRemote: ", error);
        }
    }


    public hangup() {
        this.pc.close();
        let tracks = this.localStream.getTracks();
        for (let i = 0; i < tracks.length; i++) {
            tracks[i].stop();
        }
        this.callActive = false;
        this.pc = null;
    }
}