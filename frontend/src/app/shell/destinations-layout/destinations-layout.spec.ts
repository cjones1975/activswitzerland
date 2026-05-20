import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DestinationsLayout } from './destinations-layout';

describe('DestinationsLayout', () => {
  let component: DestinationsLayout;
  let fixture: ComponentFixture<DestinationsLayout>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DestinationsLayout],
    }).compileComponents();

    fixture = TestBed.createComponent(DestinationsLayout);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
