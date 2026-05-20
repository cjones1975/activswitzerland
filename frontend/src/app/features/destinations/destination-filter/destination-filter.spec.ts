import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DestinationFilter } from './destination-filter';

describe('DestinationFilter', () => {
  let component: DestinationFilter;
  let fixture: ComponentFixture<DestinationFilter>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DestinationFilter],
    }).compileComponents();

    fixture = TestBed.createComponent(DestinationFilter);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
