import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TripPlannerLayout } from './trip-planner-layout';

describe('TripPlannerLayout', () => {
  let component: TripPlannerLayout;
  let fixture: ComponentFixture<TripPlannerLayout>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TripPlannerLayout],
    }).compileComponents();

    fixture = TestBed.createComponent(TripPlannerLayout);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
