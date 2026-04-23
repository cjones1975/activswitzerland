import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DrawerHost } from './drawer-host';

describe('DrawerHost', () => {
  let component: DrawerHost;
  let fixture: ComponentFixture<DrawerHost>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DrawerHost],
    }).compileComponents();

    fixture = TestBed.createComponent(DrawerHost);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
