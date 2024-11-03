import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { SocketService } from './socket.service';
import { WebRtcService } from './webrtc.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-socket',
  standalone: true,
  imports: [CommonModule],
  providers: [SocketService, WebRtcService],
  templateUrl: './socket.component.html',
  styleUrl: './socket.component.css'
})
export class SocketComponent implements OnInit, AfterViewInit {
  callActive: boolean = false;
  msg_list: string[] = [];
  @ViewChild('me', {static: true}) me!: ElementRef<HTMLVideoElement>;
  @ViewChild('remote', {static: true}) remote!: ElementRef<HTMLVideoElement>;
  @ViewChild("messageinput") messageinput: any;

  constructor(private socketService: SocketService, private _webrtcService: WebRtcService) { }

  ngAfterViewInit() {
    this._webrtcService.configure(this.me, this.remote);
  }

  ngOnInit() {
    this._webrtcService.callActive = this.callActive; 
    this.socketService.onMessage(this.msg_list, this.messageReceived);
    this._webrtcService.sendMessage.subscribe((message) => this.socketService.sendMessage(message));
    this.socketService.webrtcMessage.subscribe((message) => this._webrtcService.messageReceived(message));
  }

  async sendTextMessage(messageText: string) {
    await this.socketService
      .sendMessage(JSON.stringify({ msg_type: "chat", content: messageText }))
      .then(() => this.msg_list.push(messageText))
      .then(() => this.messageinput.nativeElement.value = "")
      .catch(err => console.error(err));
  }

  messageReceived(msg_list: string[], message: string) {
    msg_list.push(message);
  }

  showRemote() {
    this._webrtcService.showRemote();
    this.callActive = true;
  }

  hangup() {
    this._webrtcService.hangup();
  }
}
