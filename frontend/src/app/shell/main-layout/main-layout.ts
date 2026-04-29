import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderNav } from '../header-nav/header-nav';
import { DrawerHost } from '../../shared/drawer-host/drawer-host';
import { FooterNav } from '../footer-nav/footer-nav';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, HeaderNav, DrawerHost, FooterNav],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.css',
})
export class MainLayout {}
