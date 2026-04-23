import { Component } from '@angular/core';
import { Menubar } from 'primeng/menubar';
import { Button } from 'primeng/button';

@Component({
  selector: 'app-header-nav',
  imports: [Menubar, Button],
  templateUrl: './header-nav.html',
  styleUrl: './header-nav.css',
})
export class HeaderNav {}
