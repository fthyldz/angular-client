import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SocketComponent } from "./socket.component";

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, SocketComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {}
