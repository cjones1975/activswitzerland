import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderNav } from '../header-nav/header-nav';
import { DrawerHost } from '../../shared/drawer-host/drawer-host';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, HeaderNav, DrawerHost],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.css',
})
export class MainLayout {}
