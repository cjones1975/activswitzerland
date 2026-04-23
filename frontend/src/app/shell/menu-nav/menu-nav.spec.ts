import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MenuNav } from './menu-nav';

describe('MenuNav', () => {
  let component: MenuNav;
  let fixture: ComponentFixture<MenuNav>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MenuNav],
    }).compileComponents();

    fixture = TestBed.createComponent(MenuNav);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
