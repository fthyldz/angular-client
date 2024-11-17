import { isPlatformBrowser } from "@angular/common";
import { ElementRef, EventEmitter, Inject, Injectable, OnDestroy, OnInit, PLATFORM_ID } from "@angular/core";

declare const RTCPeerConnection: any;

@Injectable({
    providedIn: "root"
})
export class WebRtcService implements OnDestroy {
    public callActive: boolean = false;
    private localStream: any;
    private pc: RTCPeerConnection | null = null;

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
        this.pc!.close();
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
                    { urls: "stun:stun.l.google.com:19302" },
                    { urls: "stun:stun.cloudflare.com:3478" }
                ]
            });
        } catch (error) {
            console.log(error);
        }


        this.pc!.onicecandidate = (event: any) => {
            if (event.candidate) {
                this.sendMessage.emit(JSON.stringify({ msg_type: "IceCandidate", content: event.candidate.candidate, sdp_mid: event.candidate.sdpMid, sdp_mline_index: event.candidate.sdpMLineIndex, username_fragment: event.candidate.usernameFragment }));
            }
        }

        this.pc!.ontrack = (event: RTCTrackEvent) => {
            console.log('Track event:', event);

            this.remote.nativeElement.srcObject = event.streams[0];
        }

        this.pc!.oniceconnectionstatechange = (event: any) => {
            //console.log('ICE connection state: ', this.pc.iceConnectionState);
            switch (this.pc!.iceConnectionState) {
                case 'connected':
                    //console.log('ICE connection established');
                    break;
                case 'failed':
                    //console.log('ICE connection failed');
                    // Bağlantı başarısız olduysa, tekrar deneme veya hata mesajı
                    break;
                case 'disconnected':
                    //console.log('ICE connection disconnected');
                    // Bağlantı kesildi, tekrar bağlanmaya çalışabiliriz
                    break;
                case 'closed':
                    //console.log('ICE connection closed');
                    // Bağlantı kapandı
                    break;
                // Diğer durumlar da eklenebilir
            }
        };

        /*this.pc.createDataChannel("messages");


        this.pc.ondatachannel = (event: any) => {
            console.log('Data channel opened with label: ', event.channel.label);
            const channel = event.channel;
            channel.onmessage = (event: any) => {
                this.handleRTPData(event.data);
            };
        };*/
    }

    /*ngOnInit() {
        // MediaSource nesnesi oluşturuluyor
        this.mediaSource = new MediaSource();
        this.currentVideoUrl = URL.createObjectURL(this.mediaSource);

        // MediaSource açıldığında yapılacaklar
        this.mediaSource.addEventListener('sourceopen', () => {
            if (this.mediaSource) {
                this.sourceBuffer = this.mediaSource.addSourceBuffer('video/webm; codecs="vp8"');
            }
        });
    }*/

    private currentVideoUrl: string = '';

    private addFramesToStream(data: ArrayBuffer) {
        const videoBlob = new Blob([data], { type: 'video/webm' });

        this.currentVideoUrl = URL.createObjectURL(videoBlob);

        this.remote.nativeElement.src = this.currentVideoUrl;
    }

    private videoFrames: ArrayBuffer[] = [];
    private async handleRTPData(data: ArrayBuffer) {
        /*console.log('First few bytes of ArrayBuffer:', new Uint8Array(data).subarray(0, 10));

        this.videoFrames.push(data);
        if (this.videoFrames.length == 30) {
            this.videoFrames.forEach(frame => this.addFramesToStream(frame));
            this.videoFrames = [];
        }*/
        //await this.decodeRtpPacket(data);
    }

    private mediaSource: MediaSource | null = null;
    private sourceBuffer: SourceBuffer | null = null;

    addFrameToStream(frame: any) {
        if (this.sourceBuffer && !this.sourceBuffer.updating) {
            this.sourceBuffer.appendBuffer(frame);  // Video verisini SourceBuffer'a ekleyin
        } else {
            console.warn('SourceBuffer is busy or not available yet');
        }
    }

    private frameToBlob(frame: any): Promise<Blob> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(new Blob([reader.result as ArrayBuffer]));
            reader.onerror = reject;
            reader.readAsArrayBuffer(frame);
        });
    }

    async decodeRtpPacket(rtpPacket: ArrayBuffer) {
        const videoDecoder = new VideoDecoder({
            output: (frame) => {
                // Çözümlenen video frame'ini buraya alabilirsiniz
                this.addFrameToStream(frame);
            },
            error: (e) => {
                console.error('Decoder Error:', e);
            }
        });

        const initConfig = {
            codec: 'vp8',  // VP8 codec'i, ya da kullandığınız codec türünü belirtin
        };

        await videoDecoder.configure(initConfig);

        // RTP paketini çözümleyin
        videoDecoder.decode(new EncodedVideoChunk({
            type: 'key',  // veya 'delta' ile frame türüne bağlı olarak
            timestamp: 0,
            data: rtpPacket
        }));
    }

    public messageReceived(message: any) {
        const msg = JSON.parse(message);
        if (this.pc) {
            if (msg.msg_type == "IceCandidate") {
                this.pc.addIceCandidate(new RTCIceCandidate({ candidate: msg.content, sdpMid: msg.sdp_mid, sdpMLineIndex: msg.sdp_mline_index, usernameFragment: msg.username_fragment })).then(() => { });
            } else if (msg.msg_type == "Answer") {
                this.callActive = true;
                this.pc!.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp: msg.content })).then(() => { });
            } else if (msg.msg_type == "Offer") {
                this.callActive = true;
                this.pc!.setRemoteDescription(new RTCSessionDescription({ type: "offer", sdp: msg.content })).then(() => {
                    this.pc!.createAnswer().then(answer => {
                        this.pc!.setLocalDescription(answer).then(() => {
                            this.sendMessage.emit(JSON.stringify({ msg_type: "Answer", content: answer.sdp }));
                        });
                    });
                });
            }
        }
    }

    generateIncrementalSDP(mid: string, ssrc: number, payloadType: number) {
        return `m=video 9 UDP/TLS/RTP/SAVPF ${payloadType}\na=mid:2\na=ssrc:${ssrc}\na=recvonly`;
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

    public async showMe() {
        if (isPlatformBrowser(this._platform) && 'mediaDevices' in navigator) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
                this.localStream = stream;
                // Add each track to the peer connection
                stream.getTracks().forEach(track => {
                    this.pc!.addTrack(track, this.localStream);
                });

                this.me.nativeElement.srcObject = this.localStream;
                //this.remote.nativeElement.src = this.currentVideoUrl;

            } catch (error) {
                console.error("Media Device Error: ", error);
            }
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

            const offer = await this.pc!.createOffer();

            await this.pc!.setLocalDescription(offer);

            this.sendMessage.emit(JSON.stringify({ msg_type: "Offer", content: this.pc!.localDescription!.sdp }));

            this.callActive = true;
        } catch (error) {
            console.error("Error in showRemote: ", error);
        }
    }


    public hangup() {
        this.pc!.close();
        let tracks = this.localStream.getTracks();
        for (let i = 0; i < tracks.length; i++) {
            tracks[i].stop();
        }
        this.callActive = false;
        this.pc = null;
    }
}